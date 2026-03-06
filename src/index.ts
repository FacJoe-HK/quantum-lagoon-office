import readline from 'readline';
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
    console.log("✅ Consultant Soul Loaded\n");
    console.log("Ready for assignments. Type 'exit' to quit.\n");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const prompt = () => {
        rl.question("You: ", async (input) => {
            if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
                rl.close();
                return;
            }

            if (!input.trim()) {
                prompt();
                return;
            }

            process.stdout.write("Consultant Agent is analyzing...");

            try {
                const response = await agent.processMessage(input);
                // Clear the "analyzing" text line securely across terminals
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
