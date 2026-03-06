import { AzureOpenAI } from 'openai';
import { config } from '../config';

export class AzureProvider {
    private client: AzureOpenAI;

    constructor() {
        if (!config.azureOpenAI.apiKey || !config.azureOpenAI.endpoint) {
            console.warn("⚠️ Azure OpenAI API Key or Endpoint is missing. Please configure .env");
        }

        this.client = new AzureOpenAI({
            apiKey: config.azureOpenAI.apiKey,
            endpoint: config.azureOpenAI.endpoint,
            apiVersion: config.azureOpenAI.apiVersion,
            deployment: config.azureOpenAI.deploymentName,
        });
    }

    /**
     * Generates a chat completion.
     */
    async generateCompletion(
        systemPrompt: string,
        messages: { role: 'user' | 'assistant', content: string }[],
        tools?: any[]
    ): Promise<any> {
        try {
            const response = await this.client.chat.completions.create({
                model: config.azureOpenAI.deploymentName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                tools,
                tool_choice: tools ? 'auto' : undefined,
            });

            return response.choices[0].message;
        } catch (error: any) {
            console.error('Azure OpenAI Error:', error.message);
            throw new Error(`LLM Error: ${error.message}`);
        }
    }
}
