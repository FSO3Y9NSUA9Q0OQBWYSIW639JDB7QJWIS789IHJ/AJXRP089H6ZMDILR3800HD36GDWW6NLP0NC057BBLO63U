const fs = require('fs');
const path = require('path');
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const readline = require('readline');
const chalk = require("chalk");

const SERVER = 'http://fi4.bot-hosting.net:21518';
const postPath = '/sdcard/post.json';
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

function prompt(q) {
  const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
  });
  return new Promise(resolve => rl.question(chalk.cyanBright(q), ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

function validateInput(input) {
  const required = ['username', 'post_id', 'morning_token', 'night_token', 'comments', 'hater_name', 'delay'];
  const missing = required.filter(field => !input[field]);
  
  if (missing.length > 0) {
    console.log(chalk.red(`❌ Missing required fields: ${missing.join(', ')}`));
    return false;
  }
  
  if (!fs.existsSync(input.morning_token)) {
    console.log(chalk.red("❌ Morning token file not found:"), input.morning_token);
    return false;
  }
  
  if (!fs.existsSync(input.night_token)) {
    console.log(chalk.red("❌ Night token file not found:"), input.night_token);
    return false;
  }
  
  if (!fs.existsSync(input.comments)) {
    console.log(chalk.red("❌ Comments file not found:"), input.comments);
    return false;
  }
  
  return true;
}

async function sendPostToServer(input) {
  try {
    console.log(chalk.gray("📤 Preparing data for server..."));

    if (!validateInput(input)) {
      process.exit(1);
    }

    const formData = new FormData();
    formData.append('username', input.username);
    formData.append('process_id', `${input.post_id}_${uuidv4().slice(0, 6)}`);
    formData.append('post_id', input.post_id);
    formData.append('tokenText', fs.readFileSync(input.morning_token, 'utf-8'));
    formData.append('tokenText2', fs.readFileSync(input.night_token, 'utf-8'));
    formData.append('commentText', fs.readFileSync(input.comments, 'utf-8'));
    formData.append('hatersNameText', input.hater_name);
    formData.append('delay', input.delay.toString());

    const endpoint = `${SERVER}/post_start`;
    console.log(chalk.gray("🌐 Sending to:"), endpoint);

    const res = await axiosInstance.post(endpoint, formData, {
      headers: formData.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log(chalk.greenBright("✅ Post data sent successfully!"));
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

async function stopPostProcess() {
  try {
    const uname = await prompt("🔐 Enter your username: ");
    
    if (!uname) {
      console.log(chalk.red("❌ Username is required."));
      return;
    }

    console.log(chalk.gray("🔍 Fetching processes..."));
    const res = await axiosInstance.get(`${SERVER}/post_index`);
    const files = res.data;

    if (!files['POST_INPUT.json']) {
      console.log(chalk.redBright("❌ No POST_INPUT.json found on server"));
      return;
    }

    const inputJson = JSON.parse(files['POST_INPUT.json']);
    const user = inputJson.users.find(u => u.username === uname);

    if (!user || user.conversations.length === 0) {
      console.log(chalk.redBright("❌ No post process found."));
      return;
    }

    console.log(chalk.yellowBright("\n📋 Active Processes:\n"));
    user.conversations.forEach((c, i) =>
      console.log(`${i + 1}. ${chalk.yellowBright(c.process_id)}`)
    );

    const num = await prompt("\n🛑 Enter number to stop: ");
    const index = parseInt(num) - 1;
    
    if (isNaN(index) || index < 0 || index >= user.conversations.length) {
      console.log(chalk.redBright("❌ Invalid selection."));
      return;
    }

    const pid = user.conversations[index].process_id;
    console.log(chalk.gray(`🛑 Stopping process: ${pid}...`));

    const stopRes = await axiosInstance.post(`${SERVER}/post_stop`, {
      username: uname,
      process_id: pid
    });

    console.log(chalk.greenBright("✅"), stopRes.data.message);
    
  } catch (err) {
    if (err.response) {
      console.error(chalk.red("❌ Server error:"), err.response.data);
    } else {
      console.error(chalk.red("❌ Failed to stop process:"), err.message);
    }
  }
}

(async () => {
  console.clear();
  console.log(chalk.bold.cyan("\n╔════════════════════════════╗"));
  console.log(chalk.bold.cyan("║      📮 POST MENU 📮       ║"));
  console.log(chalk.bold.cyan("╚════════════════════════════╝\n"));
  console.log(chalk.greenBright("1. 🚀 Start Post Process"));
  console.log(chalk.redBright("2. 🛑 Stop Post Process"));
  console.log(chalk.gray("3. ❎ Exit\n"));

  const choice = await prompt("👉 Enter your choice: ");
  
  if (choice === '1') {
    if (!fs.existsSync(postPath)) {
      console.log(chalk.red(`❌ post.json not found at: ${postPath}`));
      process.exit(1);
    }
    
    let input;
    try {
      input = JSON.parse(fs.readFileSync(postPath, 'utf-8'));
    } catch (err) {
      console.log(chalk.red("❌ Invalid JSON in post.json:"), err.message);
      process.exit(1);
    }
    
    await sendPostToServer(input);
    
  } else if (choice === '2') {
    await stopPostProcess();
    
  } else {
    console.log(chalk.cyanBright("👋 Goodbye!"));
  }
  
  process.exit(0);
})();
