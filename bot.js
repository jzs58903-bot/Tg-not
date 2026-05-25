const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');
const OpenAI = require("openai");   // 新增：调用 DeepSeek 需要

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('❌ 未找到 BOT_TOKEN');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// ---------- 1. 初始化 DeepSeek 客户端 ----------
const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

// ---------- 2. 原有的 price 命令（CoinGecko）----------
const coinMap = {
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin',
    'SOL': 'solana', 'XRP': 'ripple', 'DOGE': 'dogecoin', 'ADA': 'cardano'
};

bot.onText(/\/price (.+)/, async (msg, match) => {
    const symbol = match[1].toUpperCase();
    const chatId = msg.chat.id;
    const coinId = coinMap[symbol];
    if (!coinId) {
        bot.sendMessage(chatId, `❌ 支持：BTC, ETH, BNB, SOL, XRP, DOGE, ADA`);
        return;
    }
    bot.sendMessage(chatId, `🔍 查询 ${symbol} 价格...`);
    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        const res = await axios.get(url, { timeout: 10000 });
        const price = res.data[coinId]?.usd;
        if (price) bot.sendMessage(chatId, `💰 ${symbol} = $${price.toFixed(2)}`);
        else bot.sendMessage(chatId, `❌ 未获取到价格`);
    } catch (e) {
        bot.sendMessage(chatId, `❌ 错误：${e.message}`);
    }
});

// ---------- 3. 调用 DeepSeek 的核心函数 ----------
async function getDeepSeekReply(userMessage) {
    try {
        const completion = await deepseek.chat.completions.create({
            messages: [
                // 可选：设置“系统提示词”让AI更像交易顾问（可自行修改）
                {
                    role: "system",
                    content: "你是一个加密货币交易顾问。回答要专业、客观、简洁。分析代币时包含：发射台、Top10持仓、流动性/市值比、开发者状态。先一句话给结论，再展开细节。"
                },
                { role: "user", content: userMessage }
            ],
            model: "deepseek-v4-flash",   // 性价比高的模型
        });
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('DeepSeek API 调用错误:', error);
        return null;
    }
}

// ---------- 4. 监听所有消息，处理非命令的对话 ----------
bot.on('message', async (msg) => {
    const text = msg.text;
    if (!text) return;
    if (text.startsWith('/')) return;   // 命令交给上面的处理器

    const chatId = msg.chat.id;
    const reply = await getDeepSeekReply(text);
    if (reply) {
        await bot.sendMessage(chatId, reply);
    } else {
        await bot.sendMessage(chatId, '抱歉，AI服务暂时不可用，请稍后再试。');
    }
});

// ---------- 5. /start 命令 ----------
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 
        `🤖 *交易顾问机器人*
/price BTC - 价格查询
直接发送任何问题，我会用DeepSeek回答你。`,
        { parse_mode: 'Markdown' }
    );
});

console.log('🚀 机器人已启动（DeepSeek版）');

// 保持 Render 不因为无端口而休眠
const server = http.createServer((req, res) => res.end('ok'));
server.listen(3000, () => console.log('HTTP server on 3000'));