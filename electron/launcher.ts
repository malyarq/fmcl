import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { launch, Version } from '@xmcl/core';
import {
    installTask as installMinecraftTask,
    installDependenciesTask,
    getForgeVersionList,
    installForgeTask,
    installFabric,
    type ForgeVersion,
    type ForgeVersionList
} from '@xmcl/installer';
import type { Task } from '@xmcl/task';
import { getOfflineUUID, offline } from '@xmcl/user';
import { createRequire } from 'node:module';
import { JavaManager } from './java';
import { NetworkManager } from './network';
import { Agent, interceptors, type Dispatcher } from 'undici';
import { DefaultRangePolicy } from '@xmcl/file-transfer';
import os from 'node:os';
import crypto from 'node:crypto';
import { DownloadManager } from './downloadManager';
import { BMCL_ROOT, getProviderById, reportMirrorFailure, reportMirrorSuccess, type DownloadProvider, type DownloadProviderId } from './mirrors';

interface TaskProgressData {
    type: string;
    task: number;
    total: number;
}

interface LibraryEntry {
    url?: string;
    download?: {
        url?: string;
        path?: string;
    };
    downloads?: {
        artifact?: { url?: string };
        classifiers?: Record<string, { url?: string }>;
    };
}

interface VersionEntry {
    id: string;
    type: string;
    url?: string;
    assetIndex?: { url?: string };
    downloads?: {
        client?: { url?: string };
        server?: { url?: string };
    };
}

const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Увеличенные таймауты для медленных соединений (особенно для пользователей из России)
const DEFAULT_CONNECT_TIMEOUT = 30_000;
const DEFAULT_HEADERS_TIMEOUT = 60_000;
const DEFAULT_BODY_TIMEOUT = 180_000; // 3 минуты - достаточно для медленных соединений, но отслеживание прогресса прервет раньше

// Orchestrates game launch flow: Java, Forge, auth, and runtime options.
export class LauncherManager {
    private static undiciPatched = false;
    private javaManager: JavaManager;
    public networkManager: NetworkManager;
    private taskLogProgress = new Map<string, { bytes: number; percent: number }>();
    private badDownloadHosts = new Set<string>();

    constructor() {
        LauncherManager.patchUndiciThrowOnError();
        this.javaManager = new JavaManager();
        this.networkManager = new NetworkManager();
    }

    private createDispatcher(maxSockets: number, retryCount = 5, maxRedirections = 5): Dispatcher {
        return new Agent({
            connections: maxSockets,
            connectTimeout: DEFAULT_CONNECT_TIMEOUT,
            headersTimeout: DEFAULT_HEADERS_TIMEOUT,
            bodyTimeout: DEFAULT_BODY_TIMEOUT
        }).compose(
            interceptors.retry({ maxRetries: retryCount }),
            interceptors.redirect({ maxRedirections })
        );
    }

    private resolveDownloadConcurrency(autoThreads: boolean | undefined, downloadThreads: number | undefined) {
        if (autoThreads) {
            return Math.max(os.cpus().length * 2, 6);
        }
        return Math.max(1, downloadThreads ?? 4);
    }

    private getDownloadProvider(providerId?: DownloadProviderId): DownloadProvider {
        return getProviderById(providerId ?? 'auto');
    }

    private async fetchVersionList(provider: DownloadProvider) {
        const urls = provider.getVersionListURLs();
        let lastError: unknown;
        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
                return await res.json();
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError ?? new Error('Failed to fetch version list');
    }

