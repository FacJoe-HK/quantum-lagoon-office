import { AzureProvider } from '../llm/azure-provider';
import { SecureFileManager } from '../security/file-sandbox';
import { config } from '../config';
import fs from 'fs/promises';

export class ConsultantAgent {
    private llm: AzureProvider;
    private fileManager: SecureFileManager;
    private soulPrompt: string = '';
    private contextHistory: any[] = [];

    constructor() {
        this.llm = new AzureProvider();
        this.fileManager = new SecureFileManager();
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
                    // LLM wants to use a tool
                    const toolCall = responseMessage.tool_calls[0];
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
                        }
                    } catch (e: any) {
                        toolResult = `Error executing ${funcName}: ${e.message}`;
                    }

                    // Append tool execution to history so LLM knows what happened
                    this.contextHistory.push(responseMessage as any); // Add assistant's tool intent
                    this.contextHistory.push({
                        role: 'user', // We simulate user role for tool execution returning
                        content: `Tool '${funcName}' executed. Result:\n${toolResult}`
                    });
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
