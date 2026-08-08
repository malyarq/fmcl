import fs from 'fs-extra';
import path from 'node:path';
import type {
    ShaderPackAcquisitionIssue,
    ShaderPackAcquisitionIssueStatus,
    ShaderPackAcquisitionResult,
} from '../../../shared/contracts/shaders';
import { assertAbsolutePath, assertChildName, resolvePathWithinRoot } from '../../security/pathGuards';
import { resolveApprovedInstancePath, resolveShaderPacksDir } from '../instances/paths';
import { openValidatedZip } from '../../security/archivePolicy';

export interface ShaderPack {
    fileName: string;
    name: string;
    isActive: boolean;
}

export class ShadersService {
    private createAcquisitionIssue(
        fileName: string,
        status: ShaderPackAcquisitionIssueStatus,
        message: string,
    ): ShaderPackAcquisitionIssue {
        return { fileName, status, message };
    }

    private createAcquisitionResult(
        status: ShaderPackAcquisitionResult['status'],
        importedFileNames: string[] = [],
        issues: ShaderPackAcquisitionIssue[] = [],
    ): ShaderPackAcquisitionResult {
        return { status, importedFileNames, issues };
    }

    private async hasShaderPayload(filePath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(filePath);

            if (stat.isDirectory()) {
                return await fs.pathExists(path.join(filePath, 'shaders'));
            }

            if (!filePath.toLowerCase().endsWith('.zip')) {
                return false;
            }

            const zip = await openValidatedZip(filePath, 'Shader archive');
            try {
                return zip.getEntries().some((entry) => entry.fileName.startsWith('shaders/'));
            } finally {
                zip.close();
            }
        } catch {
            return false;
        }
    }

    /**
     * Get the shaderpacks directory path for an instance.
     */
    private getShaderPacksDir(instancePath: string): string {
        return resolveShaderPacksDir(instancePath);
    }

    /**
     * Get the optionsshaders.txt path for an instance.
     */
    private getOptionsPath(instancePath: string): string {
        return resolvePathWithinRoot(
            resolveApprovedInstancePath(instancePath),
            'optionsshaders.txt',
            'Shader options path',
        );
    }

    /**
     * Read the currently active shader from optionsshaders.txt.
     * Returns "(internal)" or the shader name, or null if not set.
     */
    private async getActiveShader(instancePath: string): Promise<string | null> {
        const optionsPath = this.getOptionsPath(instancePath);
        try {
            const content = await fs.readFile(optionsPath, 'utf-8');
            // Look for line like: shaderPack=SEUS-Renewed-v1.0.1.zip
            const match = content.match(/^shaderPack=(.+)$/m);
            if (match) {
                return match[1].trim();
            }
            return null;
        } catch {
            return null; // File doesn't exist or can't be read
        }
    }

    /**
     * Set the active shader in optionsshaders.txt.
     * @param shaderName The shader filename, or "(internal)" for no shader.
     */
    async setActiveShader(shaderName: string, instancePath: string): Promise<void> {
        const safeShaderName = shaderName === '(internal)'
            ? shaderName
            : assertChildName(shaderName, 'Shader pack name');
        const optionsPath = this.getOptionsPath(instancePath);
        let content = '';

        try {
            content = await fs.readFile(optionsPath, 'utf-8');
        } catch {
            // File doesn't exist, create it
            content = '';
        }

        const shaderPackLine = `shaderPack=${safeShaderName}`;

        if (content.match(/^shaderPack=.+$/m)) {
            // Replace existing line
            content = content.replace(/^shaderPack=.+$/m, shaderPackLine);
        } else {
            // Add new line
            content = content.trim() + '\n' + shaderPackLine + '\n';
        }

        await fs.writeFile(optionsPath, content, 'utf-8');
    }

    /**
     * List all shader packs in the instance's shaderpacks folder.
     */
    async list(instancePath: string): Promise<ShaderPack[]> {
        const shaderDir = this.getShaderPacksDir(instancePath);
        const activeShader = await this.getActiveShader(instancePath);

        let entries: string[] = [];
        try {
            entries = await fs.readdir(shaderDir);
        } catch {
            // Directory doesn't exist
            return [];
        }

        const packs: ShaderPack[] = [];

        for (const entry of entries) {
            let entryPath: string;
            try {
                entryPath = resolvePathWithinRoot(shaderDir, entry, 'Shader pack path');
            } catch {
                continue;
            }

            let stat;
            try {
                stat = await fs.stat(entryPath);
            } catch {
                continue;
            }

            // Shaders can be .zip files or directories
            if (stat.isFile() && entry.endsWith('.zip')) {
                packs.push({
                    fileName: entry,
                    name: entry.replace(/\.zip$/i, ''),
                    isActive: activeShader === entry,
                });
            } else if (stat.isDirectory()) {
                packs.push({
                    fileName: entry,
                    name: entry,
                    isActive: activeShader === entry,
                });
            }
        }

        return packs;
    }

    async import(filePath: string, instancePath: string): Promise<ShaderPackAcquisitionResult> {
        const fallbackFileName = path.basename(filePath || 'shaderpack.zip') || 'shaderpack.zip';

        try {
            const safeSourcePath = assertAbsolutePath(filePath, 'Shader pack source path');
            const fileName = assertChildName(path.basename(safeSourcePath), 'Shader pack name');
            const shaderDir = this.getShaderPacksDir(instancePath);
            await fs.ensureDir(shaderDir);

            const destinationPath = resolvePathWithinRoot(shaderDir, fileName, 'Shader pack path');
            if (await fs.pathExists(destinationPath)) {
                return this.createAcquisitionResult('duplicate', [], [
                    this.createAcquisitionIssue(
                        fileName,
                        'duplicate',
                        'A shader pack with this file name already exists in the instance.',
                    ),
                ]);
            }

            if (!(await this.hasShaderPayload(safeSourcePath))) {
                return this.createAcquisitionResult('invalid-archive', [], [
                    this.createAcquisitionIssue(
                        fileName,
                        'invalid-archive',
                        'The selected archive does not contain a shaders/ directory.',
                    ),
                ]);
            }

            await fs.copy(safeSourcePath, destinationPath);
            return this.createAcquisitionResult('success', [fileName], []);
        } catch {
            return this.createAcquisitionResult('failure', [], [
                this.createAcquisitionIssue(
                    fallbackFileName,
                    'failure',
                    'Burrow could not import the selected shader pack into this instance.',
                ),
            ]);
        }
    }

    /**
     * Delete a shader pack from the instance.
     */
    async delete(fileName: string, instancePath: string): Promise<void> {
        const shaderDir = this.getShaderPacksDir(instancePath);
        const safeFileName = assertChildName(fileName, 'Shader pack name');
        const filePath = resolvePathWithinRoot(shaderDir, safeFileName, 'Shader pack path');
        const activeShader = await this.getActiveShader(instancePath);

        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            await fs.rm(filePath, { recursive: true, force: true });
        } else {
            await fs.unlink(filePath);
        }

        if (activeShader === safeFileName) {
            await this.disable(instancePath);
        }
    }

    /**
     * Disable shaders (set to internal).
     */
    async disable(instancePath: string): Promise<void> {
        await this.setActiveShader('(internal)', instancePath);
    }
}

// Singleton export
export const shadersService = new ShadersService();
