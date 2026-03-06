import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

/**
 * SecureFileManager
 * 
 * Strictly restricts all file operations to the designated workspace directory.
 * Prevents path traversal vulnerabilities ("../").
 */
export class SecureFileManager {
    private workspacePath: string;
    private allowedExtensions = ['.txt', '.md', '.csv', '.json'];

    constructor() {
        this.workspacePath = config.paths.workspace;
    }

    /**
     * Resolves a requested path and ensures it lies strictly within the workspace.
     * Throws an error if a path traversal is attempted.
     */
    private resolveSecurePath(requestedPath: string): string {
        // Prevent obvious absolute path attempts that try to bypass path.resolve
        if (path.isAbsolute(requestedPath)) {
            throw new Error(`Security Violation: Absolute paths are not allowed. Please use relative paths (e.g., 'report.md').`);
        }

        const resolvedPath = path.resolve(this.workspacePath, requestedPath);

        if (!resolvedPath.startsWith(this.workspacePath)) {
            throw new Error(`Security Violation: Attempted to access files outside the secure workspace sandbox.`);
        }

        return resolvedPath;
    }

    /**
     * Checks if the file extension is allowed.
     */
    private checkAllowedExtension(filePath: string) {
        const ext = path.extname(filePath).toLowerCase();
        if (!this.allowedExtensions.includes(ext) && ext !== '') {
            throw new Error(`Security Violation: File extension '${ext}' is not permitted. Allowed: ${this.allowedExtensions.join(', ')}`);
        }
    }

    /**
     * Initializes the workspace directory if it doesn't exist.
     */
    async ensureWorkspace(): Promise<void> {
        try {
            await fs.access(this.workspacePath);
        } catch {
            await fs.mkdir(this.workspacePath, { recursive: true });
        }
    }

    /**
     * Reads a file from the workspace.
     */
    async readFile(filename: string): Promise<string> {
        const safePath = this.resolveSecurePath(filename);
        try {
            return await fs.readFile(safePath, 'utf-8');
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${filename}`);
            }
            throw error;
        }
    }

    /**
     * Writes content to a file in the workspace.
     */
    async writeFile(filename: string, content: string): Promise<void> {
        const safePath = this.resolveSecurePath(filename);
        this.checkAllowedExtension(safePath);
        await fs.writeFile(safePath, content, 'utf-8');
    }

    /**
     * Lists all files in the workspace.
     */
    async listFiles(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.workspacePath, { withFileTypes: true });
            return files
                .filter(dirent => dirent.isFile())
                .map(dirent => dirent.name);
        } catch {
            return [];
        }
    }
}
