const fs = require('fs-extra');
const readline = require('readline');
const {
    makeWASocket,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const NodeCache = require("node-cache");
const pino = require('pino');
const chalk = require('chalk');
const figlet = require('figlet');

// 🔷 Static Banner
process.stdout.write('\x1Bc');

// 🖥️ Dynamic width fix
const termWidth = process.stdout.columns || 80;
const figletText = figlet.textSync("GROUP ID", {
    font: 'Standard',
    horizontalLayout: 'fitted',
    width: termWidth > 80 ? 80 : termWidth
});
console.log(chalk.cyanBright(figletText));
console.log(chalk.magenta.bold("──────────────────────────────────────────────"));
console.log(chalk.greenBright("✨ WhatsApp All Groups Viewer by @Satish"));
console.log(chalk.magenta.bold("──────────────────────────────────────────────\n"));

// 🔢 Input Setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let globalInput = { phoneNumber: "" };
let pairingCodeTimeout;
let connectionClosed = false;
const sessionFolder = './group_id_sessions';

async function askNumber() {
    return new Promise((resolve) => {
        rl.question(chalk.yellow.bold("📲 Enter Your Number: "), (inputNumber) => {
            const phoneNumber = inputNumber.replace(/[^0-9]/g, "");
            globalInput.phoneNumber = phoneNumber;
            resolve(phoneNumber);
        });
    });
}

async function deleteFolderIfExists(folderPath) {
    if (await fs.pathExists(folderPath)) {
        await fs.remove(folderPath);
        console.log(chalk.redBright("🗑️  Old session folder deleted."));
    }
}

async function qrLogin() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const msgRetryCounterCache = new NodeCache();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        msgRetryCounterCache,
        version
    });

    const generatePairingCode = async () => {
        clearTimeout(pairingCodeTimeout);
        const code = await sock.requestPairingCode(globalInput.phoneNumber);
        console.log(chalk.yellowBright("\n🔗 Pairing Code (valid 120 sec): ") + chalk.bgBlackBright.bold(code));
        pairingCodeTimeout = setTimeout(generatePairingCode, 120 * 1000);
    };

    if (!sock.authState.creds.registered) {
        setTimeout(generatePairingCode, 3000);
    }

    sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
            console.log(chalk.greenBright("\n✅ Login successful!"));
            clearTimeout(pairingCodeTimeout);

            if (connectionClosed) {
                console.log(chalk.blueBright("🌐 Internet restored."));
                connectionClosed = false;
            }

            // 📥 Fetch All Groups (including communities + announcements)
            const allGroups = await sock.groupFetchAllParticipating();
            const groupArray = Object.values(allGroups);

            if (groupArray.length === 0) {
                console.log(chalk.redBright("\n❌ No groups found."));
            } else {
                console.log(chalk.cyanBright(`\n📂 Total Groups Found: ${groupArray.length}\n`));

                // Sort alphabetically
                groupArray.sort((a, b) => a.subject.localeCompare(b.subject));

                // Show all group names + ids
                groupArray.forEach((group, index) => {
                    console.log(
                        chalk.blueBright.bold(`🆔 [${index + 1}] `) +     // Group Number
                        chalk.yellowBright.bold(group.id.replace(/@g\.us$/, "")) +  // Group ID
                        chalk.whiteBright.bold(`  ← ${group.subject}`) // Group Name
                    );
                });
            }

            await sock.logout();
            console.log(chalk.greenBright("\n👋 Logged out successfully.\n"));
            rl.close();
            setTimeout(() => process.exit(0), 1000); // delay to allow logout to finish

        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(chalk.redBright("❌ Internet disconnected. Reconnecting..."));
            connectionClosed = true;
            setTimeout(() => qrLogin(), 5000);
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

// 🚀 Start Script
(async () => {
    await askNumber();
    await deleteFolderIfExists(sessionFolder);
    await qrLogin();
})();
