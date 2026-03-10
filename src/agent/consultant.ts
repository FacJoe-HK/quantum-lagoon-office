import { AzureProvider } from '../llm/azure-provider';
import { SecureFileManager } from '../security/file-sandbox';
import { WebScraper } from './web-scraper';
import { config } from '../config';
import fs from 'fs/promises';

export class ConsultantAgent {
    private llm: AzureProvider;
    private fileManager: SecureFileManager;
    private webScraper: WebScraper;
    private soulPrompt: string = '';
    private contextHistory: any[] = [];

    constructor() {
        this.llm = new AzureProvider();
        this.fileManager = new SecureFileManager();
        this.webScraper = new WebScraper();
    }

    async initialize() {
        await this.fileManager.ensureWorkspace();
        try {
            this.soulPrompt = await fs.readFile(config.paths.soul, 'utf-8');
        } catch (e) {
            console.warn('⚠️ SOUL.md missing, falling back to default consultant identity.');
            this.soulPrompt = 'You are a professional IT Consultant.';
        }
    }

    private defineTools() {
        return [
            {
                type: "function",
                function: {
                    name: "readFile",
                    description: "Reads the content of a file located in the user's workspace.",
                    parameters: {
                        type: "object",
                        properties: {
                            filename: { type: "string", description: "Name of the file to read (e.g., 'audit-scope.txt')" }
                        },
                        required: ["filename"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "writeFile",
                    description: "Writes content to a specific file in the user's workspace. Always use this to output deliverables.",
                    parameters: {
                        type: "object",
                        properties: {
                            filename: { type: "string", description: "Name of the file to write (e.g., 'gap-analysis.md')" },
                            content: { type: "string", description: "The complete content to write to the file." }
                        },
                        required: ["filename", "content"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "listFiles",
                    description: "Lists all files currently residing in the user's workspace.",
                    parameters: {
                        type: "object",
                        properties: {}
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "readExcel",
                    description: "Reads an Excel (.xlsx) file from the workspace and returns its sheets as formatted JSON.",
                    parameters: {
                        type: "object",
                        properties: {
                            filename: { type: "string", description: "Name of the Excel file to read (e.g., 'data.xlsx')" }
                        },
                        required: ["filename"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "runScript",
                    description: "Executes a shell command strictly within the secure workspace folder. You can use this to run Python (.py) or Node (.js) scripts you have written to the workspace to process data or automate tasks.",
                    parameters: {
                        type: "object",
                        properties: {
                            command: { type: "string", description: "The shell command to execute (e.g., 'python process.py' or 'node script.js')" }
                        },
                        required: ["command"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "readPdf",
                    description: "Reads a PDF (.pdf) file from the workspace and extracts its text.",
                    parameters: {
                        type: "object",
                        properties: {
                            filename: { type: "string", description: "Name of the PDF file to read (e.g., 'iso27001.pdf')" }
                        },
                        required: ["filename"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "searchWeb",
                    description: "Searches the live internet (DuckDuckGo) for up-to-date compliance or general information.",
                    parameters: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "The search query." }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "readUrl",
                    description: "Fetches and reads the main text content from a specific web URL.",
                    parameters: {
                        type: "object",
                        properties: {
                            url: { type: "string", description: "The full HTTPS URL to read." }
                        },
                        required: ["url"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "saveStructuredJson",
                    description: "Explicitly generates and saves a strictly formatted JSON file to the workspace. Use this over writeFile when outputting JSON arrays or objects.",
                    parameters: {
                        type: "object",
                        properties: {
                            filename: { type: "string", description: "Name of the JSON file to save (e.g., 'results.json')" },
                            data: { type: "object", description: "The JSON structure to save. This guarantees valid, parsable JSON output.", additionalProperties: true }
                        },
                        required: ["filename", "data"]
                    }
                }
            }
        ];
    }

    /**
     * Processes a user request, executing file operations if the LLM requests it.
     */
    async processMessage(message: string): Promise<string> {
        this.contextHistory.push({ role: 'user', content: message });

        try {
            let runAgent = true;
            let finalResponse = '';

            while (runAgent) {
                const responseMessage = await this.llm.generateCompletion(
                    this.soulPrompt,
                    this.contextHistory,
                    this.defineTools()
                );

                if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                    // Append assistant's tool intent FIRST before any tool responses
                    this.contextHistory.push(responseMessage as any);

                    // Loop through ALL requested tool calls
                    for (const toolCall of responseMessage.tool_calls) {
                        const funcName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);
                        let toolResult = '';

                        try {
                            if (funcName === 'readFile') {
                                toolResult = await this.fileManager.readFile(args.filename);
                            } else if (funcName === 'writeFile') {
                                await this.fileManager.writeFile(args.filename, args.content);
                                toolResult = `Successfully wrote to ${args.filename}`;
                            } else if (funcName === 'listFiles') {
                                const files = await this.fileManager.listFiles();
                                toolResult = files.length > 0 ? `Files: ${files.join(', ')}` : 'Workspace is empty.';
                            } else if (funcName === 'readExcel') {
                                toolResult = await this.fileManager.readExcel(args.filename);
                            } else if (funcName === 'runScript') {
                                toolResult = await this.fileManager.runScript(args.command);
                            } else if (funcName === 'readPdf') {
                                toolResult = await this.fileManager.readPdf(args.filename);
                            } else if (funcName === 'searchWeb') {
                                toolResult = await this.webScraper.searchWeb(args.query);
                            } else if (funcName === 'readUrl') {
                                toolResult = await this.webScraper.readUrl(args.url);
                            } else if (funcName === 'saveStructuredJson') {
                                await this.fileManager.writeFile(args.filename, JSON.stringify(args.data, null, 2));
                                toolResult = `Successfully wrote strict JSON to ${args.filename}`;
                            }
                        } catch (e: any) {
                            toolResult = `Error executing ${funcName}: ${e.message}`;
                        }

                        // Append individual tool execution result
                        this.contextHistory.push({
                            role: 'tool',
                            content: toolResult,
                            tool_call_id: toolCall.id
                        });
                    }
                } else {
                    // LLM provided a direct response
                    finalResponse = responseMessage.content || '';
                    this.contextHistory.push({ role: 'assistant', content: finalResponse });
                    runAgent = false; // Turn complete
                }
            }

            return finalResponse;

        } catch (e: any) {
            if (e.message.includes('401')) {
                return "❌ Authentication Error: Invalid Azure OpenAI API Key.";
            }
            if (e.message.includes('404')) {
                return "❌ Configuration Error: Endpoint or Deployment Name not found. Please review .env configurations.";
            }
            return `❌ System Error: ${e.message}`;
        }
    }
}