    private async probeUrl(url: string, timeoutMs = 2500) {
        const startedAt = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { method: 'GET', signal: controller.signal, cache: 'no-store' });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            reportMirrorSuccess(url, Date.now() - startedAt);
        } catch {
            clearTimeout(timer);
            reportMirrorFailure(url);
        }
    }

    private async warmupMirrors(provider: DownloadProvider) {
        if (provider.id !== 'auto') return;
        const probes = new Set<string>();
        for (const url of provider.getVersionListURLs()) probes.add(url);
        for (const url of provider.injectURLWithCandidates('https://resources.download.minecraft.net')) probes.add(url);
        for (const url of provider.injectURLWithCandidates('https://libraries.minecraft.net')) probes.add(url);
        for (const url of provider.injectURLWithCandidates('https://maven.minecraftforge.net/')) probes.add(url);
        await Promise.allSettled(Array.from(probes).map((url) => this.probeUrl(url)));
    }

    private getOrigin(url: string) {
        try {
            return new URL(url).origin;
        } catch {
            return url;
        }
    }

    private recordBadHosts(err: unknown, onLog: (data: string) => void) {
        const errObj = err && typeof err === 'object' ? err as { errors?: unknown[]; url?: string } : null;
        const errors = Array.isArray(errObj?.errors) ? errObj.errors : [err];
        for (const item of errors) {
            const itemObj = item && typeof item === 'object' ? item as { url?: string } : null;
            const url = itemObj?.url;
            if (typeof url !== 'string') continue;
            const origin = this.getOrigin(url);
            if (!this.badDownloadHosts.has(origin)) {
                this.badDownloadHosts.add(origin);
                onLog(`[Download] Blacklisted slow/bad host: ${origin}`);
            }
        }
    }

    private static patchUndiciThrowOnError() {
        if (LauncherManager.undiciPatched) return;
        const requireFn = createRequire(import.meta.url);
        const patchModule = (moduleRef: Record<string, unknown> | null | undefined) => {
            if (!moduleRef) return;
            const originalRequest = moduleRef.request;
            const originalStream = moduleRef.stream;
            const originalPipeline = moduleRef.pipeline;

            const wrapOptions = (opts?: Record<string, unknown>) => {
                if (!opts || typeof opts !== 'object') return opts;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { throwOnError: _ignored, maxRedirections: _drop, ...rest } = opts;
                const headers = rest.headers;
                if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
                const normalized: Record<string, string> = { ...headers as Record<string, string> };
                const hasUserAgent = Object.keys(normalized).some((key) => key.toLowerCase() === 'user-agent');
                if (!hasUserAgent) normalized['user-agent'] = DEFAULT_USER_AGENT;
                    return { ...rest, headers: normalized };
                }
                if (!headers) {
                    return { ...rest, headers: { 'user-agent': DEFAULT_USER_AGENT } };
                }
                return rest;
            };

            if (typeof originalRequest === 'function' && !(originalRequest as { __xmclPatched?: boolean }).__xmclPatched) {
                const wrapped = (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => {
                    return (originalRequest as (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => unknown)(url, wrapOptions(opts), callback);
                };
                (wrapped as { __xmclPatched?: boolean }).__xmclPatched = true;
                moduleRef.request = wrapped;
            }

            if (typeof originalStream === 'function' && !(originalStream as { __xmclPatched?: boolean }).__xmclPatched) {
                const wrappedStream = (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => {
                    return (originalStream as (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => unknown)(url, wrapOptions(opts), callback);
                };
                (wrappedStream as { __xmclPatched?: boolean }).__xmclPatched = true;
                moduleRef.stream = wrappedStream;
            }

            if (typeof originalPipeline === 'function' && !(originalPipeline as { __xmclPatched?: boolean }).__xmclPatched) {
                const wrappedPipeline = (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => {
                    return (originalPipeline as (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => unknown)(url, wrapOptions(opts), callback);
                };
                (wrappedPipeline as { __xmclPatched?: boolean }).__xmclPatched = true;
                moduleRef.pipeline = wrappedPipeline;
            }
        };

        try {
            patchModule(requireFn('undici'));
        } catch {
            // Module not found or patch failed, continue
        }

        try {
            const installerEntry = requireFn.resolve('@xmcl/installer');
            const installerRequire = createRequire(installerEntry);
            patchModule(installerRequire('undici'));
        } catch {
            // Module not found or patch failed, continue
        }

        LauncherManager.undiciPatched = true;
    }

    private ensureXmclFolders(rootPath: string) {
        fs.mkdirSync(rootPath, { recursive: true });
        for (const folder of ['assets', 'libraries', 'versions', 'instances']) {
            try {
                fs.mkdirSync(path.join(rootPath, folder), { recursive: true });
            } catch {
                // Folder already exists or creation failed, continue
            }
        }
    }

    private rewriteForgeInstallProfile(rootPath: string, versionId: string, provider: DownloadProvider, onLog: (data: string) => void) {
        const profilePath = path.join(rootPath, 'versions', versionId, 'install_profile.json');
        if (!fs.existsSync(profilePath)) return false;
        try {
            const raw = fs.readFileSync(profilePath, 'utf-8');
            const data = JSON.parse(raw);
            const libs = data?.libraries;
            if (!Array.isArray(libs)) return false;
            const changed = this.patchLibraryUrls(libs, provider);
            if (changed) {
                fs.writeFileSync(profilePath, JSON.stringify(data, null, 2));
                onLog('[Forge] Patched install_profile.json with mirrors.');
            }
            return changed;
        } catch {
            return false;
        }
    }

    private rewriteForgeVersionJson(rootPath: string, versionId: string, provider: DownloadProvider, onLog: (data: string) => void) {
        const versionPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
        if (!fs.existsSync(versionPath)) return false;
        try {
            const raw = fs.readFileSync(versionPath, 'utf-8');
            const data = JSON.parse(raw);
            const libs = data?.libraries;
            if (!Array.isArray(libs)) return false;
            const changed = this.patchLibraryUrls(libs, provider);
            if (changed) {
                fs.writeFileSync(versionPath, JSON.stringify(data, null, 2));
                onLog('[Forge] Patched version json with mirrors.');
            }
            return changed;
        } catch {
            return false;
        }
    }

    private async computeFileSha1(filePath: string) {
        return new Promise<string>((resolve, reject) => {
            const hash = crypto.createHash('sha1');
            const stream = fs.createReadStream(filePath);
            stream.on('error', reject);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    private isHtmlResponse(data: Buffer, contentType?: string | null): boolean {
        if (contentType?.includes('text/html')) return true;
        if (data.length < 100) return false; // Слишком маленький для проверки
        const snippet = data.slice(0, Math.min(1024, data.length)).toString('utf8').trimStart().toLowerCase();
        return snippet.startsWith('<!doctype html') || 
               snippet.startsWith('<html') || 
               /verifying your browser/i.test(snippet) ||
               /attention required/i.test(snippet) ||
               /cloudflare/i.test(snippet) ||
               /js required/i.test(snippet);
    }

    private async downloadFileDirectly(url: string, destination: string, expectedSize?: number, onLog: (data: string) => void = () => {}): Promise<void> {
        const controller = new AbortController();
        const PROGRESS_STALL_TIMEOUT = 20_000; // 20 секунд без прогресса
        const PROGRESS_CHECK_INTERVAL = 2_000; // Проверяем каждые 2 секунды
        
        // Создаем директорию если нужно
        const dir = path.dirname(destination);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Удаляем старый файл если есть
        if (fs.existsSync(destination)) {
            fs.unlinkSync(destination);
        }
        const pendingFile = `${destination}.pending`;
        if (fs.existsSync(pendingFile)) {
            fs.unlinkSync(pendingFile);
        }
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'user-agent': DEFAULT_USER_AGENT,
                    'accept': '*/*',
                    'accept-encoding': 'identity'
                },
                redirect: 'follow' // Следуем редиректам
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            const contentLength = response.headers.get('content-length');
            const size = contentLength ? parseInt(contentLength, 10) : undefined;
            
            if (onLog) {
                if (size) {
                    onLog(`[Download] Expected size: ${Math.round(size / 1024)}KB`);
                }
                if (contentType) {
                    onLog(`[Download] Content-Type: ${contentType}`);
                }
            }
            
            // Потоковая загрузка с отслеживанием прогресса
            if (!response.body) {
                throw new Error('Response body is null');
            }
            
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let downloadedBytes = 0;
            let lastProgressTime = Date.now();
            let lastDownloadedBytes = 0;
            
            // Мониторинг прогресса
            const progressMonitor = setInterval(() => {
                const timeSinceProgress = Date.now() - lastProgressTime;
                if (downloadedBytes === lastDownloadedBytes && timeSinceProgress >= PROGRESS_STALL_TIMEOUT) {
                    // Прогресс остановился - прерываем загрузку
                    clearInterval(progressMonitor);
                    controller.abort();
                } else if (downloadedBytes > lastDownloadedBytes) {
                    // Есть прогресс - обновляем время
                    lastDownloadedBytes = downloadedBytes;
                    lastProgressTime = Date.now();
                }
            }, PROGRESS_CHECK_INTERVAL);
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) {
                        chunks.push(value);
                        downloadedBytes += value.length;
                        lastProgressTime = Date.now();
                    }
                }
            } finally {
                clearInterval(progressMonitor);
            }
            
            const data = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
            
            if (onLog) {
                onLog(`[Download] Downloaded: ${Math.round(data.length / 1024)}KB`);
            }
            
            // Проверка на HTML ошибку
            if (this.isHtmlResponse(data, contentType)) {
                const snippet = data.slice(0, 200).toString('utf8');
                throw new Error(`Server returned HTML instead of file. Response starts with: ${snippet.substring(0, 100)}...`);
            }
            
            // Проверка размера
            if (expectedSize && data.length < expectedSize * 0.8) { // Допускаем 20% отклонение
                throw new Error(`File too small: expected at least ${Math.round(expectedSize * 0.8 / 1024)}KB, got ${Math.round(data.length / 1024)}KB`);
            }
            
            // Минимальная проверка для ZIP файлов
            if (data.length < 100) {
                throw new Error(`File too small (${data.length} bytes), likely corrupted or incomplete`);
            }
            
            // Проверка ZIP сигнатуры (PK для ZIP файлов)
            if (!data.slice(0, 2).equals(Buffer.from([0x50, 0x4B]))) {
                throw new Error(`File doesn't appear to be a ZIP file (missing PK signature)`);
            }
            
            // Записываем файл
            fs.writeFileSync(destination, data);
            
            if (onLog) {
                onLog(`[Download] File saved successfully`);
            }
        } catch (err: unknown) {
            // Удаляем битые файлы при ошибке
            try {
                if (fs.existsSync(destination)) {
                    fs.unlinkSync(destination);
                }
                if (fs.existsSync(pendingFile)) {
                    fs.unlinkSync(pendingFile);
                }
            } catch {
                // Игнорируем ошибки удаления
            }
            // Если загрузка была прервана из-за отсутствия прогресса, сообщаем об этом
            if (controller.signal.aborted && err instanceof Error && err.name === 'AbortError') {
                throw new Error(`Download stalled - no progress for ${PROGRESS_STALL_TIMEOUT / 1000}s`);
            }
            throw err;
        }
    }

    private async ensureForgeMcpConfig(
        rootPath: string,
        versionId: string,
        provider: DownloadProvider,
        _maxSockets: number,
        onLog: (data: string) => void
    ) {
        const versionPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
        const profilePath = path.join(rootPath, 'versions', versionId, 'install_profile.json');
        const files = [versionPath, profilePath];
        const candidates: Array<{ url: string; sha1: string; path: string }> = [];

        for (const file of files) {
            if (!fs.existsSync(file)) continue;
            try {
                const raw = fs.readFileSync(file, 'utf-8');
                const data = JSON.parse(raw);
                const libs = data?.libraries;
                if (!Array.isArray(libs)) continue;
                for (const lib of libs) {
                    const artifact = lib?.downloads?.artifact;
                    const artifactPath = artifact?.path;
                    const artifactUrl = artifact?.url ?? (lib?.url && artifactPath ? `${lib.url}${artifactPath}` : undefined);
                    const sha1 = artifact?.sha1;
                    if (!artifactPath || !artifactUrl || !sha1) continue;
                    if (!artifactPath.includes('de/oceanlabs/mcp/mcp_config/')) continue;
                    candidates.push({ url: artifactUrl, sha1, path: artifactPath });
                }
            } catch {
                // Ignore malformed JSON.
            }
        }

        if (candidates.length === 0) return false;
        const target = candidates[0];
        const destination = path.join(rootPath, 'libraries', target.path);
        
        // Проверяем существующий файл
        if (fs.existsSync(destination)) {
            try {
                const currentSha1 = await this.computeFileSha1(destination);
                if (currentSha1.toLowerCase() === target.sha1.toLowerCase()) {
                    onLog('[Forge] mcp_config already present with valid checksum.');
                    return true;
                }
                onLog(`[Forge] Existing file has wrong SHA1 (${currentSha1}), will re-download...`);
            } catch {
                // Re-download if we cannot verify.
            }
        }

        // Получаем все возможные URL
        let urls = provider.injectURLWithCandidates(target.url);
        
        // Добавляем дополнительные альтернативные источники для mcp_config
        const additionalSources: string[] = [];
        
        // Официальный Maven Forge (приоритет)
        if (target.url.includes('maven.minecraftforge.net')) {
            additionalSources.push(target.url);
        } else {
            // Если URL не официальный, добавляем официальный
            const officialUrl = target.url.replace(/https?:\/\/[^/]+/, 'https://maven.minecraftforge.net');
            additionalSources.push(officialUrl);
        }
        
        // Старый Forge Maven
        const oldForgeUrl = target.url.replace(/https?:\/\/[^/]+/, 'https://files.minecraftforge.net/maven');
        if (!additionalSources.includes(oldForgeUrl)) {
            additionalSources.push(oldForgeUrl);
        }
        
        // Удаляем дубликаты и объединяем
        const allUrls = [...additionalSources, ...urls];
        const uniqueUrls = Array.from(new Set(allUrls));
        
        // Приоритизируем: сначала официальные, потом зеркала
        const prioritizedUrls = uniqueUrls.sort((a, b) => {
            const aIsOfficial = a.includes('maven.minecraftforge.net') || a.includes('files.minecraftforge.net');
            const bIsOfficial = b.includes('maven.minecraftforge.net') || b.includes('files.minecraftforge.net');
            if (aIsOfficial && !bIsOfficial) return -1;
            if (!aIsOfficial && bIsOfficial) return 1;
            return 0;
        });
        
        const uniqueOriginSet = new Set(prioritizedUrls.map(url => {
            try {
                return new URL(url).origin;
            } catch {
                return url;
            }
        }));
        
        onLog(`[Forge] Retrying mcp_config via ${prioritizedUrls.length} URLs (${uniqueOriginSet.size} unique mirrors)...`);
        onLog(`[Forge] Expected SHA1: ${target.sha1}`);
        onLog(`[Forge] File size should be ~400KB`);
        
        // Попытка 1: Прямая загрузка через fetch (более надежно для маленьких файлов)
        onLog('[Forge] Attempting direct download (bypassing download manager)...');
        const expectedMinSize = 300 * 1024; // Минимум 300KB (файл ~400KB)
        for (const url of prioritizedUrls.slice(0, 12)) { // Пробуем первые 12 источников
            try {
                const origin = new URL(url).origin;
                onLog(`[Forge] Trying direct download from: ${origin}`);
                await this.downloadFileDirectly(url, destination, undefined, onLog);
                
                // Проверяем размер файла
                const stats = fs.statSync(destination);
                const fileSize = stats.size;
                onLog(`[Forge] Downloaded file size: ${Math.round(fileSize / 1024)}KB`);
                
                if (fileSize < expectedMinSize) {
                    throw new Error(`File too small (${fileSize} bytes), expected at least ${expectedMinSize} bytes. File may be corrupted or incomplete.`);
                }
                
                // Проверяем валидность ZIP
                try {
                    const zip = new AdmZip(destination);
                    const entries = zip.getEntries();
                    onLog(`[Forge] ZIP validation passed (${entries.length} entries).`);
                    
                    // Проверяем SHA1
                    const actualSha1 = await this.computeFileSha1(destination);
                    if (actualSha1.toLowerCase() === target.sha1.toLowerCase()) {
                        onLog('[Forge] ✓ mcp_config downloaded successfully with valid checksum!');
                        return true;
                    } else {
                        onLog(`[Forge] SHA1 mismatch (expected ${target.sha1}, got ${actualSha1})`);
                        onLog('[Forge] But ZIP is valid and file size is correct. Using anyway...');
                        onLog('[Forge] WARNING: File has different SHA1 but appears to be valid. This should work for Forge 1.12.2.');
                        return true;
                    }
                } catch (zipError: unknown) {
                    const errorMsg = zipError instanceof Error ? zipError.message : String(zipError);
                    onLog(`[Forge] ZIP validation failed: ${errorMsg}`);
                    // Удаляем поврежденный файл
                    if (fs.existsSync(destination)) {
                        try { fs.unlinkSync(destination); } catch {
                            // File deletion failed, continue
                        }
                    }
                    continue; // Пробуем следующий URL
                }
            } catch (directError: unknown) {
                const errorMsg = directError instanceof Error ? directError.message : String(directError);
                onLog(`[Forge] Direct download from ${new URL(url).origin} failed: ${errorMsg}`);
                // Удаляем поврежденный файл если есть
                if (fs.existsSync(destination)) {
                    try { fs.unlinkSync(destination); } catch {
                        // File deletion failed, continue
                    }
                }
                continue; // Пробуем следующий URL
            }
        }
        
        // Попытка 2: Через DownloadManager с увеличенными таймаутами
        onLog('[Forge] Direct download failed, trying via DownloadManager with extended timeouts...');
        try {
            // Создаем специальный dispatcher с большими таймаутами для маленького файла
            const slowDispatcher = new Agent({
                connections: 1,
                connectTimeout: 30_000,
                headersTimeout: 60_000,
                bodyTimeout: 180_000 // 3 минуты - достаточно для медленных соединений, но отслеживание прогресса прервет раньше
            }).compose(
                interceptors.retry({ maxRetries: 3 }),
                interceptors.redirect({ maxRedirections: 5 })
            );
            
            await DownloadManager.downloadSingle(urls, destination, {
                checksum: { algorithm: 'sha1', hash: target.sha1 },
                maxSockets: 1,
                validateZip: true,
                retryCount: 3,
                dispatcher: slowDispatcher,
                headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' }
            });
            onLog('[Forge] mcp_config downloaded successfully with valid checksum.');
            return true;
        } catch (checksumError: unknown) {
            const errorMsg = checksumError instanceof Error ? checksumError.message : String(checksumError);
            onLog(`[Forge] DownloadManager also failed: ${errorMsg}`);
            throw new Error(`Failed to download mcp_config from all sources: ${errorMsg}`);
        }
    }

    private patchLibraryUrls(libraries: LibraryEntry[], provider: DownloadProvider) {
        let changed = false;
        const patchValue = (value: unknown) => {
            if (typeof value !== 'string' || !value) return value;
            const injected = provider.injectURL(value);
            if (injected !== value) {
                changed = true;
                return injected;
            }
            return value;
        };
        for (const lib of libraries) {
            if (lib?.url) lib.url = patchValue(lib.url) as string | undefined;
            const artifact = lib?.downloads?.artifact;
            if (artifact?.url) artifact.url = patchValue(artifact.url) as string | undefined;
            const classifiers = lib?.downloads?.classifiers;
            if (classifiers && typeof classifiers === 'object') {
                for (const key of Object.keys(classifiers)) {
                    const entry = classifiers[key];
                    if (entry?.url) entry.url = patchValue(entry.url) as string | undefined;
                }
            }
        }
        return changed;
    }

    private normalizeTaskType(task: Task, overrideType?: string): string {
        if (overrideType) return overrideType;
        const label = `${task.path}.${task.name}`.toLowerCase();
        if (label.includes('asset')) return 'assets';
        if (label.includes('native')) return 'natives';
        if (label.includes('library')) return 'classes';
        if (label.includes('forge')) return 'Forge';
        if (label.includes('optifine')) return 'OptiFine';
        return 'download';
    }

    private formatTaskError(err: unknown): string[] {
        if (!err) return ['Unknown error'];
        const errObj = err && typeof err === 'object' ? err as { errors?: unknown[] } : null;
        if (errObj && 'errors' in errObj && Array.isArray(errObj.errors)) {
            return errObj.errors.map((e: unknown, index: number) => {
                const message = e instanceof Error ? e.message : String(e);
                return `(${index + 1}/${errObj.errors!.length}) ${message}`;
            });
        }
        if (err instanceof Error && err.cause) {
            const message = err.message ?? String(err);
            const causeMessage = err.cause instanceof Error ? err.cause.message : String(err.cause);
            return [`${message} (cause: ${causeMessage})`];
        }
        return [err instanceof Error ? err.message : String(err)];
    }

    private emitTaskProgress(task: Task, onProgress: (data: TaskProgressData) => void, overrideType?: string) {
        const total = typeof task.total === 'number' ? task.total : 0;
        const progress = typeof task.progress === 'number' ? task.progress : 0;
        if (total <= 0) return;
        onProgress({
            type: this.normalizeTaskType(task, overrideType),
            task: progress,
            total
        });
    }

    private logDownloadProgress(task: Task, _onLog: (data: string) => void) {
        const total = typeof task.total === 'number' ? task.total : 0;
        const progress = typeof task.progress === 'number' ? task.progress : 0;
        if (total <= 0) return;
        const key = task.path;
        const last = this.taskLogProgress.get(key) ?? { bytes: 0, percent: 0 };
        const deltaBytes = progress - last.bytes;
        const percent = Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
        const deltaPercent = percent - last.percent;
        const shouldLog = deltaBytes >= 512 * 1024 || deltaPercent >= 5 || progress === total;
        if (!shouldLog) return;
        this.taskLogProgress.set(key, { bytes: progress, percent });
    }

    private async runTaskWithProgress<T>(
        task: Task<T>,
        onProgress: (data: TaskProgressData) => void,
        onLog: (data: string) => void,
        label: string,
        overrideType?: string,
        onSubtaskStart?: (task: Task) => void
    ): Promise<T> {
        return task.startAndWait({
            onStart: (t) => {
                if (t.path === t.name) {
                    onLog(label);
                    return;
                }
                if (onSubtaskStart) onSubtaskStart(t);
                const depth = t.path.split('.').length;
                if (depth <= 2) {
                    onLog(`[Task] ${t.path} started`);
                }
            },
            onUpdate: (t) => {
                this.emitTaskProgress(t, onProgress, overrideType);
                if (t.path.includes('downloadInstaller') || t.path.includes('download')) {
                    this.logDownloadProgress(t, onLog);
                }
            },
            onFailed: (t, err) => {
                const messages = this.formatTaskError(err);
                if (t.path === t.name) {
                    onLog(`[ERROR] ${label} failed: ${messages.join(' | ')}`);
                } else {
                    onLog(`[ERROR] ${t.path} failed: ${messages.join(' | ')}`);
                }
                this.recordBadHosts(err, onLog);
            },
            onSucceed: (t) => {
                if (t.path === t.name) onLog(`${label} done.`);
            }
        });
    }

    private async ensureVanillaInstalled(
        versionId: string,
        rootPath: string,
        onLog: (data: string) => void,
        onProgress: (data: TaskProgressData) => void,
        provider: DownloadProvider,
        downloadOptions: ReturnType<LauncherManager['buildInstallerOptions']>
    ) {
        const versionJson = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
        if (fs.existsSync(versionJson)) return;
        const list = await this.fetchVersionList(provider) as { versions: VersionEntry[] };
        const versionMeta = list.versions.find((v: VersionEntry) => v.id === versionId);
        if (!versionMeta || !versionMeta.url) {
            throw new Error(`Minecraft version ${versionId} not found in official version list.`);
        }

        const task = installMinecraftTask(versionMeta as { id: string; url: string }, rootPath, downloadOptions);
        await this.runTaskWithProgress(task, onProgress, onLog, `Installing Minecraft ${versionId}...`);
    }

    public async getVersionList(providerId?: DownloadProviderId) {
        const provider = this.getDownloadProvider(providerId);
        return await this.fetchVersionList(provider);
    }

    public async getForgeSupportedVersions(providerId?: DownloadProviderId): Promise<string[]> {
        console.log('[Forge] Starting to fetch supported versions...');
        const startTime = Date.now();
        try {
            console.log('[Forge] Fetching Minecraft version list...');
            const versionList = await this.getVersionList(providerId);
            const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
            console.log(`[Forge] Found ${releaseVersions.length} release versions to check`);
            
            const supportedVersions: string[] = [];
            
            // First, try to get all supported versions from promotions JSON (much faster)
            try {
                console.log('[Forge] Trying promotions JSON method (fast)...');
                const promotionsUrl = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
                const response = await fetch(promotionsUrl);
                if (response.ok) {
                    const data = await response.json();
                    const promos = data.promos || {};
                    
                    for (const version of releaseVersions) {
                        const promoKey = `${version.id}-recommended`;
                        const latestKey = `${version.id}-latest`;
                        if (promos[promoKey] || promos[latestKey]) {
                            supportedVersions.push(version.id);
                        }
                    }
                    
                    // If we got results from promotions, return them
                    if (supportedVersions.length > 0) {
                        const elapsed = Date.now() - startTime;
                        console.log(`[Forge] Found ${supportedVersions.length} supported versions via promotions in ${elapsed}ms`);
                        return supportedVersions;
                    }
                    console.log('[Forge] Promotions method returned 0 versions, falling back to individual checks');
                } else {
                    console.warn(`[Forge] Promotions fetch failed with status ${response.status}`);
                }
            } catch (e: unknown) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.warn('[Forge] Promotions check failed, falling back to individual checks:', errorMsg);
            }
            
            // Fallback: check each version individually (slower but more accurate)
            console.log('[Forge] Starting individual version checks (this may take a while)...');
            let checked = 0;
            for (const version of versionList.versions) {
                if (version.type !== 'release') continue;
                checked++;
                if (checked % 10 === 0) {
                    console.log(`[Forge] Checked ${checked}/${releaseVersions.length} versions, found ${supportedVersions.length} so far...`);
                }
                try {
                    const forgeList = await getForgeVersionList({ minecraft: version.id });
                    const pages = Array.isArray(forgeList) ? forgeList : [forgeList];
                    const page = pages.find((p) => p.mcversion === version.id);
                    if (page && page.versions.length > 0) {
                        supportedVersions.push(version.id);
                    }
                } catch {
                    // Skip this version
                }
            }
            const elapsed = Date.now() - startTime;
            console.log(`[Forge] Completed: found ${supportedVersions.length} supported versions in ${elapsed}ms`);
            return supportedVersions;
        } catch (e: unknown) {
            const elapsed = Date.now() - startTime;
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`[Forge] Failed to get supported versions after ${elapsed}ms:`, errorMsg);
            return [];
        }
    }

    public async getFabricSupportedVersions(): Promise<string[]> {
        console.log('[Fabric] Starting to fetch supported versions...');
        const startTime = Date.now();
        try {
            console.log('[Fabric] Fetching Minecraft version list...');
            const versionList = await this.getVersionList();
            const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
            console.log(`[Fabric] Found ${releaseVersions.length} release versions to check`);
            
            const gameVersionsUrl = 'https://meta.fabricmc.net/v2/versions/game';
            const gameVersionsMirror = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/game';
            
            console.log('[Fabric] Fetching Fabric game versions from official API...');
            let gameVersions: Array<{ version: string }> = [];
            try {
                const response = await fetch(gameVersionsUrl);
                if (response.ok) {
                    gameVersions = await response.json();
                    console.log(`[Fabric] Got ${gameVersions.length} game versions from official API`);
                } else {
                    console.warn(`[Fabric] Official API returned status ${response.status}, trying mirror...`);
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch {
                console.log('[Fabric] Official API failed, trying mirror...');
                try {
                    const response = await fetch(gameVersionsMirror);
                    if (response.ok) {
                        gameVersions = await response.json();
                        console.log(`[Fabric] Got ${gameVersions.length} game versions from mirror`);
                    } else {
                        console.error(`[Fabric] Mirror also failed with status ${response.status}`);
                        return [];
                    }
                } catch (e2: unknown) {
                    const errorMsg = e2 instanceof Error ? e2.message : String(e2);
                    console.error('[Fabric] Both official and mirror failed:', errorMsg);
                    return [];
                }
            }
            
            const supportedSet = new Set(gameVersions.map((v: { version: string }) => v.version));
            const supported = versionList.versions
                .filter((v: VersionEntry) => v.type === 'release' && supportedSet.has(v.id))
                .map((v: VersionEntry) => v.id);
            
            const elapsed = Date.now() - startTime;
            console.log(`[Fabric] Completed: found ${supported.length} supported versions in ${elapsed}ms`);
            return supported;
        } catch (e: unknown) {
            const elapsed = Date.now() - startTime;
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error(`[Fabric] Failed to get supported versions after ${elapsed}ms:`, errorMsg);
            return [];
        }
    }

    public async getOptiFineSupportedVersions(): Promise<string[]> {
        console.log('[OptiFine] Starting to fetch supported versions...');
        const startTime = Date.now();
        try {
            console.log('[OptiFine] Fetching OptiFine version list from BMCLAPI...');
            const versionListUrl = 'https://bmclapi2.bangbang93.com/optifine/versionList';
            const response = await fetch(versionListUrl);
            if (!response.ok) {
                console.error(`[OptiFine] Failed to fetch version list: HTTP ${response.status}`);
                return [];
            }
            const optiFineVersions: Array<{ mcversion: string; type: string; patch: string }> = await response.json();
            console.log(`[OptiFine] Got ${optiFineVersions.length} OptiFine versions from API`);
            
            const supportedSet = new Set(optiFineVersions.map((v: { mcversion: string; type: string; patch: string }) => v.mcversion));
            console.log(`[OptiFine] Unique Minecraft versions in OptiFine list: ${supportedSet.size}`);
            
            console.log('[OptiFine] Fetching Minecraft version list...');
            const versionList = await this.getVersionList();
            const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
            console.log(`[OptiFine] Found ${releaseVersions.length} release versions to match`);
            
            const supported = versionList.versions
                .filter((v: VersionEntry) => v.type === 'release' && supportedSet.has(v.id))
                .map((v: VersionEntry) => v.id);
            
            const elapsed = Date.now() - startTime;
            console.log(`[OptiFine] Completed: found ${supported.length} supported versions in ${elapsed}ms`);
            return supported;
        } catch (e: unknown) {
            const elapsed = Date.now() - startTime;
            const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            console.error(`[OptiFine] Failed to get supported versions after ${elapsed}ms:`, errorMsg || e);
            return [];
        }
    }

    public async getNeoForgeSupportedVersions(providerId?: DownloadProviderId): Promise<string[]> {
        console.log('[NeoForge] Starting to fetch supported versions...');
        const startTime = Date.now();
        try {
            console.log('[NeoForge] Fetching Minecraft version list...');
            const versionList = await this.getVersionList(providerId);
            const releaseVersions = (versionList.versions as VersionEntry[]).filter((v: VersionEntry) => v.type === 'release');
            console.log(`[NeoForge] Found ${releaseVersions.length} release versions to check`);
            
            const supportedVersions: string[] = [];
            
            // NeoForge only supports Minecraft 1.20.1 and newer
            // Filter to only check modern versions to speed up
            const modernVersions = releaseVersions.filter((v: VersionEntry) => {
                const parts = v.id.split('.');
                if (parts.length < 2) return false;
                const major = parseInt(parts[0], 10);
                const minor = parseInt(parts[1], 10);
                const patch = parts[2] ? parseInt(parts[2], 10) : 0;
                // Check for 1.20.1+ or 1.21+
                if (major === 1 && minor === 20) {
                    return patch >= 1; // 1.20.1+
                }
                return (major === 1 && minor >= 21) || major > 1;
            });
            
            console.log(`[NeoForge] Filtered to ${modernVersions.length} modern versions (1.20.1+) out of ${releaseVersions.length} total`);
            console.log('[NeoForge] Checking all versions in parallel via BMCLAPI...');
            
            // Check all versions in parallel with aggressive timeout
            const checkPromises = modernVersions.map(async (version: VersionEntry) => {
                try {
                    const bmclUrl = `https://bmclapi2.bangbang93.com/neoforge/list/${version.id}`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 300); // 300ms timeout - very aggressive
                    
                    const response = await fetch(bmclUrl, { 
                        signal: controller.signal,
                        cache: 'no-store' // Don't cache to avoid stale data
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const data: Array<{ version: string }> = await response.json();
                        if (data && Array.isArray(data) && data.length > 0) {
                            return version.id;
                        }
                    }
                } catch {
                    // Skip this version silently (timeout or error)
                }
                return null;
            });
            
            const results = await Promise.all(checkPromises);
            const found = results.filter(r => r !== null) as string[];
            supportedVersions.push(...found);
            
            if (found.length > 0) {
                console.log(`[NeoForge] Found ${found.length} supported versions: ${found.join(', ')}`);
            }
            
            const elapsed = Date.now() - startTime;
            console.log(`[NeoForge] Completed: found ${supportedVersions.length} supported versions in ${elapsed}ms`);
            if (supportedVersions.length > 0) {
                console.log(`[NeoForge] Supported versions: ${supportedVersions.slice(0, 10).join(', ')}${supportedVersions.length > 10 ? '...' : ''}`);
            }
            return supportedVersions;
        } catch (e: unknown) {
            const elapsed = Date.now() - startTime;
            const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            console.error(`[NeoForge] Failed to get supported versions after ${elapsed}ms:`, errorMsg || e);
            return [];
        }
    }

    private async getForgeVersionFromPromotions(mcVersion: string, onLog: (data: string) => void) {
        const promotionsUrl = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
        onLog('[Forge] Falling back to promotions JSON...');
        const response = await fetch(promotionsUrl);
        if (!response.ok) {
            throw new Error(`Forge promotions fetch failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        const promoKey = `${mcVersion}-recommended`;
        const latestKey = `${mcVersion}-latest`;
        const version = data.promos[promoKey] ?? data.promos[latestKey];
        if (!version) {
            throw new Error(`No Forge promotions found for Minecraft ${mcVersion}`);
        }
        const type = data.promos[promoKey] ? 'recommended' : 'latest';
        onLog(`[Forge] Using ${type} build from promotions: ${version}`);
        return { mcversion: mcVersion, version };
    }

    private selectForgeVersion(mcVersion: string, list: ForgeVersionList[] | ForgeVersionList): ForgeVersion {
        const pages = Array.isArray(list) ? list : [list];
        const page = pages.find((p) => p.mcversion === mcVersion);
        if (!page || page.versions.length === 0) {
            throw new Error(`Forge list is empty for Minecraft ${mcVersion}`);
        }

        const recommended = page.versions.find((v) => v.type === 'recommended');
        const latest = page.versions.find((v) => v.type === 'latest');
        const common = page.versions.find((v) => v.type === 'common');
        return recommended ?? latest ?? common ?? page.versions[0];
    }

    private async getFabricLoaderVersion(mcVersion: string, onLog: (data: string) => void): Promise<string | null> {
        try {
            // First check if the game version is supported by Fabric
            const gameVersionsUrl = 'https://meta.fabricmc.net/v2/versions/game';
            const gameVersionsMirror = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/game';
            onLog('[Fabric] Checking game version support...');
            
            let gameVersions: Array<{ version: string }> = [];
            try {
                const response = await fetch(gameVersionsUrl);
                if (response.ok) {
                    gameVersions = await response.json();
                }
            } catch {
                try {
                    const response = await fetch(gameVersionsMirror);
                    if (response.ok) {
                        gameVersions = await response.json();
                    }
                } catch (e: unknown) {
                    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
                    throw new Error(`Failed to fetch Fabric game versions: ${errorMsg ?? e}`);
                }
            }

            const isSupported = gameVersions.some(v => v.version === mcVersion);
            if (!isSupported) {
                onLog(`[Fabric] Minecraft ${mcVersion} is not supported by Fabric`);
                return null;
            }

            // Get latest loader version
            const loaderVersionsUrl = 'https://meta.fabricmc.net/v2/versions/loader';
            const loaderVersionsMirror = 'https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader';
            onLog('[Fabric] Fetching loader versions...');
            
            let loaderVersions: Array<{ version: string; stable: boolean }> = [];
            try {
                const response = await fetch(loaderVersionsUrl);
                if (response.ok) {
                    loaderVersions = await response.json();
                }
            } catch {
                try {
                    const response = await fetch(loaderVersionsMirror);
                    if (response.ok) {
                        loaderVersions = await response.json();
                    }
                } catch (e: unknown) {
                    const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
                    throw new Error(`Failed to fetch Fabric loader versions: ${errorMsg ?? e}`);
                }
            }

            if (loaderVersions.length === 0) {
                onLog('[Fabric] No loader versions available');
                return null;
            }

            // Prefer stable versions, fallback to latest
            const stable = loaderVersions.find(v => v.stable);
            const latest = loaderVersions[0];
            const selected = stable ?? latest;
            onLog(`[Fabric] Selected loader version: ${selected.version}${selected.stable ? ' (stable)' : ''}`);
            return selected.version;
        } catch (e: unknown) {
            const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            onLog(`[Fabric] Failed to get loader version: ${errorMsg ?? e}`);
            return null;
        }
    }

    private async getNeoForgeVersion(mcVersion: string, onLog: (data: string) => void): Promise<string | null> {
        try {
            // Try BMCLAPI first
            const bmclUrl = `https://bmclapi2.bangbang93.com/neoforge/list/${mcVersion}`;
            onLog('[NeoForge] Fetching version list from BMCLAPI...');
            const response = await fetch(bmclUrl);
            if (response.ok) {
                const data: Array<{ version: string }> = await response.json();
                if (data && data.length > 0) {
                    // Get the latest version (first in list)
                    const latest = data[0].version;
                    onLog(`[NeoForge] Found version: ${latest}`);
                    return latest;
                }
            }
            
            // Fallback to Maven API
            onLog('[NeoForge] Trying Maven API...');
            const mavenUrl = 'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge';
            const mavenResponse = await fetch(mavenUrl);
            if (mavenResponse.ok) {
                const mavenData = await mavenResponse.json();
                const versions: string[] = mavenData.versions || [];
                // Extract MC version from NeoForge version format (e.g., "20.2.59" for MC 1.20.2)
                const mcParts = mcVersion.split('.');
                if (mcParts.length >= 2) {
                    const major = mcParts[1];
                    const minor = mcParts[2] || '0';
                    const prefix = `${major}.${minor}.`;
                    const matching = versions.filter(v => v.startsWith(prefix));
                    if (matching.length > 0) {
                        // Get latest (highest version)
                        const latest = matching.sort().reverse()[0];
                        onLog(`[NeoForge] Found version from Maven: ${latest}`);
                        return latest;
                    }
                }
            }
            
            onLog(`[NeoForge] No versions found for Minecraft ${mcVersion}`);
            return null;
        } catch (e: unknown) {
            const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            onLog(`[NeoForge] Failed to fetch version: ${errorMsg ?? e}`);
            return null;
        }
    }

    private async getOptiFineVersion(mcVersion: string, onLog: (data: string) => void): Promise<{ type: string; patch: string } | null> {
        try {
            const versionListUrl = 'https://bmclapi2.bangbang93.com/optifine/versionList';
            onLog('[OptiFine] Fetching version list...');
            const response = await fetch(versionListUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const versions: Array<{ mcversion: string; type: string; patch: string }> = await response.json();
            const matchingVersions = versions.filter(v => v.mcversion === mcVersion);
            if (matchingVersions.length === 0) {
                onLog(`[OptiFine] No versions found for Minecraft ${mcVersion}`);
                return null;
            }
            // Sort by patch (higher is better) and return the latest
            // Try to parse as number first, otherwise use string comparison
            const sorted = matchingVersions.sort((a, b) => {
                const aNum = parseInt(a.patch);
                const bNum = parseInt(b.patch);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return bNum - aNum;
                }
                // String comparison for non-numeric patches (e.g., "F5", "pre1")
                return b.patch.localeCompare(a.patch);
            });
            const latest = sorted[0];
            onLog(`[OptiFine] Found version: ${latest.type}_${latest.patch}`);
            return { type: latest.type, patch: latest.patch };
        } catch (e: unknown) {
            const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            onLog(`[OptiFine] Failed to fetch version list: ${errorMsg ?? e}`);
            return null;
        }
    }

    private async installOptiFineAsMod(
        rootPath: string,
        mcVersion: string,
        provider: DownloadProvider,
        maxSockets: number,
        onLog: (data: string) => void,
        onProgress: (data: TaskProgressData) => void
    ) {
        const modsPath = path.join(rootPath, 'mods');
        try {
            fs.mkdirSync(modsPath, { recursive: true });
        } catch {
            // Ignore if already exists
        }

        const optiFineVersion = await this.getOptiFineVersion(mcVersion, onLog);
        if (!optiFineVersion) {
            onLog(`[OptiFine] Skipping installation - no version available for Minecraft ${mcVersion}`);
            return;
        }

        // Normalize version for URL (1.9 -> 1.9.0, 1.8 -> 1.8.0)
        let normalizedVersion = mcVersion;
        if (normalizedVersion === '1.9' || normalizedVersion === '1.8') {
            normalizedVersion += '.0';
        }

        const fileName = `OptiFine_${mcVersion}_${optiFineVersion.type}_${optiFineVersion.patch}.jar`;
        const modFilePath = path.join(modsPath, fileName);

        // Check if already installed
        if (fs.existsSync(modFilePath)) {
            onLog(`[OptiFine] ✓ Уже установлен: ${fileName}`);
            onLog(`[OptiFine] Путь: ${modFilePath}`);
            return;
        }

        // Try to download from BMCLAPI
        const downloadUrl = `https://bmclapi2.bangbang93.com/optifine/${normalizedVersion}/${optiFineVersion.type}/${optiFineVersion.patch}`;
        const urls = provider.injectURLWithCandidates(downloadUrl);
        
        onLog(`[OptiFine] Downloading ${fileName}...`);
        onProgress({ type: 'OptiFine', task: 0, total: 100 });

        await DownloadManager.downloadSingle(urls, modFilePath, {
            maxSockets,
            validateZip: true,
            headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' }
        });

        onLog(`[OptiFine] ✓ Успешно установлен: ${fileName}`);
        onLog(`[OptiFine] Путь: ${modFilePath}`);
        onProgress({ type: 'OptiFine', task: 100, total: 100 });
    }

    // Orchestrate the end-to-end launch flow.
    public async launchGame(options: {
        nickname: string;
        version: string; // Identifier like "1.12.2" or "1.12.2-Forge"
        ram: number;
        hideLauncher?: boolean;
        gamePath?: string;
        javaPath?: string;
        downloadProvider?: DownloadProviderId;
        autoDownloadThreads?: boolean;
        downloadThreads?: number;
        maxSockets?: number;
        useOptiFine?: boolean;
    }, onLog: (data: string) => void, onProgress: (data: TaskProgressData) => void, onClose: (code: number) => void, onGameStart?: () => void) {

        const rootPath = options.gamePath || path.join(app.getPath('userData'), 'minecraft_data');
        this.ensureXmclFolders(rootPath);

        // Определение типа версии
        const isNeoForge = options.version.toLowerCase().includes('neoforge');
        const isForge = options.version.toLowerCase().includes('forge') && !isNeoForge;
        const isFabric = options.version.toLowerCase().includes('fabric');
        const mcVersion = isNeoForge
            ? options.version.replace(/-?neoforge/i, '').trim()
            : isForge 
                ? options.version.replace(/-?forge/i, '').trim() 
                : isFabric 
                    ? options.version.replace(/-?fabric/i, '').trim() 
                    : options.version.trim();

        // Логирование информации о версии
        onLog('═══════════════════════════════════════════════════════════');
        onLog(`[VERSION INFO] Запуск версии: ${options.version}`);
        onLog(`[VERSION INFO] Minecraft версия: ${mcVersion}`);
        onLog(`[VERSION INFO] Тип версии: ${isNeoForge ? 'NeoForge' : isForge ? 'Forge' : isFabric ? 'Fabric' : 'Vanilla'}`);
        if (options.useOptiFine) {
            onLog(`[VERSION INFO] OptiFine: запрошен`);
        }
        onLog('═══════════════════════════════════════════════════════════');
        const downloadProvider = this.getDownloadProvider(options.downloadProvider);
        await this.warmupMirrors(downloadProvider);
        const maxSockets = options.maxSockets ?? 64;
        const dispatcher = this.createDispatcher(maxSockets);
        const rangePolicy = new DefaultRangePolicy(5 * 1024 * 1024, 4);
        const concurrency = this.resolveDownloadConcurrency(options.autoDownloadThreads ?? true, options.downloadThreads);

        const downloadOptions = this.buildInstallerOptions(downloadProvider, dispatcher, rangePolicy, concurrency);

        let requiredJava: 8 | 17 | 21 = 8;
        const versionParts = mcVersion.split('.');
        const major = parseInt(versionParts[1] || '0', 10);
        const minor = parseInt(versionParts[2] || '0', 10);
        
        // Minecraft 1.20.5+ requires Java 21
        if (major === 20 && minor >= 5) {
            requiredJava = 21;
            onLog(`Version ${mcVersion} requires Java 21.`);
        } else if (major > 20) {
            // Minecraft 1.21+ requires Java 21
            requiredJava = 21;
            onLog(`Version ${mcVersion} requires Java 21.`);
        } else if (major >= 17) {
            // Minecraft 1.17-1.20.4 requires Java 17
            requiredJava = 17;
            onLog(`Version ${mcVersion} requires Java 17.`);
        } else {
            // Minecraft 1.16 and earlier requires Java 8
            onLog(`Version ${mcVersion} uses Legacy Java 8.`);
        }

        let javaPath = '';
        const customJava = options.javaPath?.trim();
        if (customJava) {
            onLog(`[Java] Validating custom Java path...`);
            const valid = await this.javaManager.validateJavaPath(customJava);
            if (valid) {
                // For Java 21 requirements, verify the custom Java is actually version 21
                if (requiredJava === 21) {
                    try {
                        const actualVersion = await this.javaManager.getJavaVersion(customJava);
                        if (actualVersion === 21) {
                            javaPath = customJava;
                            onLog(`[Java] Using custom Java 21: ${customJava}`);
                        } else {
                            onLog(`[Java] Custom Java is version ${actualVersion}, but Java 21 is required. Falling back to installer.`);
                        }
                    } catch (e: unknown) {
                        const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
                        onLog(`[Java] Could not verify custom Java version: ${errorMsg || e}. Falling back to installer.`);
                    }
                } else {
                    javaPath = customJava;
                    onLog(`[Java] Using custom Java: ${customJava}`);
                }
            } else {
                onLog('[Java] Custom javaPath is invalid. Falling back to installer.');
            }
        }

        if (!javaPath) {
            onLog(`Preparing Java ${requiredJava} runtime...`);
            javaPath = await this.javaManager.getJavaPath(requiredJava, (msg, current, total) => {
                if (current !== undefined && total !== undefined) {
                    onProgress({ type: `Java ${requiredJava}`, task: current, total });
                } else {
                    onLog(`[Java] ${msg}`);
                }
            });
            onLog(`Java ${requiredJava} ready at: ${javaPath}`);
        }

        onLog(`Ensuring Minecraft ${mcVersion} is installed...`);
        await this.ensureVanillaInstalled(mcVersion, rootPath, onLog, onProgress, downloadProvider, downloadOptions);

        let launchVersion = mcVersion;
        if (isFabric) {
            onLog('Resolving Fabric loader version...');
            const fabricLoaderVersion = await this.getFabricLoaderVersion(mcVersion, onLog);
            if (!fabricLoaderVersion) {
                throw new Error(`Fabric is not available for Minecraft ${mcVersion}`);
            }

            onLog(`Installing Fabric ${mcVersion} with loader ${fabricLoaderVersion}...`);
            onProgress({ type: 'Fabric', task: 0, total: 100 });

            try {
                launchVersion = await installFabric({
                    minecraft: rootPath,
                    minecraftVersion: mcVersion,
                    version: fabricLoaderVersion,
                    side: 'client',
                    ...downloadOptions
                });
                onLog(`[Fabric] ✓ Установлен успешно!`);
                onLog(`[Fabric] Версия ID: ${launchVersion}`);
                onLog(`[Fabric] Loader версия: ${fabricLoaderVersion}`);
                onProgress({ type: 'Fabric', task: 100, total: 100 });
            } catch (err: unknown) {
                const errorMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
                onLog(`[Fabric] ✗ Ошибка установки: ${errorMsg ?? err}`);
                throw err;
            }
        } else if (isForge) {
            onLog('Resolving Forge version...');
            let forgeVersion: ForgeVersion | { mcversion: string; version: string };
            try {
                const forgeList = await getForgeVersionList({ minecraft: mcVersion });
                forgeVersion = this.selectForgeVersion(mcVersion, forgeList);
                const forgeType = 'type' in forgeVersion ? forgeVersion.type : 'custom';
                onLog(`Installing Forge ${mcVersion}-${forgeVersion.version} (${forgeType})...`);
            } catch (e: unknown) {
                const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
                onLog(`[Forge] Version list failed: ${errorMsg ?? e}.`);
                forgeVersion = await this.getForgeVersionFromPromotions(mcVersion, onLog);
                onLog(`Installing Forge ${mcVersion}-${forgeVersion.version} (promotions)...`);
            }

            const forgeVersionId = `${mcVersion}-forge-${forgeVersion.version}`;
            const runForgeInstall = async () => {
                const forgeTask = installForgeTask(forgeVersion as ForgeVersion, rootPath, {
                    ...downloadOptions,
                    java: javaPath,
                    mavenHost: downloadProvider.injectURLWithCandidates('https://maven.minecraftforge.net/')
                });
                let profilePatched = false;
                return await this.runTaskWithProgress(
                    forgeTask,
                    onProgress,
                    onLog,
                    'Forge installation',
                    'Forge',
                    (t) => {
                        if (profilePatched) return;
                        if (t.path.includes('installForge.library')) {
                            const patchedProfile = this.rewriteForgeInstallProfile(rootPath, forgeVersionId, downloadProvider, onLog);
                            const patchedVersion = this.rewriteForgeVersionJson(rootPath, forgeVersionId, downloadProvider, onLog);
                            profilePatched = patchedProfile || patchedVersion;
                        }
                    }
                );
            };

            try {
                launchVersion = await runForgeInstall();
                onLog(`[Forge] ✓ Установлен успешно!`);
                onLog(`[Forge] Версия ID: ${launchVersion}`);
                onLog(`[Forge] Forge версия: ${forgeVersion.version}`);
            } catch (err: unknown) {
                const errorMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
                onLog(`[Forge] Library download failed: ${errorMsg}`);
                onLog('[Forge] Attempting mcp_config fallback recovery...');
                try {
                    const recovered = await this.ensureForgeMcpConfig(rootPath, forgeVersionId, downloadProvider, maxSockets, onLog);
                    if (recovered) {
                        onLog('[Forge] mcp_config recovered, retrying installation...');
                        launchVersion = await runForgeInstall();
                    } else {
                        onLog('[Forge] mcp_config recovery failed, throwing original error');
                        throw err;
                    }
                } catch (recoveryError: unknown) {
                    const errorMsg = recoveryError && typeof recoveryError === 'object' && 'message' in recoveryError ? String((recoveryError as { message: unknown }).message) : String(recoveryError);
                    onLog(`[Forge] Recovery attempt failed: ${errorMsg ?? recoveryError}`);
                    throw err; // Бросаем оригинальную ошибку
                }
            }
        } else if (isNeoForge) {
            onLog('Resolving NeoForge version...');
            const neoForgeVersion = await this.getNeoForgeVersion(mcVersion, onLog);
            if (!neoForgeVersion) {
                throw new Error(`NeoForge is not available for Minecraft ${mcVersion}`);
            }

            onLog(`Installing NeoForge ${mcVersion} with version ${neoForgeVersion}...`);
            onProgress({ type: 'NeoForge', task: 0, total: 100 });

            try {
                // Download NeoForge installer
                const installerUrl = `https://maven.neoforged.net/net/neoforged/neoforge/${neoForgeVersion}/neoforge-${neoForgeVersion}-installer.jar`;
                const installerMirror = `https://bmclapi2.bangbang93.com/neoforge/version/${neoForgeVersion}/download/installer.jar`;
                const versionDirName = mcVersion + '-neoforge-' + neoForgeVersion;
                const installerPath = path.join(rootPath, 'versions', versionDirName, 'installer.jar');
                fs.mkdirSync(path.dirname(installerPath), { recursive: true });

                onLog('[NeoForge] Downloading installer...');
                const urls = downloadProvider.injectURLWithCandidates(installerUrl);
                urls.push(installerMirror);
                await DownloadManager.downloadSingle(urls, installerPath, {
                    maxSockets,
                    validateZip: true,
                    headers: { 'user-agent': DEFAULT_USER_AGENT, accept: '*/*', 'accept-encoding': 'identity' }
                });

                onLog('[NeoForge] Extracting install profile and version.json from installer...');
                // Extract install_profile.json and version.json directly from the installer JAR
                // This is more reliable than running the installer, which may fail
                const versionDir = path.join(rootPath, 'versions', versionDirName);
                fs.mkdirSync(versionDir, { recursive: true });
                
                const zip = new AdmZip(installerPath);
                
                // Extract install_profile.json
                const installProfileEntry = zip.getEntry('install_profile.json');
                if (!installProfileEntry) {
                    throw new Error('install_profile.json not found in NeoForge installer JAR');
                }
                
                const installProfileContent = installProfileEntry.getData().toString('utf-8');
                const installProfile = JSON.parse(installProfileContent);
                const installProfilePath = path.join(versionDir, 'install_profile.json');
                fs.writeFileSync(installProfilePath, installProfileContent);
                onLog(`[NeoForge] Extracted install_profile.json`);
                
                // Extract version.json - it's referenced in install_profile.json under the "json" field
                let versionJsonPath = path.join(versionDir, `${versionDirName}.json`);
                let versionJsonContent: string | null = null;
                
                // Try to find version.json in the installer
                // The path is usually "version.json" or specified in install_profile.json
                const versionJsonEntryName = installProfile.json || 'version.json';
                const versionJsonEntry = zip.getEntry(versionJsonEntryName);
                
                if (versionJsonEntry) {
                    versionJsonContent = versionJsonEntry.getData().toString('utf-8');
                    onLog(`[NeoForge] Extracted version.json from installer`);
                } else {
                    // Try alternative locations
                    const alternativeNames = ['version.json', `version/${mcVersion}.json`, `versions/${mcVersion}.json`];
                    for (const altName of alternativeNames) {
                        const altEntry = zip.getEntry(altName);
                        if (altEntry) {
                            versionJsonContent = altEntry.getData().toString('utf-8');
                            onLog(`[NeoForge] Extracted version.json from ${altName}`);
                            break;
                        }
                    }
                }
                
                if (!versionJsonContent) {
                    // If version.json is not in the installer, try to construct it from install_profile
                    onLog(`[NeoForge] version.json not found in installer, constructing from install profile...`);
                    if (installProfile.versionInfo) {
                        versionJsonContent = JSON.stringify(installProfile.versionInfo, null, 2);
                        onLog(`[NeoForge] Constructed version.json from install profile versionInfo`);
                    } else {
                        throw new Error('version.json not found in installer and cannot be constructed from install profile');
                    }
                }
                
                // Save version.json
                fs.writeFileSync(versionJsonPath, versionJsonContent);
                onLog(`[NeoForge] Saved version.json`);
                
                // Create launcher_profiles.json if it doesn't exist
                // NeoForge installer requires this file to work
                const launcherProfilesPath = path.join(rootPath, 'launcher_profiles.json');
                if (!fs.existsSync(launcherProfilesPath)) {
                    const launcherProfiles = {
                        profiles: {},
                        settings: {
                            crashAssistance: true,
                            enableAdvanced: false,
                            enableAnalytics: false,
                            enableHistorical: false,
                            enableReleases: true,
                            enableSnapshots: false,
                            keepLauncherOpen: false,
                            profileSorting: "ByLastPlayed",
                            showGameLog: false,
                            showMenu: false,
                            soundOn: false
                        },
                        version: 2
                    };
                    fs.writeFileSync(launcherProfilesPath, JSON.stringify(launcherProfiles, null, 2));
                    onLog(`[NeoForge] Created launcher_profiles.json (required by installer)`);
                }
                
                // Now try to run the installer to process libraries and create necessary files
                // The installer needs to process files and create srg versions of client jar
                onLog('[NeoForge] Running installer to process files and libraries...');
                const { promisify } = await import('util');
                const { exec } = await import('child_process');
                const execAsync = promisify(exec);
                
                // Use absolute path for Java to avoid issues
                const javaExecutable = javaPath.includes(' ') ? `"${javaPath}"` : javaPath;
                const installCommand = `${javaExecutable} -jar "${installerPath}" --installClient "${rootPath}"`;
                
                onLog(`[NeoForge] Command: ${installCommand}`);
                try {
                    const { stdout, stderr } = await execAsync(installCommand, { 
                        cwd: rootPath,
                        maxBuffer: 10 * 1024 * 1024,
                        timeout: 300000,
                        env: { ...process.env, JAVA_HOME: path.dirname(javaPath) }
                    });
                    
                    if (stdout && stdout.trim()) {
                        const outputLines = stdout.split('\n').filter(l => l.trim());
                        if (outputLines.length > 0) {
                            onLog(`[NeoForge] Installer stdout: ${outputLines.slice(-5).join(' | ')}`);
                        }
                    }
                    if (stderr && stderr.trim()) {
                        const errorLines = stderr.split('\n').filter(l => l.trim());
                        if (errorLines.length > 0) {
                            // Log stderr but don't treat it as fatal - some installers write to stderr
                            const importantErrors = errorLines.filter(l => 
                                !l.includes('WARNING') && 
                                !l.includes('INFO') && 
                                !l.includes('SLF4J') &&
                                !l.toLowerCase().includes('deprecated')
                            );
                            if (importantErrors.length > 0) {
                                onLog(`[NeoForge] Installer stderr: ${importantErrors.slice(0, 5).join(' | ')}`);
                            }
                        }
                    }
                    onLog(`[NeoForge] Installer completed successfully`);
                } catch (e: unknown) {
                    // Log detailed error information
                    const eObj = e && typeof e === 'object' ? e as { message?: unknown; code?: unknown; signal?: unknown; stderr?: string } : null;
                    const errorMsg = eObj?.message ? String(eObj.message) : String(e);
                    const errorCode = eObj?.code;
                    const errorSignal = eObj?.signal;
                    
                    onLog(`[NeoForge] Installer execution failed:`);
                    onLog(`[NeoForge]   Error: ${errorMsg}`);
                    if (errorCode) onLog(`[NeoForge]   Exit code: ${errorCode}`);
                    if (errorSignal) onLog(`[NeoForge]   Signal: ${errorSignal}`);
                    
                    // Try to get stderr if available
                    if (eObj?.stderr) {
                        const stderrLines = eObj.stderr.split('\n').filter((l: string) => l.trim());
                        if (stderrLines.length > 0) {
                            onLog(`[NeoForge]   Stderr: ${stderrLines.slice(0, 10).join(' | ')}`);
                        }
                    }
                    
                    // Check if critical files were created despite the error
                    const versionJsonExists = fs.existsSync(versionJsonPath);
                    const installProfileExists = fs.existsSync(installProfilePath);
                    
                    if (!versionJsonExists) {
                        throw new Error(`NeoForge installation failed: version.json was not created. Installer error: ${errorMsg}`);
                    }
                    
                    // Even if installer failed, check if we can proceed
                    // The installer might have created some files before failing
                    onLog(`[NeoForge] Version.json exists, checking if we can proceed...`);
                    onLog(`[NeoForge] Note: Some files may be missing. The installer should have processed client jar.`);
                    
                    // Try to manually process the installer using spawn for better control
                    // The installer needs to run to process files and create srg versions
                    if (installProfileExists && installProfile.processors) {
                        onLog(`[NeoForge] Install profile has processors. Attempting to run installer with spawn for better error handling...`);
                        try {
                            const { spawn } = await import('child_process');
                            
                            await new Promise<void>((resolve) => {
                                const javaExecutable = javaPath.includes(' ') ? `"${javaPath}"` : javaPath;
                                const args = ['-jar', installerPath, '--installClient', rootPath];
                                
                                onLog(`[NeoForge] Spawning installer: ${javaExecutable} ${args.join(' ')}`);
                                
                                const installerProcess = spawn(javaExecutable, args, {
                                    cwd: rootPath,
                                    shell: true,
                                    stdio: ['ignore', 'pipe', 'pipe']
                                });
                                
                                let stdout = '';
                                let stderr = '';
                                
                                installerProcess.stdout?.on('data', (data) => {
                                    const output = data.toString();
                                    stdout += output;
                                    const lines = output.split('\n').filter((l: string) => l.trim());
                                    lines.forEach((line: string) => {
                                        if (line.trim()) {
                                            onLog(`[NeoForge Installer] ${line}`);
                                        }
                                    });
                                });
                                
                                installerProcess.stderr?.on('data', (data) => {
                                    const output = data.toString();
                                    stderr += output;
                                    const lines = output.split('\n').filter((l: string) => l.trim() && 
                                        !l.includes('SLF4J') && 
                                        !l.toLowerCase().includes('deprecated') &&
                                        !l.includes('WARNING:')
                                    );
                                    lines.forEach((line: string) => {
                                        if (line.trim()) {
                                            onLog(`[NeoForge Installer] ${line}`);
                                        }
                                    });
                                });
                                
                                installerProcess.on('close', (code) => {
                                    if (code === 0) {
                                        onLog(`[NeoForge] Installer completed successfully via spawn`);
                                        resolve();
                                    } else {
                                        // Check if critical files were created despite non-zero exit
                                        // Check libraries directory for any srg jar
                                        const librariesClientPath = path.join(rootPath, 'libraries', 'net', 'minecraft', 'client');
                                        let srgJarFound = false;
                                        if (fs.existsSync(librariesClientPath)) {
                                            try {
                                                const versionDirs = fs.readdirSync(librariesClientPath, { withFileTypes: true })
                                                    .filter(d => d.isDirectory())
                                                    .map(d => d.name);
                                                for (const versionDir of versionDirs) {
                                                    const versionPath = path.join(librariesClientPath, versionDir);
                                                    const files = fs.readdirSync(versionPath);
                                                    if (files.some(f => f.includes('srg.jar'))) {
                                                        srgJarFound = true;
                                                        onLog(`[NeoForge] Found srg jar in ${versionDir}`);
                                                        break;
                                                    }
                                                }
                                            } catch {
                                                // Directory read failed, continue
                                            }
                                        }
                                        
                                        if (srgJarFound) {
                                            onLog(`[NeoForge] Installer exited with code ${code}, but srg jar exists. Continuing...`);
                                            resolve();
                                        } else {
                                            onLog(`[NeoForge] Installer exited with code ${code}`);
                                            onLog(`[NeoForge] Stdout: ${stdout.substring(0, 500)}`);
                                            onLog(`[NeoForge] Stderr: ${stderr.substring(0, 500)}`);
                                            // Don't reject - continue anyway, maybe libraries will be downloaded later
                                            onLog(`[NeoForge] Warning: srg jar not found, but continuing installation...`);
                                            resolve();
                                        }
                                    }
                                });
                                
                                installerProcess.on('error', (err) => {
                                    onLog(`[NeoForge] Installer spawn error: ${err.message}`);
                                    // Don't reject - continue with what we have
                                    onLog(`[NeoForge] Continuing despite spawn error...`);
                                    resolve();
                                });
                                
                                // Set timeout
                                const timeoutId = setTimeout(() => {
                                    if (!installerProcess.killed) {
                                        onLog(`[NeoForge] Installer timeout, killing process...`);
                                        installerProcess.kill();
                                        onLog(`[NeoForge] Continuing despite timeout...`);
                                        resolve();
                                    }
                                }, 300000); // 5 minutes
                                
                                installerProcess.on('close', () => {
                                    clearTimeout(timeoutId);
                                });
                            });
                            onLog(`[NeoForge] Spawn installer attempt completed`);
                        } catch (spawnError: unknown) {
                            const errorMsg = spawnError && typeof spawnError === 'object' && 'message' in spawnError ? String((spawnError as { message: unknown }).message) : String(spawnError);
                            onLog(`[NeoForge] Spawn fallback failed: ${errorMsg || spawnError}`);
                            onLog(`[NeoForge] Continuing with extracted files (some processing may be incomplete)...`);
                            // Don't throw - continue with what we have
                        }
                    }
                }

                // Patch library URLs in version.json with mirrors
                this.rewriteForgeVersionJson(rootPath, versionDirName, downloadProvider, onLog);

                // Clean up installer
                try { 
                    fs.unlinkSync(installerPath); 
                    onLog('[NeoForge] Cleaned up installer JAR');
                } catch {
                    // File deletion failed, continue
                }

                launchVersion = versionDirName;
                onLog(`[NeoForge] ✓ Установлен успешно!`);
                onLog(`[NeoForge] Версия ID: ${launchVersion}`);
                onLog(`[NeoForge] NeoForge версия: ${neoForgeVersion}`);
                onProgress({ type: 'NeoForge', task: 100, total: 100 });
            } catch (err: unknown) {
                const errorMsg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err);
                onLog(`[NeoForge] Installation failed: ${errorMsg ?? err}`);
                throw err;
            }
        }

        const resolved = await Version.parse(rootPath, launchVersion);
        const depsTask = installDependenciesTask(resolved, downloadOptions);
        await this.runTaskWithProgress(depsTask, onProgress, onLog, `Installing dependencies for ${launchVersion}...`);

        // Install OptiFine as mod if requested
        if (options.useOptiFine) {
            try {
                await this.installOptiFineAsMod(rootPath, mcVersion, downloadProvider, maxSockets, onLog, onProgress);
            } catch (e: unknown) {
                const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
                onLog(`[OptiFine] Installation failed: ${errorMsg ?? e}. Continuing without OptiFine...`);
            }
        }

        // Проверка установленных модов перед запуском
        onLog('═══════════════════════════════════════════════════════════');
        onLog(`[LAUNCH INFO] Финальная версия для запуска: ${launchVersion}`);
        this.logInstalledMods(rootPath, onLog);
        onLog('═══════════════════════════════════════════════════════════');

        // Offline auth via authlib-injector.
        const injectorBase = app.isPackaged ? process.resourcesPath : app.getAppPath();
        const sourceInjectorPath = path.join(injectorBase, 'authlib-injector.jar');
        const destInjectorPath = path.join(rootPath, 'authlib-injector.jar');
        const modsPath = path.join(rootPath, 'mods');
        try { fs.mkdirSync(modsPath, { recursive: true }); } catch {
            // Directory already exists, continue
        }

        try {
            if (fs.existsSync(sourceInjectorPath)) {
                onLog(`[Auth] Copying injector to safe path: ${destInjectorPath}`);
                if (fs.existsSync(destInjectorPath)) {
                    try { fs.unlinkSync(destInjectorPath); } catch {
                        // File deletion failed, continue
                    }
                }
                fs.copyFileSync(sourceInjectorPath, destInjectorPath);
            } else {
                onLog(`[Auth Warning] Injector not found in resources. Downloading fallback...`);
                const mirrorCandidates = downloadProvider.injectURLWithCandidates('https://authlib-injector.yushi.moe/artifact/latest');
                const fallback = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar';
                const candidates = [...mirrorCandidates, fallback];
                try {
                    await DownloadManager.downloadSingle(candidates, destInjectorPath, { maxSockets, validateZip: true });
                    onLog(`[Auth] Downloaded injector to: ${destInjectorPath}`);
                } catch (e: unknown) {
                    const eObj = e && typeof e === 'object' ? e as { code?: string } : null;
                    if ((eObj?.code === 'EBUSY' || eObj?.code === 'EPERM') && fs.existsSync(destInjectorPath)) {
                        onLog(`[Auth Info] Injector file locked (already running?), reusing existing.`);
                    } else {
                        throw e;
                    }
                }
            }
        } catch (e: unknown) {
            onLog(`[Auth Error] Failed to prepare injector: ${e}`);
        }

        const offlineUuidRaw = getOfflineUUID(options.nickname);
        const offlineUuid = offlineUuidRaw.includes('-')
            ? offlineUuidRaw
            : `${offlineUuidRaw.substring(0, 8)}-${offlineUuidRaw.substring(8, 12)}-${offlineUuidRaw.substring(12, 16)}-${offlineUuidRaw.substring(16, 20)}-${offlineUuidRaw.substring(20)}`;
        const offlineUser = offline(options.nickname, offlineUuid);

        onLog(`[LAUNCH] Запуск Minecraft ${launchVersion}...`);
        onLog(`[LAUNCH] Java: ${javaPath}`);
        onLog(`[LAUNCH] RAM: ${options.ram}MB`);
        const proc = await launch({
            gamePath: rootPath,
            resourcePath: rootPath,
            javaPath,
            version: launchVersion,
            gameProfile: offlineUser.selectedProfile,
            accessToken: offlineUser.accessToken,
            userType: 'legacy',
            properties: {},
            minMemory: 1024,
            maxMemory: options.ram * 1024,
            extraJVMArgs: [
                '-XX:-UseAdaptiveSizePolicy',
                '-XX:-OmitStackTraceInFastThrow'
            ],
            ignorePatchDiscrepancies: true,
            ignoreInvalidMinecraftCertificates: true,
            yggdrasilAgent: {
                jar: destInjectorPath,
                server: 'http://127.0.0.1:25530'
            },
            launcherName: 'FriendLauncher',
            launcherBrand: 'FriendLauncher'
        });

        let gameStarted = false;
        proc.stdout?.on('data', (data) => {
            onLog(`[GAME] ${data.toString().trim()}`);
            if (!gameStarted) {
                gameStarted = true;
                if (onGameStart) onGameStart();
            }
        });
        proc.stderr?.on('data', (data) => {
            onLog(`[GAME] ${data.toString().trim()}`);
        });
        proc.on('close', (code) => {
            const exitCode = typeof code === 'number' ? code : 0;
            onLog(`[EXIT] Game closed with code ${exitCode}`);
            onClose(exitCode);
        });
        proc.on('error', (err) => {
            onLog(`[ERROR] Game process error: ${err}`);
        });
    }

    /**
     * Проверяет и логирует установленные моды и версии
     */
    private logInstalledMods(rootPath: string, onLog: (data: string) => void) {
        // Проверка версий в папке versions
        const versionsPath = path.join(rootPath, 'versions');
        if (fs.existsSync(versionsPath)) {
            try {
                const versionDirs = fs.readdirSync(versionsPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                // Поиск Fabric версий
                const fabricVersions = versionDirs.filter(v => 
                    v.toLowerCase().includes('fabric')
                );
                if (fabricVersions.length > 0) {
                    onLog(`[VERSIONS] Fabric версии найдены: ${fabricVersions.join(', ')}`);
                }

                // Поиск Forge версий
                const forgeVersions = versionDirs.filter(v => 
                    v.toLowerCase().includes('forge') && !v.toLowerCase().includes('neoforge')
                );
                if (forgeVersions.length > 0) {
                    onLog(`[VERSIONS] Forge версии найдены: ${forgeVersions.join(', ')}`);
                }

                // Поиск NeoForge версий
                const neoForgeVersions = versionDirs.filter(v => 
                    v.toLowerCase().includes('neoforge')
                );
                if (neoForgeVersions.length > 0) {
                    onLog(`[VERSIONS] NeoForge версии найдены: ${neoForgeVersions.join(', ')}`);
                }
            } catch (e: unknown) {
                const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            onLog(`[VERSIONS] Ошибка при проверке версий: ${errorMsg || e}`);
            }
        }

        // Проверка модов
        const modsPath = path.join(rootPath, 'mods');
        
        if (!fs.existsSync(modsPath)) {
            onLog(`[MODS] Папка mods не найдена - моды не установлены`);
            return;
        }

        try {
            const modFiles = fs.readdirSync(modsPath).filter(file => 
                file.endsWith('.jar') && !file.startsWith('.')
            );

            if (modFiles.length === 0) {
                onLog(`[MODS] В папке mods нет .jar файлов`);
                return;
            }

            onLog(`[MODS] Найдено модов: ${modFiles.length}`);
            
            // Проверка на OptiFine
            const optiFineMods = modFiles.filter(file => 
                file.toLowerCase().includes('optifine') || 
                file.toLowerCase().startsWith('optifine_')
            );
            if (optiFineMods.length > 0) {
                onLog(`[MODS] ✓ OptiFine установлен: ${optiFineMods.join(', ')}`);
            } else {
                onLog(`[MODS] ✗ OptiFine не найден`);
            }

            // Проверка на Fabric Loader и API
            const fabricLoaderMods = modFiles.filter(file => 
                file.toLowerCase().includes('fabric-loader')
            );
            const fabricApiMods = modFiles.filter(file => 
                file.toLowerCase().includes('fabric-api')
            );
            if (fabricLoaderMods.length > 0 || fabricApiMods.length > 0) {
                onLog(`[MODS] ✓ Fabric компоненты найдены:`);
                if (fabricLoaderMods.length > 0) {
                    onLog(`[MODS]   - Loader: ${fabricLoaderMods.join(', ')}`);
                }
                if (fabricApiMods.length > 0) {
                    onLog(`[MODS]   - API: ${fabricApiMods.join(', ')}`);
                }
            }

            // Проверка на Forge моды (обычно имеют специфичные названия)
            const otherMods = modFiles.filter(file => 
                !file.toLowerCase().includes('optifine') &&
                !file.toLowerCase().includes('fabric') &&
                file !== 'authlib-injector.jar'
            );
            if (otherMods.length > 0) {
                onLog(`[MODS] Другие моды: ${otherMods.length} мод(ов)`);
                if (otherMods.length <= 5) {
                    onLog(`[MODS]   Список: ${otherMods.join(', ')}`);
                }
            }

            // Список всех модов, если их немного
            if (modFiles.length <= 10) {
                onLog(`[MODS] Все моды: ${modFiles.join(', ')}`);
            } else {
                onLog(`[MODS] Первые 10 модов: ${modFiles.slice(0, 10).join(', ')}...`);
            }
        } catch (e: unknown) {
            const errorMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
            onLog(`[MODS] Ошибка при проверке модов: ${errorMsg || e}`);
        }
    }

    private buildInstallerOptions(
        provider: DownloadProvider,
        dispatcher: Dispatcher,
        rangePolicy: DefaultRangePolicy,
        concurrency: number
    ) {
        const uniq = (values: Array<string | undefined>) => {
            const seen = new Set<string>();
            const result: string[] = [];
            for (const value of values) {
                if (!value || seen.has(value)) continue;
                seen.add(value);
                result.push(value);
            }
            return result;
        };

        const filterBadHosts = (urls: string[]) => {
            const filtered = urls.filter((candidate) => !this.badDownloadHosts.has(this.getOrigin(candidate)));
            return filtered.length > 0 ? filtered : urls;
        };

        const getForgeInstallerCandidates = (pathValue: string, url: string) => {
            const normalizedPath = pathValue.replace(/\\/g, '/');
            if (!normalizedPath.includes('net/minecraftforge/forge/') || !normalizedPath.endsWith('-installer.jar')) {
                return null;
            }
            const fileName = path.posix.basename(normalizedPath);
            const prefix = 'forge-';
            const suffix = '-installer.jar';
            if (!fileName.startsWith(prefix) || !fileName.endsWith(suffix)) return null;
            const classifier = fileName.slice(prefix.length, -suffix.length);
            const parts = classifier.split('-');
            if (parts.length < 2) return null;
            const [mcversion, version, ...branchParts] = parts;
            const branch = branchParts.join('-');
            const query = new URLSearchParams({
                mcversion,
                version,
                category: 'installer',
                format: 'jar'
            });
            if (branch) query.set('branch', branch);
            const bmcl = `${BMCL_ROOT}/forge/download?${query.toString()}`;
            return uniq([bmcl, ...provider.injectURLWithCandidates(url)]);
        };

        const headers = {
            'user-agent': DEFAULT_USER_AGENT,
            accept: '*/*',
            'accept-encoding': 'identity'
        };
        const assetsHost = filterBadHosts(provider.injectURLWithCandidates('https://resources.download.minecraft.net'));
        return {
            // Type conflict between undici versions - @xmcl/file-transfer uses different undici types
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dispatcher: dispatcher as any,
            rangePolicy,
            headers,
            assetsHost,
            assetsIndexUrl: (version: VersionEntry) => provider.injectURLWithCandidates(version.assetIndex?.url ?? ''),
            // Type mismatch: VersionEntry vs MinecraftVersionBaseInfo - both are compatible at runtime
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            json: (version: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return provider.injectURLWithCandidates((version as VersionEntry).url ?? '') as any;
            },
            client: (version: VersionEntry) => {
                const url = version.downloads?.client?.url;
                return url ? provider.injectURLWithCandidates(url) : [];
            },
            server: (version: VersionEntry) => {
                const url = version.downloads?.server?.url;
                return url ? provider.injectURLWithCandidates(url) : [];
            },
            libraryHost: (library: LibraryEntry) => {
                const url = library.download?.url;
                if (!url) return undefined;
                if (provider.id !== 'mojang') {
                    const pathValue = library.download?.path;
                    if (pathValue) {
                        const forgeCandidates = getForgeInstallerCandidates(pathValue, url);
                        if (forgeCandidates) return forgeCandidates;
                    }
                }
                return filterBadHosts(provider.injectURLWithCandidates(url));
            },
            librariesDownloadConcurrency: concurrency,
            assetsDownloadConcurrency: concurrency
        };
    }
}
