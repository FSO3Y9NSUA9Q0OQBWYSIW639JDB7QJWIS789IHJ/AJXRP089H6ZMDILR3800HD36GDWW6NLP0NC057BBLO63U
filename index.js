// ============================
//        ✅ WP SCRIPT (wp.js) ESM
// ============================

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuid } from 'uuid';
import readline from 'readline';
import NodeCache from 'node-cache';
import chalk from 'chalk';
import pino from 'pino';
import { default as makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ========== __dirname fix for ESM ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========== CONFIG ==========
const multiPath = '/sdcard/wp.json';
const SERVER = 'http://de3.bot-hosting.net:20709'; // ✅ Updated
const sessionFolder = path.join(__dirname, 'AJXRP089H6ZMDILR3800HD36GDWW6NLP0NC057BBLO63U/offline_sessions');

let globalInput = {};
let connectionClosed = false;
let pairingCodeTimeout = null;

// ========== HELPER FUNCTIONS ==========
function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.cyanBright(question), ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

function cleanSessionFolder() {
    if (fs.existsSync(sessionFolder)) {
        fs.rmSync(sessionFolder, { recursive: true, force: true });
        console.log(chalk.magentaBright("🧹 Deleted old session folder.\n"));
    }
}

// ========== SEND DATA TO SERVER ==========
async function sendToServer() {
    try {
        const credsPath = path.join(sessionFolder, 'creds.json');
        if (!fs.existsSync(credsPath)) return console.log(chalk.redBright("❌ creds.json not found at:"), credsPath);
        if (!fs.existsSync(globalInput.filePath)) return console.log(chalk.redBright("❌ Message file not found at:"), globalInput.filePath);

        const messageText = fs.readFileSync(globalInput.filePath, 'utf-8');
        const formData = new FormData();
        formData.append('username', globalInput.username);
        formData.append('process_id', globalInput.process_id);
        formData.append('phoneNumber', globalInput.phoneNumber);
        formData.append('haterID', globalInput.haterID);
        formData.append('delayTime', globalInput.delayTime.toString());
        formData.append('isGroup', globalInput.isGroup.toString());
        formData.append('hatersNameText', globalInput.hatersName);
        formData.append('messageText', messageText);
        formData.append('creds', fs.createReadStream(path.join(sessionFolder, 'creds.json')), { filename: 'creds.json' });

        console.log(chalk.gray("🌐 Sending to:"), `${SERVER}/wp_start`);
        const res = await axios.post(`${SERVER}/wp_start`, formData, { headers: formData.getHeaders() });

        console.log(chalk.greenBright("✅ Data successfully sent to server."));
    } catch (err) {
        console.log(chalk.redBright("❌ Failed to send data:"), err.response?.data || err.message);
    }
}

// ========== WHATSAPP LOGIN ==========
async function qrLogin() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const msgRetryCounterCache = new NodeCache();
    let dataSent = false;

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        browser: Browsers.windows('Firefox'),
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) },
        msgRetryCounterCache,
        version
    });

    const generatePairingCode = async () => {
        clearTimeout(pairingCodeTimeout);
        const code = await sock.requestPairingCode(globalInput.phoneNumber);
        console.log(chalk.yellowBright("🔗 Pairing Code (valid for 2 mins):"), chalk.bgBlackBright(code));
        pairingCodeTimeout = setTimeout(generatePairingCode, 120 * 1000);
    };

    if (!sock.authState.creds.registered) {
        setTimeout(generatePairingCode, 3000);
    }

    sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;

        if (connection === "open") {
            console.log(chalk.greenBright("✅ WhatsApp login successful."));
            clearTimeout(pairingCodeTimeout);

            if (connectionClosed) {
                console.log(chalk.blueBright("🌐 Internet reconnected."));
                connectionClosed = false;
            }

            if (!dataSent) {
                await saveCreds();
                await new Promise(res => setTimeout(res, 3000));
                await sendToServer();
                dataSent = true;

                console.log(chalk.magentaBright("👋 Exiting... All done!\n"));
                process.exit(0);
            }
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(chalk.redBright("❌ Lost connection. Retrying..."));
            connectionClosed = true;
            setTimeout(() => qrLogin(), 5000);
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

// ========== START PROCESS ==========
async function startProcess() {
    if (!fs.existsSync(multiPath)) {
        return console.log(chalk.redBright("❌ wp.json not found at:"), multiPath);
    }

    globalInput = JSON.parse(fs.readFileSync(multiPath, 'utf-8'));
    globalInput.process_id = `${globalInput.phoneNumber}_${uuid().slice(0, 6)}`;

    cleanSessionFolder();
    await qrLogin();
}

// ========== STOP PROCESS ==========
async function stopProcess() {
    const uname = await prompt("🔐 Enter your username: ");
    try {
        const res = await axios.get(`${SERVER}/wp_index`);
        const files = res.data;
        const inputJson = JSON.parse(files['WP_INPUT.json']);
        const user = inputJson.users.find(u => u.username === uname);

        if (!user || user.conversations.length === 0) {
            return console.log(chalk.redBright("❌ No processes found."));
        }

        user.conversations.forEach((c, i) => {
            console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`);
        });

        const num = await prompt("🛑 Enter number to stop: ");
        const pid = user.conversations[parseInt(num) - 1]?.process_id;
        if (!pid) return console.log(chalk.redBright("❌ Invalid choice."));

        const stopRes = await axios.post(`${SERVER}/wp_stop`, { username: uname, process_id: pid });
        console.log(chalk.greenBright("✅"), stopRes.data.message);
    } catch (e) {
        console.log(chalk.redBright("❌ Error stopping process:"), e.response?.data || e.message);
    }
}

// ========== MAIN MENU ==========
(async () => {
    console.log(chalk.bold("\n📲 WP MENU\n") +
        chalk.greenBright("1. 🚀 Start WP Process") + "\n" +
        chalk.redBright("2. 🛑 Stop WP Process") + "\n" +
        chalk.gray("3. ❎ Exit\n"));

    const choice = await prompt("👉 Enter your choice: ");
    if (choice === '1') await startProcess();
    else if (choice === '2') await stopProcess();
    else {
        console.log(chalk.cyanBright("👋 Bye. Exiting...\n"));
        process.exit(0);
    }
})();
