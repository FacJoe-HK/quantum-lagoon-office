import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

export class MemoryStore {
    private db: any = null;
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(config.paths.workspace, 'memory.sqlite');
    }

    /**
     * Initialize the local database file.
     * Loads the existing file if it exists, otherwise creates a new one.
     */
    async initialize() {
        const SQL = await initSqlJs();

        try {
            const data = await fs.readFile(this.dbPath);
            this.db = new SQL.Database(data);
            console.log("🧠 Loaded existing memory database.");
        } catch (e) {
            // File doesn't exist, create a new DB
            this.db = new SQL.Database();

            this.db.run(`
                CREATE TABLE messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tool_call_id TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await this.saveDb();
            console.log("🧠 Initialized new memory database.");
        }
    }

    /**
     * Saves the current database state to the local workspace file.
     */
    private async saveDb() {
        if (!this.db) return;
        const data = this.db.export();
        await fs.writeFile(this.dbPath, Buffer.from(data));
    }

    /**
     * Adds a generic message to the memory store.
     */
    async addMessage(message: any) {
        if (!this.db) return;

        try {
            // If the LLM sends a tool call request, we stringify it to save it
            let content = typeof message.content === 'string' ? message.content : JSON.stringify(message.tool_calls || message.content || '');

            this.db.run(
                `INSERT INTO messages (role, content, tool_call_id) VALUES (?, ?, ?)`,
                [message.role, content, message.tool_call_id || null]
            );
            await this.saveDb();
        } catch (e: any) {
            console.error(`Failed to save message to memory: ${e.message}`);
        }
    }

    /**
     * Retrieves the last N messages to establish context for the LLM.
     */
    getRecentHistory(limit: number = 30): any[] {
        if (!this.db) return [];

        const stmt = this.db.prepare(`
            SELECT role, content, tool_call_id 
            FROM messages 
            ORDER BY id DESC 
            LIMIT ?
        `);

        stmt.bind([limit]);

        const history: any[] = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            const msg: any = { role: row.role };

            // Try to parse back tool call arrays if they were stringified JSON
            try {
                if (row.role === 'assistant' && row.content && row.content.startsWith('[')) {
                    const parsed = JSON.parse(row.content);
                    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].function) {
                        msg.tool_calls = parsed;
                        msg.content = null;
                    } else {
                        msg.content = row.content;
                    }
                } else {
                    msg.content = row.content;
                }
            } catch {
                msg.content = row.content;
            }

            if (row.tool_call_id) {
                msg.tool_call_id = row.tool_call_id;
            }

            history.push(msg);
        }
        stmt.free();

        // Reverse because we queried DESC to get recent, but LLM needs chronological order
        return history.reverse();
    }
}
