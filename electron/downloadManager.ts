import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import AdmZip from 'adm-zip';
import { Agent, interceptors, type Dispatcher } from 'undici';
import { DefaultRangePolicy, download, type ChecksumValidatorOptions } from '@xmcl/file-transfer';
import { reportMirrorFailure, reportMirrorSuccess } from './mirrors';

type ETagEntry = {
    etag?: string;
    lastModified?: string;
    updatedAt: number;
};

type DownloadSingleOptions = {
    checksum?: ChecksumValidatorOptions;
    expectedTotal?: number;
    headers?: Record<string, string>;
    maxRedirections?: number;
    retryCount?: number;
    maxSockets?: number;
    rangeThresholdBytes?: number;
    rangeConcurrency?: number;
    validateZip?: boolean;
    dispatcher?: Dispatcher;
};

const CACHE_FILENAME = 'download-cache.json';
const DEFAULT_RANGE_THRESHOLD = 5 * 1024 * 1024;
const DEFAULT_RANGE_CONCURRENCY = 4;
const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// Увеличенные таймауты для медленных соединений (особенно для пользователей из России)
const DEFAULT_CONNECT_TIMEOUT = 30_000; // 30 секунд вместо 10
const DEFAULT_HEADERS_TIMEOUT = 60_000; // 60 секунд вместо 15
const DEFAULT_BODY_TIMEOUT = 180_000; // 3 минуты - достаточно для медленных соединений, но отслеживание прогресса прервет раньше
// Таймаут отсутствия прогресса - если загрузка не прогрессирует, переключаемся на следующий источник
const PROGRESS_STALL_TIMEOUT = 20_000; // 20 секунд без прогресса
const PROGRESS_CHECK_INTERVAL = 2_000; // Проверяем каждые 2 секунды
const HTML_PROBE_BYTES = 16 * 1024;
const HTML_CHALLENGE_MARKERS = [
    /verifying your browser/i,
    /attention required/i,
    /cloudflare/i,
    /js required/i,
    /enable javascript/i,
    /browser verification/i
];

class ETagCache {
    private static loaded = false;
    private static cache: Record<string, ETagEntry> = {};
    private static filePath(): string {
        return path.join(app.getPath('userData'), CACHE_FILENAME);
    }

    private static loadIfNeeded() {
        if (this.loaded) return;
        this.loaded = true;
        try {
            const raw = fs.readFileSync(this.filePath(), 'utf-8');
            this.cache = JSON.parse(raw);
        } catch {
            this.cache = {};
        }
    }

    static get(url: string): ETagEntry | undefined {
        this.loadIfNeeded();
        return this.cache[url];
    }

    static set(url: string, entry: ETagEntry) {
        this.loadIfNeeded();
        this.cache[url] = entry;
        try {
            fs.mkdirSync(path.dirname(this.filePath()), { recursive: true });
            fs.writeFileSync(this.filePath(), JSON.stringify(this.cache, null, 2));
        } catch {
            // Ignore cache write failures.
        }
    }
}

const dispatcherCache = new Map<string, Dispatcher>();

const getDispatcher = (maxSockets = 64, retryCount = 5, maxRedirections = 5): Dispatcher => {
    // Используем комбинацию параметров для кеширования, чтобы разные retryCount создавали разные dispatcher'ы
    const key = `${maxSockets}-${retryCount}`;
    const cached = dispatcherCache.get(key);
    if (cached) return cached;
    const agent = new Agent({
        connections: maxSockets,
        connectTimeout: DEFAULT_CONNECT_TIMEOUT,
        headersTimeout: DEFAULT_HEADERS_TIMEOUT,
        bodyTimeout: DEFAULT_BODY_TIMEOUT
    }).compose(
        interceptors.retry({ maxRetries: retryCount }),
        interceptors.redirect({ maxRedirections })
    );
    dispatcherCache.set(key, agent);
    return agent;
};

const shouldValidateZip = (dest: string, explicit?: boolean) => {
    if (explicit !== undefined) return explicit;
    return dest.endsWith('.jar') || dest.endsWith('.zip');
};

const normalizeHeaders = (headers?: Record<string, string>) => {
    const result = { ...(headers ?? {}) };
    const hasUserAgent = Object.keys(result).some((key) => key.toLowerCase() === 'user-agent');
    if (!hasUserAgent) result['user-agent'] = DEFAULT_USER_AGENT;
    return result;
};

const readFileSnippet = (filePath: string, limit: number) => {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(limit);
        const bytesRead = fs.readSync(fd, buffer, 0, limit, 0);
        fs.closeSync(fd);
        return buffer.slice(0, bytesRead).toString('utf8');
    } catch {
        return '';
    }
};

