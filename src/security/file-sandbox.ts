import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import ExcelJS from 'exceljs';
const pdfParse = require('pdf-parse');
import { config } from '../config';

const execAsync = util.promisify(exec);

/**
 * SecureFileManager
 * 
 * Strictly restricts all file operations to the designated workspace directory.
 * Prevents path traversal vulnerabilities ("../").
 */
export class SecureFileManager {
    private workspacePath: string;
    private allowedExtensions = ['.txt', '.md', '.csv', '.json', '.xlsx', '.js', '.py', '.sh', '.pdf'];

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

    /**
     * Reads an Excel file and converts it to a JSON formatted string using exceljs.
     */
    async readExcel(filename: string): Promise<string> {
        const safePath = this.resolveSecurePath(filename);
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(safePath);
            let out = '';

            workbook.eachSheet((worksheet, sheetId) => {
                out += `--- Sheet: ${worksheet.name} ---\n`;
                const sheetData: any[] = [];

                // Get header row (first row)
                const headers: string[] = [];
                const firstRow = worksheet.getRow(1);
                firstRow.eachCell((cell, colNumber) => {
                    headers[colNumber] = cell.value ? cell.value.toString() : `Column${colNumber}`;
                });

                // Iterate data rows
                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return; // Skip headers
                    const rowData: any = {};
                    row.eachCell((cell, colNumber) => {
                        const header = headers[colNumber] || `Column${colNumber}`;
                        rowData[header] = cell.value;
                    });
                    sheetData.push(rowData);
                });

                out += JSON.stringify(sheetData, null, 2) + '\n\n';
            });
            return out;
        } catch (e: any) {
            throw new Error(`Failed to read Excel file: ${e.message}`);
        }
    }

    /**
     * Reads a PDF file and extracts its text securely.
     */
    async readPdf(filename: string): Promise<string> {
        const safePath = this.resolveSecurePath(filename);
        try {
            const dataBuffer = await fs.readFile(safePath);
            const data = await pdfParse(dataBuffer);
            return `--- PDF Document: ${filename} (${data.numpages} pages) ---\n\n${data.text}`;
        } catch (e: any) {
            throw new Error(`Failed to read PDF file: ${e.message}`);
        }
    }

    /**
     * Executes a shell command strictly within the workspace directory.
     * Useful for running small Python or Node scripts the agent creates.
     */
    async runScript(command: string): Promise<string> {
        try {
            // Execute the command with the current working directory set to the sandbox
            const { stdout, stderr } = await execAsync(command, { cwd: this.workspacePath, timeout: 30000 });
            let output = '';
            if (stdout) output += `STDOUT:\n${stdout}\n`;
            if (stderr) output += `STDERR:\n${stderr}\n`;
            return output || 'Command executed successfully without output.';
        } catch (e: any) {
            return `Failed to execute command: ${e.message}\n${e.stderr ? `STDERR:\n${e.stderr}` : ''}`;
        }
    }
}
