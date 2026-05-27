const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const OpenAI = require('openai');
const express = require('express');
const { RSI } = require('technicalindicators');

const app = express();

// ======================
// 环境变量
// ======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!BOT_TOKEN || !OPENROUTER_API_KEY) {
    console.log("❌ 缺少环境变量");
    process.exit(1);
}

// ======================
// Telegram
// ======================
const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

// ======================
// OpenRouter
// ======================
const ai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY,
});

// ======================
// 你的 Telegram ID
// ======================

// 先随便给机器人发一句话
// 然后访问：
// https://api.telegram.org/bot你的TOKEN/getUpdates

const CHAT_ID = '你的CHAT_ID';

// ======================
// 获取币安合约行情
// ======================
async function getTicker(symbol) {

    try {

        const url =
            `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`;

        const response = await axios.get(url);

        return response.data;

    } catch (error) {

        return null;
    }
}

// ======================
// 获取K线
// ======================
async function getKlines(symbol) {

    try {

        const url =
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=30`;

        const response = await axios.get(url);

        return response.data;

    } catch (error) {

        return null;
    }
}

// ======================
// AI分析
// ======================
async function getAIAnalysis(data) {

    try {

        const completion =
            await ai.chat.completions.create({

                model: "deepseek/deepseek-chat-v3-0324:free",

                messages: [

                    {
                        role: "system",
                        content: `
你是专业合约交易员。

请分析：

1. 是否是假突破
2. 是否适合追高
3. 风险等级
4. 短线趋势

回答简洁专业。
`
                    },

                    {
                        role: "user",
                        content: `
交易对:
${data.symbol}

价格:
${data.price}

涨幅:
${data.change}%

成交量倍数:
${data.volumeRatio}

RSI:
${data.rsi}
`
                    }

                ]
            });

        return completion.choices[0].message.content;

    } catch (error) {

        console.log(error.message);

        return "AI分析失败";
    }
}

// ======================
// 扫描器
// ======================
async function scanMarket() {

    console.log("🔍 扫描市场...");

    const symbols = [
        'BTCUSDT',
        'ETHUSDT',
        'SOLUSDT',
        'DOGEUSDT',
        'XRPUSDT'
    ];

    for (const symbol of symbols) {

        try {

            const ticker = await getTicker(symbol);

            const klines = await getKlines(symbol);

            if (!ticker || !klines) continue;

            // 价格
            const price = parseFloat(ticker.lastPrice);

            // 24h涨跌
            const change =
                parseFloat(ticker.priceChangePercent);

            // 成交量
            const volumes =
                klines.map(k => parseFloat(k[5]));

            const avgVolume =
                volumes.reduce((a, b) => a + b, 0) / volumes.length;

            const lastVolume =
                volumes[volumes.length - 1];

            const volumeRatio =
                (lastVolume / avgVolume).toFixed(2);

            // RSI
            const closes =
                klines.map(k => parseFloat(k[4]));

            const rsi =
                RSI.calculate({
                    values: closes,
                    period: 14
                });

            const lastRSI =
                rsi[rsi.length - 1]?.toFixed(2);

            // 条件
            const isPump =
                change > 3 || volumeRatio > 2;

            if (isPump) {

                console.log(`🚨 ${symbol} 异动`);

                const aiAnalysis =
                    await getAIAnalysis({
                        symbol,
                        price,
                        change,
                        volumeRatio,
                        rsi: lastRSI
                    });

                const message = `
🚨 ${symbol} 异动警报

💰 价格:
${price}

📈 24h涨幅:
${change.toFixed(2)}%

📊 成交量倍数:
${volumeRatio}x

🔥 RSI:
${lastRSI}

🤖 AI分析:
${aiAnalysis}
`;

                await bot.sendMessage(CHAT_ID, message);
            }

        } catch (error) {

            console.log(error.message);
        }
    }
}

// ======================
// /start
// ======================
bot.onText(/\/start/, (msg) => {

    bot.sendMessage(
        msg.chat.id,
        `
🤖 币安合约监控Agent

功能：

✅ 自动扫描异动
✅ 爆量检测
✅ RSI分析
✅ AI分析
✅ Telegram推送
`
    );
});

// ======================
// 获取 CHAT_ID
// ======================
bot.on('message', async (msg) => {

    console.log("CHAT_ID:", msg.chat.id);
});

// ======================
// 定时扫描
// ======================
setInterval(() => {

    scanMarket();

}, 1000 * 60 * 5);

// ======================
// Render 保活
// ======================
app.get('/', (req, res) => {
    res.send('Binance Futures Agent Running');
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

    console.log(`🚀 Server on ${PORT}`);
});

console.log("🤖 币安合约Agent已启动");