const isHtmlChallenge = (snippet: string, contentType?: string | null) => {
    const trimmed = snippet.trimStart().toLowerCase();
    if (contentType?.includes('text/html')) return true;
    if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return true;
    return HTML_CHALLENGE_MARKERS.some((pattern) => pattern.test(snippet));
};

const readResponseSnippet = async (res: Response, limitBytes: number) => {
    const reader = res.body?.getReader?.();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
        while (received < limitBytes) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!value) continue;
            const remaining = limitBytes - received;
            const slice = value.length > remaining ? value.slice(0, remaining) : value;
            chunks.push(slice);
            received += slice.length;
            if (received >= limitBytes) break;
        }
    } finally {
        try {
            await reader.cancel();
        } catch {
            // ignore
        }
    }
    return Buffer.concat(chunks).toString('utf8');
};

const probeHtmlChallenge = async (url: string, headers: Record<string, string>, dispatcher: Dispatcher) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                ...headers,
                range: 'bytes=0-16383',
                accept: '*/*'
            },
            signal: controller.signal,
            dispatcher
        } as Parameters<typeof fetch>[1] & { dispatcher?: unknown });
        const contentType = res.headers.get('content-type');
        const snippet = await readResponseSnippet(res, HTML_PROBE_BYTES);
        if (isHtmlChallenge(snippet, contentType)) {
            return { blocked: true, status: res.status, contentType };
        }
    } catch {
        // Ignore probe failures and fallback to download.
    } finally {
        clearTimeout(timeout);
    }
    return { blocked: false };
};

