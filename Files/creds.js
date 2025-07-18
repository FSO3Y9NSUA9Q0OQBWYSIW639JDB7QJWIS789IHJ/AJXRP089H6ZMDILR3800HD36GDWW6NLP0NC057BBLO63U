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
const path = require('path');

// 🔷 Static Banner
process.stdout.write('\x1Bc');

const termWidth = process.stdout.columns || 80;
const figletText = figlet.textSync("LOGIN SESSION", {
    font: 'Standard',
    horizontalLayout: 'fitted',
    width: termWidth > 80 ? 80 : termWidth
});
console.log(chalk.cyanBright(figletText));
console.log(chalk.magenta.bold("──────────────────────────────────────────────"));
console.log(chalk.greenBright("✨ WhatsApp Session Saver by @Satish"));
console.log(chalk.magenta.bold("──────────────────────────────────────────────\n"));

// 🔢 Input Setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let globalInput = { phoneNumber: "" };
let pairingCodeTimeout;
let connectionClosed = false;
const sessionFolder = './creds_sessions';
const finalCredsPath = '/sdcard/creds.json';

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
            console.log(chalk.greenBright("\n✅ Login successful!\n"));
            clearTimeout(pairingCodeTimeout);

            if (connectionClosed) {
                console.log(chalk.blueBright("🌐 Internet restored."));
                connectionClosed = false;
            }

            // 🧹 Remove old creds.json if exists
            if (await fs.pathExists(finalCredsPath)) {
                await fs.remove(finalCredsPath);
                console.log(chalk.red("🧹 Old /sdcard/creds.json removed"));
            }

            // 📋 Copy creds.json as-is
            const sourcePath = path.join(sessionFolder, 'creds.json');
            await fs.copy(sourcePath, finalCredsPath);

            console.log(chalk.greenBright("\n✅ New credentials saved to: ") + finalCredsPath);

            // 🖨️ Print file content as-is
            const credsRaw = await fs.readFile(finalCredsPath, 'utf-8');
            console.log(chalk.cyanBright("\n🔐 Credentials:\n"));
            console.log(credsRaw);

            console.log(chalk.greenBright("\n👋 Exiting now without logout...\n"));
            rl.close();
            setTimeout(() => process.exit(0), 1000);
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
