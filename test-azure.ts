import { AzureOpenAI } from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load the .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function testAzureConnection() {
    console.log("=== Azure OpenAI Diagnostic Test ===\n");

    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

    // 1. Check if variables are loaded
    console.log("1. Checking Environment Variables...");
    if (!apiKey || apiKey === "your-azure-api-key") {
        console.error("❌ ERROR: AZURE_OPENAI_API_KEY is missing or still set to the default placeholder.");
        return;
    }
    if (!endpoint || endpoint === "https://your-resource-name.openai.azure.com/") {
        console.error("❌ ERROR: AZURE_OPENAI_ENDPOINT is missing or still set to the default placeholder.");
        return;
    }
    if (!deploymentName) {
        console.error("❌ ERROR: AZURE_OPENAI_DEPLOYMENT_NAME is missing.");
        return;
    }
    console.log("✅ Variables loaded:");
    console.log(`   - Endpoint: ${endpoint}`);
    console.log(`   - Deployment: ${deploymentName}\n`);

    // 2. Initialize Client
    console.log("2. Initializing Azure OpenAI Client...");
    let client;
    try {
        client = new AzureOpenAI({
            apiKey: apiKey,
            endpoint: endpoint,
            apiVersion: apiVersion,
            deployment: deploymentName,
        });
        console.log("✅ Client initialized.\n");
    } catch (err: any) {
        console.error("❌ ERROR INITIALIZING CLIENT:", err.message);
        return;
    }

    // 3. Test Connection
    console.log("3. Testing Connection to Azure (Sending 'Hello')...");
    try {
        const response = await client.chat.completions.create({
            model: deploymentName,
            messages: [{ role: 'user', content: 'Reply with the word "Success" if you receive this.' }],
            max_tokens: 10
        });

        console.log("✅ SUCCESS! Connected to Azure OpenAI.");
        console.log(`🤖 AI Response: "${response.choices[0].message.content}"\n`);
        console.log("Your credentials are correct. You can now run the Consultant Agent using: npm run dev");
    } catch (err: any) {
        console.error("\n❌ CONNECTION FAILED!");
        console.error("Error Type:", err.name);
        console.error("Error Message:", err.message);

        console.log("\n--- Troubleshooting Tips ---");
        if (err.status === 401) {
            console.log("💡 Tip: A 401 error means your AZURE_OPENAI_API_KEY is incorrect.");
        } else if (err.status === 404) {
            console.log("💡 Tip: A 404 error usually means your AZURE_OPENAI_DEPLOYMENT_NAME is incorrect, or the endpoint URL is missing the specific path.");
        } else if (err.code === 'ENOTFOUND') {
            console.log("💡 Tip: The endpoint URL doesn't seem to exist. Check for typos in AZURE_OPENAI_ENDPOINT.");
        }
    }
}

testAzureConnection();
