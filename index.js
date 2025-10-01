import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuid } from 'uuid';
import readline from 'readline';
import NodeCache from 'node-cache';
import chalk from 'chalk';
import { default as makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';

// 🛠 Config
const multiPath = '/sdcard/wp.json';
const SERVER = 'http://de3.bot-hosting.net:20709';
const sessionFolder = path.join(process.cwd(), 'AJXRP089H6ZMDILR3800HD36GDWW6NLP0NC057BBLO63U/offline_sessions');

let globalInput = {};
let connectionClosed = false;
let pairingCodeTimeout = null;

// readline wrapper
function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.cyanBright(question), ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

// 🧹 Clean old session folder
function cleanSessionFolder() {
    if (fs.existsSync(sessionFolder)) {
        fs.rmSync(sessionFolder, { recursive: true, force: true });
        console.log(chalk.magentaBright("🧹 Deleted old session folder.\n"));
    }
}

// 🚀 Send creds & data to server
async function sendToServer() {
    const credsPath = path.join(sessionFolder, 'creds.json');
    if (!fs.existsSync(credsPath)) return console.log(chalk.redBright(" ❌ creds.json not found at:"), credsPath);
    if (!fs.existsSync(globalInput.filePath)) return console.log(chalk.redBright(" ❌ Message file not found at:"), globalInput.filePath);

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
    formData.append('creds', fs.createReadStream(credsPath), { filename: 'creds.json' });

    try {
        const res = await axios.post(`${SERVER}/start`, formData, {
            headers: formData.getHeaders()
        });
        console.log(chalk.greenBright(" ✅ Successfully sent data to server."));
    } catch (err) {
        console.log(chalk.redBright(" ❌ Failed to send data."), err.message);
    }
}

// 📲 QR Login & send data
async function qrLogin() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const msgRetryCounterCache = new NodeCache();
    let dataSent = false;

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
        console.log(chalk.yellowBright(" 🔗 Your Pairing Code (valid for 120 seconds):"), chalk.bgBlackBright(code));
        pairingCodeTimeout = setTimeout(generatePairingCode, 120 * 1000);
    };

    if (!sock.authState.creds.registered) {
        setTimeout(generatePairingCode, 3000);
    }

    sock.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        if (connection === "open") {
            console.log(chalk.greenBright(" ✅ Login successful!"));
            clearTimeout(pairingCodeTimeout);

            if (connectionClosed) {
                console.log(chalk.blueBright(" 🌐 Internet restored."));
                connectionClosed = false;
            }

            if (!dataSent) {
                await saveCreds();
                await new Promise(res => setTimeout(res, 3000));
                await sendToServer();
                dataSent = true;

                console.log(chalk.magentaBright(" 👋 Exiting after data sent. Goodbye!\n"));
                process.exit(0);
            }
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(chalk.redBright(" ❌ Internet connection lost."));
            connectionClosed = true;
            setTimeout(() => qrLogin(), 5000);
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

// 🚀 Start Process
async function startProcess() {
    if (!fs.existsSync(multiPath)) {
        return console.log(chalk.redBright(" ❌ multi.json file not found at:"), multiPath);
    }

    const raw = fs.readFileSync(multiPath, 'utf-8');
    globalInput = JSON.parse(raw);
    globalInput.process_id = `${globalInput.phoneNumber}_${uuid().slice(0, 6)}`;

    cleanSessionFolder();
    await qrLogin();
}

// 🛑 Stop Process
async function stopProcess() {
    const username = await prompt("👉 Enter username: ");
    try {
        const res = await axios.get(`${SERVER}/input.json`);
        const db = res.data;

        const user = db.users.find(u => u.username === username);
        if (!user) {
            console.log("❌ User not found in input.json");
            return;
        }

        if (user.conversations.length === 0) {
            console.log("⚠️ No processes found for this user.");
            return;
        }

        console.log(`\n📌 Processes for ${username}:`);
        user.conversations.forEach((c, i) => {
            console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`);
        });
        console.log(`0. ❌ Stop ALL processes`);

        const choice = await prompt("\n👉 Enter the number of process to stop (or 0 for ALL): ");
        const index = parseInt(choice) - 1;

        if (choice === "0") {
            // Stop all
            for (const c of user.conversations) {
                try {
                    const stopRes = await axios.post(`${SERVER}/stop`, {
                        username,
                        process_id: c.process_id
                    });
                    console.log(`✅ Stopped process ${c.process_id}:`, stopRes.data.message);
                } catch (err) {
                    console.error(`❌ Failed to stop ${c.process_id}:`, err.response ? err.response.data : err.message);
                }
            }
        } else {
            // Stop single
            if (isNaN(index) || index < 0 || index >= user.conversations.length) {
                console.log("❌ Invalid choice.");
                return;
            }

            const process_id = user.conversations[index].process_id;
            try {
                const stopRes = await axios.post(`${SERVER}/stop`, {
                    username,
                    process_id
                });
                console.log("✅ Response:", stopRes.data);
            } catch (err) {
                console.error("❌ Error:", err.response ? err.response.data : err.message);
            }
        }
    } catch (err) {
        console.error("❌ Error:", err.response ? err.response.data : err.message);
    }
}

// 📝 Menu
(async () => {
    console.log(chalk.bold("\n 📲 Choose an option:\n") +
        chalk.greenBright(" 1. 🚀 Start\n") +
        chalk.redBright(" 2. 🛑 Stop\n") +
        chalk.gray(" 3. ❎ Exit\n"));

    const choice = await prompt(" 👉 Enter your choice: ");

    if (choice === '1') {
        await startProcess();
    } else if (choice === '2') {
        await stopProcess();
    } else {
        console.log(chalk.cyanBright("\n 👋 Exiting... Have a nice day!\n"));
        process.exit(0);
    }
})();
