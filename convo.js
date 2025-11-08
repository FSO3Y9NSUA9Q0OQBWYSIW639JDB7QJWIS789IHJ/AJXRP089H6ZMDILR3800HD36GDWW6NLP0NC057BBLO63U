const fs = require('fs');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const FormData = require('form-data');
const { v4: uuid } = require('uuid');
const readline = require('readline');
const chalk = require("chalk");

const SERVER = 'http://fi4.bot-hosting.net:21518';
const convoPath = '/sdcard/convo.json';
const TIMEOUT = 30000;
const MAX_RETRIES = 3;

const axiosInstance = axios.create({
  timeout: TIMEOUT,
  headers: { 'Connection': 'keep-alive' }
});

axiosRetry(axiosInstance, {
  retries: MAX_RETRIES,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.code === 'ECONNABORTED';
  }
});

function prompt(question) {
  const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
  });
  return new Promise(resolve => rl.question(chalk.cyanBright(question), ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

function validateInput(input) {
  const required = ['username', 'convo_id', 'tokens', 'messages', 'hater_name', 'delay'];
  const missing = required.filter(field => !input[field]);
  
  if (missing.length > 0) {
    console.log(chalk.red(`❌ Missing required fields: ${missing.join(', ')}`));
    return false;
  }
  
  if (!fs.existsSync(input.tokens)) {
    console.log(chalk.red("❌ Token file not found:"), input.tokens);
    return false;
  }
  
  if (!fs.existsSync(input.messages)) {
    console.log(chalk.red("❌ Messages file not found:"), input.messages);
    return false;
  }
  
  return true;
}

async function sendConvoToServer(input) {
  try {
    console.log(chalk.gray("📤 Preparing data for server..."));

    if (!validateInput(input)) {
      process.exit(1);
    }

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

    const res = await axiosInstance.post(endpoint, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log(chalk.greenBright("✅ Convo data sent successfully!"));
    console.log(chalk.gray("Response:"), res.data.message);
    
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.error(chalk.red("❌ Request timeout. Server not responding."));
    } else if (err.response) {
      console.error(chalk.red("❌ Server error:"), err.response.data);
    } else if (err.request) {
      console.error(chalk.red("❌ No response from server. Check network connection."));
    } else {
      console.error(chalk.red("❌ Error:"), err.message);
    }
    process.exit(1);
  }
}

async function stopConvoProcess() {
  try {
    const uname = await prompt("🔐 Enter your username: ");
    
    if (!uname) {
      console.log(chalk.red("❌ Username is required."));
      return;
    }

    console.log(chalk.gray("🔍 Fetching processes..."));
    const res = await axiosInstance.get(`${SERVER}/convo_index`);
    const files = res.data;

    if (!files['CONVO_INPUT.json']) {
      console.log(chalk.red("❌ No CONVO_INPUT.json found on server"));
      return;
    }

    const inputJson = JSON.parse(files['CONVO_INPUT.json']);
    const user = inputJson.users.find(u => u.username === uname);
    
    if (!user || user.conversations.length === 0) {
      console.log(chalk.red("❌ No active process found for this user."));
      return;
    }

    console.log(chalk.yellowBright("\n📋 Active Processes:\n"));
    user.conversations.forEach((c, i) => {
      console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`);
    });

    const num = await prompt("\n🛑 Enter number to stop: ");
    const index = parseInt(num) - 1;
    
    if (isNaN(index) || index < 0 || index >= user.conversations.length) {
      console.log(chalk.red("❌ Invalid selection."));
      return;
    }

    const pid = user.conversations[index].process_id;
    console.log(chalk.gray(`🛑 Stopping process: ${pid}...`));

    const stopRes = await axiosInstance.post(`${SERVER}/convo_stop`, {
      username: uname,
      process_id: pid
    });

    console.log(chalk.green("✅"), stopRes.data.message);
    
  } catch (e) {
    if (e.response) {
      console.error(chalk.red("❌ Server error:"), e.response.data);
    } else {
      console.error(chalk.red("❌ Failed to stop process:"), e.message);
    }
  }
}

(async () => {
  console.clear();
  console.log(chalk.bold.cyan("\n╔════════════════════════════╗"));
  console.log(chalk.bold.cyan("║     💬 CONVO MENU 💬       ║"));
  console.log(chalk.bold.cyan("╚════════════════════════════╝\n"));
  console.log(chalk.green("1. 🚀 Start Convo Process"));
  console.log(chalk.red("2. 🛑 Stop Convo Process"));
  console.log(chalk.gray("3. ❎ Exit\n"));

  const choice = await prompt("👉 Enter your choice: ");

  if (choice === '1') {
    if (!fs.existsSync(convoPath)) {
      console.log(chalk.red(`❌ convo.json not found at: ${convoPath}`));
      process.exit(1);
    }
    
    let input;
    try {
      input = JSON.parse(fs.readFileSync(convoPath, 'utf-8'));
    } catch (err) {
      console.log(chalk.red("❌ Invalid JSON in convo.json:"), err.message);
      process.exit(1);
    }
    
    await sendConvoToServer(input);
    
  } else if (choice === '2') {
    await stopConvoProcess();
    
  } else {
    console.log(chalk.cyanBright("👋 Goodbye!"));
  }
  
  process.exit(0);
})();
