import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const PROJECT_ROOT = path.resolve(__dirname, '..');

export const config = {
    azureOpenAI: {
        apiKey: process.env.AZURE_OPENAI_API_KEY || '',
        endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
        deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    },
    server: {
        port: parseInt(process.env.PORT || '4000', 10),
    },
    paths: {
        workspace: path.join(PROJECT_ROOT, 'workspace'),
        soul: path.join(PROJECT_ROOT, 'SOUL.md'),
    }
};
