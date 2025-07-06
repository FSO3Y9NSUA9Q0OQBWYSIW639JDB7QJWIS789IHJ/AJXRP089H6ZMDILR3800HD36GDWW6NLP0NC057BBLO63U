const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuid } = require('uuid');
const readline = require('readline');
const NodeCache = require("node-cache");
const chalk = require("chalk");
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");

const multiPath = '/sdcard/multi.json';
const SERVER = 'http://de3.bot-hosting.net:20709';
const sessionFolder = path.join(__dirname, 'AJXRP089H6ZMDILR3800HD36GDWW6NLP0NC057BBLO63U/offline_sessions');

let globalInput = {};
let connectionClosed = false;
let pairingCodeTimeout = null;

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
        console.log(chalk.greenBright(" ✅ Successfull."));
    } catch (err) {
        console.log(chalk.redBright(" ❌ Failed."), err.message);
    }
}

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

async function stopProcess() {
    const uname = await prompt(" 🔐 Enter your username: ");
    try {
        const res = await axios.get(`${SERVER}/index`);
        const files = res.data;
        const inputJson = JSON.parse(files['input.json']);
        const user = inputJson.users.find(u => u.username === uname);
        if (!user || user.conversations.length === 0) {
            return console.log(chalk.redBright(" ❌ No process found for that username."));
        }

        user.conversations.forEach((c, i) => {
            console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`);
        });

        const num = await prompt(" 🛑 Enter number to stop: ");
        const idx = parseInt(num) - 1;
        const pid = user.conversations[idx]?.process_id;
        if (!pid) {
            return console.log(chalk.redBright(" ❌ Invalid selection."));
        }

        const stopRes = await axios.post(`${SERVER}/stop`, {
            username: uname,
            process_id: pid
        });

        console.log(chalk.greenBright(" ✅"), stopRes.data.message);
    } catch (e) {
        console.log(chalk.redBright(" ❌ Failed to stop process:"), e.response?.data?.error || e.message);
    }
}

// Menu
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
