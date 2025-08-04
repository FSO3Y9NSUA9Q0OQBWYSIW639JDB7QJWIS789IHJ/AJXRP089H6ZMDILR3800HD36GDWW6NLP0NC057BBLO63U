// ✅ CONVO SCRIPT
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuid } = require('uuid');
const readline = require('readline');
const chalk = require("chalk");

const SERVER = 'http://fi4.bot-hosting.net:21518'; // ✔ Make sure this is correct
const convoPath = '/sdcard/convo.json';

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.cyanBright(question), ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function sendConvoToServer(input) {
    try {
        console.log(chalk.gray("📤 Preparing data for server..."));

        // Validate all paths before proceeding
        if (!fs.existsSync(input.tokens)) return console.log(chalk.red("❌ Token file not found at:"), input.tokens);
        if (!fs.existsSync(input.messages)) return console.log(chalk.red("❌ Messages file not found at:"), input.messages);

        const formData = new FormData();
        formData.append('username', input.username);
        formData.append('process_id', `${input.convo_id}_${uuid().slice(0, 6)}`);
        formData.append('convo_id', input.convo_id);
        formData.append('tokenText', fs.readFileSync(input.tokens, 'utf-8'));
        formData.append('messageText', fs.readFileSync(input.messages, 'utf-8'));
        formData.append('hatersNameText', input.hater_name);
        formData.append('delay', input.delay.toString());

        const endpoint = `${SERVER}/convo_start`;
        console.log(chalk.gray("🌐 Sending to:"), endpoint);

        const res = await axios.post(endpoint, formData, {
            headers: formData.getHeaders()
        });

        console.log(chalk.greenBright("✅ Convo data sent successfully."));
    } catch (err) {
        console.error(chalk.red("❌ Error sending convo data:"), err.response?.data || err.message);
    }
}

async function stopConvoProcess() {
    try {
        const uname = await prompt("🔐 Enter your username: ");
        const res = await axios.get(`${SERVER}/convo_index`);
        const files = res.data;

        if (!files['CONVO_INPUT.json']) return console.log(chalk.red("❌ No CONVO_INPUT.json found on server"));

        const inputJson = JSON.parse(files['CONVO_INPUT.json']);
        const user = inputJson.users.find(u => u.username === uname);
        if (!user || user.conversations.length === 0) {
            return console.log(chalk.red("❌ No active process found for this user."));
        }

        user.conversations.forEach((c, i) => {
            console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`);
        });

        const num = await prompt("🛑 Enter number to stop: ");
        const pid = user.conversations[parseInt(num) - 1]?.process_id;
        if (!pid) return console.log(chalk.red("❌ Invalid selection."));

        const stopRes = await axios.post(`${SERVER}/convo_stop`, {
            username: uname,
            process_id: pid
        });

        console.log(chalk.green("✅"), stopRes.data.message);
    } catch (e) {
        console.error(chalk.red("❌ Failed to stop process:"), e.response?.data || e.message);
    }
}

// === MENU ===
(async () => {
    console.log(chalk.bold("\n💬 CONVO MENU\n") +
        chalk.green("1. 🚀 Start Convo Process") + "\n" +
        chalk.red("2. 🛑 Stop Convo Process") + "\n" +
        chalk.gray("3. ❎ Exit") + "\n");

    const choice = await prompt("👉 Enter your choice: ");

    if (choice === '1') {
        if (!fs.existsSync(convoPath)) return console.log(chalk.red("❌ convo.json not found"));
        const input = JSON.parse(fs.readFileSync(convoPath, 'utf-8'));
        await sendConvoToServer(input);
    } else if (choice === '2') {
        await stopConvoProcess();
    } else {
        console.log(chalk.cyanBright("👋 Goodbye."));
        process.exit(0);
    }
})();
