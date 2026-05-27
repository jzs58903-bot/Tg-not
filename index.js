const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const OpenAI = require('openai');
const express = require('express');

const app = express();

// ======================
// 环境变量
// ======================
const BOT_TOKEN = process.env.BOT_TOKEN;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!BOT_TOKEN || !DEEPSEEK_API_KEY) {
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
// DeepSeek
// ======================
const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: DEEPSEEK_API_KEY,
});

// ======================
// 支持币种
// ======================
const coinMap = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    SOL: 'solana',
    XRP: 'ripple',
    DOGE: 'dogecoin',
    ADA: 'cardano'
};

// ======================
// 获取市场数据
// ======================
async function getMarketData(symbol) {

    const coinId = coinMap[symbol];

    if (!coinId) return null;

    try {

        const url =
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinId}`;

        const response = await axios.get(url);

        const data = response.data[0];

        return {
            symbol,
            price: data.current_price,
            marketCap: data.market_cap,
            volume: data.total_volume,
            change24h: data.price_change_percentage_24h,
            athChange: data.ath_change_percentage
        };

    } catch (error) {

        console.log("CoinGecko错误：", error.message);

        return null;
    }
}

// ======================
// AI分析
// ======================
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

        let marketInfo = "未识别到币种";

        // 获取市场数据
        if (symbol) {

            const data = await getMarketData(symbol);

            if (data) {

                marketInfo = `
币种: ${data.symbol}

当前价格:
$${data.price}

24h涨跌:
${data.change24h.toFixed(2)}%

市值:
$${data.marketCap.toLocaleString()}

24h成交量:
$${data.volume.toLocaleString()}

距离历史最高点:
${data.athChange.toFixed(2)}%
`;
            }
        }

        const completion =
            await deepseek.chat.completions.create({

                model: "deepseek-chat",

                messages: [

                    {
                        role: "system",
                        content: `
你是专业加密货币交易员。

请根据市场数据分析：

1. 当前趋势
2. 风险等级
3. 是否适合短线
4. 支撑阻力
5. 是否适合追高

要求：

- 用中文
- 专业
- 简洁
- 像真实交易员
- 先给一句总结
`
                    },

                    {
                        role: "user",
                        content: `
用户问题:
${userMessage}

市场数据:
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

// ======================
// /start
// ======================
bot.onText(/\/start/, async (msg) => {

    const text = `
🤖 AI交易Agent

直接发送：

- 分析BTC
- ETH能买吗
- SOL趋势怎么样
- DOGE风险大吗

功能：

✅ AI分析
✅ 市场数据
✅ 风险评级
✅ 趋势分析
`;

    bot.sendMessage(msg.chat.id, text);
});

// ======================
// /price
// ======================
bot.onText(/\/price (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;

    const symbol = match[1].toUpperCase();

    const data = await getMarketData(symbol);

    if (!data) {

        bot.sendMessage(chatId, "❌ 不支持币种");

        return;
    }

    const message = `
💰 ${symbol} 市场数据

价格:
$${data.price}

24h涨跌:
${data.change24h.toFixed(2)}%

市值:
$${data.marketCap.toLocaleString()}

24h成交量:
$${data.volume.toLocaleString()}
`;

    bot.sendMessage(chatId, message);
});

// ======================
// 普通聊天
// ======================
bot.on('message', async (msg) => {

    const text = msg.text;

    if (!text) return;

    // 跳过命令
    if (text.startsWith('/')) return;

    const chatId = msg.chat.id;

    await bot.sendMessage(chatId, "🤖 AI分析中...");

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

// ======================
// Render 保活
// ======================
app.get('/', (req, res) => {
    res.send('AI Trading Agent Running');
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
});

console.log("🤖 AI交易机器人已启动");