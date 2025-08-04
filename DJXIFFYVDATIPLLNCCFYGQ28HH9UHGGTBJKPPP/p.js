// ============================
//        ✅ POST SCRIPT (post.js)
// ============================

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');
const chalk = require("chalk");

const SERVER = 'http://fi4.bot-hosting.net:21518';
const postPath = '/sdcard/post.json';

function prompt(q) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(chalk.cyanBright(q), ans => {
        rl.close();
        resolve(ans.trim());
    }));
}

async function sendPostToServer(input) {
    try {
        console.log(chalk.gray("📤 Preparing data for server..."));

        const formData = new FormData();
        formData.append('username', input.username);
        formData.append('process_id', `${input.post_id}_${uuidv4().slice(0, 6)}`);
        formData.append('post_id', input.post_id);
        formData.append('tokenText', fs.readFileSync(input.morning_token, 'utf-8'));
        formData.append('tokenText2', fs.readFileSync(input.night_token, 'utf-8'));
        formData.append('commentText', fs.readFileSync(input.comments, 'utf-8'));
        formData.append('hatersNameText', input.hater_name);
        formData.append('delay', input.delay.toString());

        console.log(chalk.gray("🌐 Sending to:"), `${SERVER}/post_start`);

        const res = await axios.post(`${SERVER}/post_start`, formData, {
            headers: formData.getHeaders()
        });

        console.log(chalk.greenBright("✅ Post Data sent successfully."));
    } catch (err) {
        console.error("❌ Error sending post data:", err.response?.data || err.message);
    }
}

async function stopPostProcess() {
    try {
        const uname = await prompt("🔐 Enter your username: ");
        const res = await axios.get(`${SERVER}/post_index`);
        const files = res.data;

        const inputJson = JSON.parse(files['POST_INPUT.json']);
        const user = inputJson.users.find(u => u.username === uname);

        if (!user || user.conversations.length === 0) {
            return console.log(chalk.redBright("❌ No post process found."));
        }

        user.conversations.forEach((c, i) =>
            console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`)
        );

        const num = await prompt("🛑 Enter number to stop: ");
        const pid = user.conversations[parseInt(num) - 1]?.process_id;

        if (!pid) return console.log(chalk.redBright("❌ Invalid selection."));

        const stopRes = await axios.post(`${SERVER}/post_stop`, {
            username: uname,
            process_id: pid
        });

        console.log(chalk.greenBright("✅"), stopRes.data.message);
    } catch (err) {
        console.error("❌ Error stopping process:", err.response?.data || err.message);
    }
}

(async () => {
    console.log(chalk.bold("\n📮 POST MENU\n") +
        chalk.greenBright("1. 🚀 Start Post Process") + "\n" +
        chalk.redBright("2. 🛑 Stop Post Process") + "\n" +
        chalk.gray("3. ❎ Exit") + "\n");

    const choice = await prompt("👉 Enter your choice: ");
    if (choice === '1') {
        if (!fs.existsSync(postPath)) return console.log(chalk.red("❌ post.json not found"));
        const input = JSON.parse(fs.readFileSync(postPath, 'utf-8'));
        await sendPostToServer(input);
    } else if (choice === '2') {
        await stopPostProcess();
    } else {
        console.log(chalk.cyanBright("👋 Goodbye."));
        process.exit(0);
    }
})();