const validateZipIntegrity = async (dest: string) => {
    try {
        const zip = new AdmZip(dest);
        zip.getEntries();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Invalid archive: ${errorMessage}`);
    }
};

const updateEtagCacheFromResponse = (url: string, res: Response) => {
    const etag = res.headers.get('etag') ?? undefined;
    const lastModified = res.headers.get('last-modified') ?? undefined;
    if (!etag && !lastModified) return;
    ETagCache.set(url, { etag, lastModified, updatedAt: Date.now() });
};

const tryConditionalHead = async (url: string, entry?: ETagEntry) => {
    if (!entry) return { skip: false };
    const headers: Record<string, string> = {};
    if (entry.etag) headers['if-none-match'] = entry.etag;
    if (entry.lastModified) headers['if-modified-since'] = entry.lastModified;
    try {
        const res = await fetch(url, { method: 'HEAD', headers });
        if (res.status === 304) {
            return { skip: true };
        }
        if (res.ok) {
            updateEtagCacheFromResponse(url, res);
        }
    } catch {
        // Ignore HEAD errors and fallback to download.
    }
    return { skip: false };
};

/**
 * Мониторит прогресс загрузки файла и прерывает, если прогресс остановился
 * @param pendingFile Путь к .pending файлу
 * @param abortController Контроллер для прерывания загрузки
 * @returns Функция для остановки мониторинга
 */
const monitorDownloadProgress = (pendingFile: string, abortController: AbortController): (() => void) => {
    let lastSize = 0;
    let lastProgressTime = Date.now();
    let isMonitoring = true;

    const checkProgress = () => {
        if (!isMonitoring) return;

        try {
            if (fs.existsSync(pendingFile)) {
                const stats = fs.statSync(pendingFile);
                const currentSize = stats.size;

                if (currentSize > lastSize) {
                    // Есть прогресс - обновляем время последнего прогресса
                    lastSize = currentSize;
                    lastProgressTime = Date.now();
                } else {
                    // Нет прогресса - проверяем, не прошло ли слишком много времени
                    const timeSinceProgress = Date.now() - lastProgressTime;
                    if (timeSinceProgress >= PROGRESS_STALL_TIMEOUT) {
                        // Прогресс остановился - прерываем загрузку
                        isMonitoring = false;
                        abortController.abort();
                        return;
                    }
                }
            } else {
                // Файл еще не создан - если прошло много времени, прерываем
                const timeSinceStart = Date.now() - lastProgressTime;
                if (timeSinceStart >= PROGRESS_STALL_TIMEOUT) {
                    isMonitoring = false;
                    abortController.abort();
                    return;
                }
            }
        } catch {
            // Игнорируем ошибки проверки файла
        }

        if (isMonitoring) {
            setTimeout(checkProgress, PROGRESS_CHECK_INTERVAL);
        }
    };

    lastProgressTime = Date.now();
    setTimeout(checkProgress, PROGRESS_CHECK_INTERVAL);

    return () => {
        isMonitoring = false;
    };
};

// Robust file downloader with fallback, checksum, and range support.
export class DownloadManager {
    /**
     * Download a single file from URL to destination.
     * @param url Source URL or URL candidates
     * @param dest Destination absolute path
     */
    public static async downloadSingle(url: string | string[], dest: string, options: DownloadSingleOptions = {}): Promise<void> {
        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const candidates = Array.isArray(url) ? url : [url];
        const rangePolicy = new DefaultRangePolicy(
            options.rangeThresholdBytes ?? DEFAULT_RANGE_THRESHOLD,
            options.rangeConcurrency ?? DEFAULT_RANGE_CONCURRENCY
        );
        const dispatcher = options.dispatcher ?? getDispatcher(options.maxSockets, options.retryCount, options.maxRedirections);
        const headers = normalizeHeaders(options.headers);
        const shouldProbe = !options.checksum && !shouldValidateZip(dest, options.validateZip);
        const pendingFile = `${dest}.pending`;

        // Удаляем старые .pending файлы перед началом загрузки, чтобы избежать использования битых файлов
        try {
            if (fs.existsSync(pendingFile)) {
                fs.unlinkSync(pendingFile);
            }
        } catch {
            // Игнорируем ошибки удаления
        }

        const errors: Error[] = [];
        for (const candidate of candidates) {
            const startedAt = Date.now();
            let downloaded = false;
            try {
                const cacheEntry = ETagCache.get(candidate);
                if (fs.existsSync(dest)) {
                    const { skip } = await tryConditionalHead(candidate, cacheEntry);
                    if (skip) {
                        reportMirrorSuccess(candidate, Date.now() - startedAt);
                        return;
                    }
                }

                if (shouldProbe) {
                    const probe = await probeHtmlChallenge(candidate, headers, dispatcher);
                    if (probe.blocked) {
                        throw new Error(`Mirror returned HTML challenge (${probe.status ?? 'unknown'})`);
                    }
                }

                // Отслеживаем прогресс загрузки и прерываем, если прогресс остановился
                const progressAbortController = new AbortController();
                const stopMonitoring = monitorDownloadProgress(pendingFile, progressAbortController);

                try {
                    // Запускаем загрузку и мониторинг прогресса параллельно
                    const downloadPromise = download({
                        url: candidate,
                        destination: dest,
                        pendingFile,
                        headers,
                        expectedTotal: options.expectedTotal,
                        validator: options.checksum,
                        // Type conflict between undici versions - @xmcl/file-transfer uses different undici types
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        dispatcher: dispatcher as any,
                        rangePolicy
                    });

                    // Создаем Promise, который отклонится, если прогресс остановился
                    const progressMonitorPromise = new Promise<never>((_, reject) => {
                        progressAbortController.signal.addEventListener('abort', () => {
                            // Удаляем pending файл, чтобы download не мог его использовать
                            try {
                                if (fs.existsSync(pendingFile)) {
                                    fs.unlinkSync(pendingFile);
                                }
                            } catch {
                                // Игнорируем ошибки удаления
                            }
                            reject(new Error(`Download stalled - no progress for ${PROGRESS_STALL_TIMEOUT / 1000}s`));
                        });
                    });

                    // Ждем либо завершения загрузки, либо остановки прогресса
                    await Promise.race([downloadPromise, progressMonitorPromise]);
                } catch (downloadErr) {
                    stopMonitoring();
                    // Если загрузка была прервана из-за отсутствия прогресса, пробуем следующий источник
                    const errorMessage = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
                    if (errorMessage.includes('stalled')) {
                        // Убеждаемся, что pending файл удален
                        try {
                            if (fs.existsSync(pendingFile)) {
                                fs.unlinkSync(pendingFile);
                            }
                        } catch {
                            // Игнорируем ошибки удаления
                        }
                        throw downloadErr;
                    }
                    throw downloadErr;
                } finally {
                    stopMonitoring();
                }
                downloaded = true;

                if (shouldProbe) {
                    const snippet = readFileSnippet(dest, HTML_PROBE_BYTES);
                    if (isHtmlChallenge(snippet, null)) {
                        throw new Error('Downloaded HTML challenge instead of file');
                    }
                }

                if (shouldValidateZip(dest, options.validateZip)) {
                    await validateZipIntegrity(dest);
                }

                reportMirrorSuccess(candidate, Date.now() - startedAt);
                try {
                    const res = await fetch(candidate, { method: 'HEAD' });
                    if (res.ok) updateEtagCacheFromResponse(candidate, res);
                } catch {
                    // ignore cache update errors
                }
                return;
            } catch (err) {
                reportMirrorFailure(candidate);
                errors.push(err instanceof Error ? err : new Error(String(err)));
                try {
                    if (downloaded && fs.existsSync(dest)) fs.unlinkSync(dest);
                    if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
                } catch {
                    // ignore cleanup errors
                }
            }
        }
        if (errors.length > 1) {
            const combined = new Error('All download candidates failed');
            (combined as Error & { errors?: Error[] }).errors = errors;
            throw combined;
        }
        throw errors[0];
    }
}
