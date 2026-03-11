import readline from 'readline';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { ConsultantAgent } from './agent/consultant';

async function main() {
    console.log("==========================================");
    console.log(" 👔 Quantum Lagoon — Office Edition       ");
    console.log("    Consulting & Audit AI Manager         ");
    console.log("==========================================");

    const agent = new ConsultantAgent();
    await agent.initialize();

    console.log("✅ Sandbox Initialized (restricted to /workspace)");
    console.log("✅ Azure Provider Hooked");
    console.log("✅ Consultant Memory & Soul Loaded");

    // Start Express Web Server
    const app = express();
    const port = process.env.PORT || 3000;

    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../../public'))); // Points to public/

    app.post('/api/chat', async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) {
                return res.status(400).json({ error: 'Message is required' });
            }
            const response = await agent.processMessage(message);
            res.json({ response });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/workspace', async (req, res) => {
        try {
            const files = await agent.getWorkspaceFiles();
            res.json({ files });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/workspace/:filename', async (req, res) => {
        try {
            const content = await agent.readFileContent(req.params.filename);
            res.json({ content });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.listen(port, () => {
        console.log(`\n🌐 Premium Web Interface running at http://localhost:${port}\n`);
        console.log("Ready for assignments via Web or CLI. Type 'exit' to quit.\n");
        startCLI(agent);
    });
}

function startCLI(agent: ConsultantAgent) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const prompt = () => {
        rl.question("You: ", async (input) => {
            if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
                rl.close();
                process.exit(0);
            }

            if (!input.trim()) {
                prompt();
                return;
            }

            process.stdout.write("Consultant Agent is analyzing...");

            try {
                const response = await agent.processMessage(input);
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                console.log(`\n👔 Consultant:\n${response}\n`);
            } catch (e: any) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                console.error(`\n❌ Error: ${e.message}\n`);
            }

            prompt();
        });
    };

    prompt();
}

main().catch(err => {
    console.error("Fatal Error initializing agent:", err);
    process.exit(1);
});
