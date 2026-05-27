const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const OpenAI = require('openai');
const express = require('express');

const app = express();

// =========================
// 环境变量
// =========================
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!BOT_TOKEN) {
    console.log("❌ 缺少 BOT_TOKEN");
    process.exit(1);
}

if (!DEEPSEEK_API_KEY) {
    console.log("❌ 缺少 DEEPSEEK_API_KEY");
    process.exit(1);
}

// =========================
// Telegram Bot
// =========================
const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

// =========================
// DeepSeek Client
// =========================
const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: DEEPSEEK_API_KEY,
});

// =========================
// 支持币种
// =========================
const coinMap = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    SOL: 'solana',
    XRP: 'ripple',
    DOGE: 'dogecoin',
    ADA: 'cardano'
};

// =========================
// 获取币价
// =========================
async function getCoinPrice(symbol) {
    const coinId = coinMap[symbol];

    if (!coinId) return null;

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;

    const response = await axios.get(url);

    return response.data[coinId];
}

// =========================
// AI分析函数
// =========================
async function getAIAnalysis(userMessage) {

    try {

        // 自动识别币种
        let symbol = null;

        for (const coin of Object.keys(coinMap)) {
            if (userMessage.toUpperCase().includes(coin)) {
                symbol = coin;
                break;
            }
        }

        let marketInfo = "";

        // 如果识别到币种 → 自动获取行情
        if (symbol) {

            const data = await getCoinPrice(symbol);

            if (data) {
                marketInfo = `
币种：${symbol}
当前价格：$${data.usd}
24小时涨跌幅：${data.usd_24h_change?.toFixed(2)}%
`;
            }
        }

        const completion = await deepseek.chat.completions.create({

            model: "deepseek-chat",

            messages: [

                {
                    role: "system",
                    content: `
你是专业加密货币交易分析师。

要求：

1. 先一句话总结结论
2. 再分析趋势
3. 给出风险提示
4. 用中文回答
5. 专业但简洁
`
                },

                {
                    role: "user",
                    content: `
用户问题：
${userMessage}

市场数据：
${marketInfo}
`
                }

            ],

            temperature: 0.7,
        });

        return completion.choices[0].message.content;

    } catch (error) {

        console.log("DeepSeek错误：", error.message);

        return null;
    }
}

// =========================
// /start
// =========================
bot.onText(/\/start/, async (msg) => {

    const text = `
🤖 AI交易顾问机器人

功能：

/price BTC  查询价格

直接发送：
- 分析BTC
- ETH现在能买吗
- SOL趋势怎么样

我会自动分析市场。
`;

    bot.sendMessage(msg.chat.id, text);
});

// =========================
// /price
// =========================
bot.onText(/\/price (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;

    const symbol = match[1].toUpperCase();

    try {

        const data = await getCoinPrice(symbol);

        if (!data) {

            bot.sendMessage(chatId, "❌ 不支持该币种");

            return;
        }

        const message = `
💰 ${symbol} 行情

价格：$${data.usd}

24h涨跌：
${data.usd_24h_change.toFixed(2)}%
`;

        bot.sendMessage(chatId, message);

    } catch (error) {

        bot.sendMessage(chatId, "❌ 获取价格失败");
    }
});

// =========================
// 普通聊天
// =========================
bot.on('message', async (msg) => {

    const text = msg.text;

    if (!text) return;

    // 跳过命令
    if (text.startsWith('/')) return;

    const chatId = msg.chat.id;

    // 先发送“思考中”
    const waitingMsg = await bot.sendMessage(chatId, "🤔 AI分析中...");

    const reply = await getAIAnalysis(text);

    if (reply) {

        await bot.sendMessage(chatId, reply);

    } else {

        await bot.sendMessage(
            chatId,
            "❌ AI服务暂时不可用"
        );
    }

});

// =========================
// Render 保活
// =========================
app.get('/', (req, res) => {
    res.send('Bot Running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});

console.log("🤖 AI交易机器人已启动");