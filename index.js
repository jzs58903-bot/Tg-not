const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');
const OpenAI = require('openai');
const { RSI } = require('technicalindicators');

// =========================
// 环境变量
// =========================
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// =========================
// Telegram CHAT_ID
// =========================
const CHAT_ID = '7181633439';

// =========================
// 检查环境变量
// =========================
if (!BOT_TOKEN || !OPENROUTER_API_KEY) {

    console.log('❌ 缺少环境变量');

    process.exit(1);
}

// =========================
// Telegram Bot
// =========================
const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

// =========================
// OpenRouter
// =========================
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY
});

console.log('🤖 AI交易Agent启动成功');

// =========================
// 自动获取热门币种
// =========================
async function getTopSymbols() {

    try {

        const url =
            'https://fapi.binance.com/fapi/v1/ticker/24hr';

        const res = await axios.get(url);

        const data = res.data;

        const filtered = data.filter(item => {

            const volume =
                parseFloat(item.quoteVolume);

            return (
                item.symbol.endsWith('USDT') &&
                volume > 1000000 &&
                !item.symbol.includes('BUSD') &&
                !item.symbol.includes('USDC')
            );
        });

        filtered.sort((a, b) =>
            parseFloat(b.quoteVolume) -
            parseFloat(a.quoteVolume)
        );

        return filtered
            .slice(0, 50)
            .map(item => item.symbol);

    } catch (e) {

        console.log('❌ 获取币种失败');

        return [];
    }
}

// =========================
// 获取K线
// =========================
async function getKlines(symbol) {

    try {

        const url =
            `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=5m&limit=100`;

        const res = await axios.get(url);

        return res.data;

    } catch (e) {

        console.log(`❌ ${symbol} K线失败`);

        return null;
    }
}

// =========================
// AI分析
// =========================
async function aiAnalysis(
    symbol,
    price,
    change,
    rsi
) {

    try {

        const prompt = `
你是专业加密货币交易员。

请分析：

币种:
${symbol}

价格:
${price}

5分钟涨跌:
${change}%

RSI:
${rsi}

输出：

1. 趋势
2. 风险
3. 是否适合追多
4. 是否可能回调

控制在100字内。
`;

        const completion =
            await openai.chat.completions.create({

                model:
                    'openai/gpt-3.5-turbo',

                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

        return completion
            .choices[0]
            .message
            .content;

    } catch (e) {

        console.log('❌ AI错误:', e.message);

        return 'AI分析失败';
    }
}

// =========================
// 防重复报警
// =========================
const alertCache = new Map();

// =========================
// 扫描市场
// =========================
async function scanMarket() {

    console.log('🔍 扫描市场...');

    const symbols =
        await getTopSymbols();

    console.log(`📊 扫描数量: ${symbols.length}`);

    for (const symbol of symbols) {

        try {

            const klines =
                await getKlines(symbol);

            if (!klines) continue;

            const closes =
                klines.map(k =>
                    parseFloat(k[4])
                );

            const volumes =
                klines.map(k =>
                    parseFloat(k[5])
                );

            const last =
                closes[closes.length - 1];

            const prev =
                closes[closes.length - 2];

            const change =
                ((last - prev) / prev) * 100;

            const rsiData =
                RSI.calculate({
                    values: closes,
                    period: 14
                });

            const rsi =
                rsiData[rsiData.length - 1];

            const avgVolume =
                volumes.reduce((a, b) => a + b, 0)
                / volumes.length;

            const lastVolume =
                volumes[volumes.length - 1];

            const volumeRatio =
                lastVolume / avgVolume;

            // =========================
            // 测试模式
            // =========================

            if (true) {

                const now = Date.now();

                const lastAlert =
                    alertCache.get(symbol);

                if (
                    lastAlert &&
                    now - lastAlert <
                    30 * 60 * 1000
                ) {
                    continue;
                }

                alertCache.set(symbol, now);

                console.log(`🚨 ${symbol} 异动`);

                const analysis =
                    await aiAnalysis(
                        symbol,
                        last,
                        change.toFixed(2),
                        rsi.toFixed(2)
                    );

                const message = `
🚨 *${symbol} 异动警报*

💰 价格:
${last}

📈 涨跌:
${change.toFixed(2)}%

📊 RSI:
${rsi.toFixed(2)}

🔥 成交量:
${volumeRatio.toFixed(2)}x

🤖 AI分析:
${analysis}
`;

                await bot.sendMessage(
                    CHAT_ID,
                    message,
                    {
                        parse_mode: 'Markdown'
                    }
                );
            }

        } catch (e) {

            console.log(`❌ ${symbol} 扫描失败`);
        }
    }
}

// =========================
// /start
// =========================
bot.onText(/\/start/, (msg) => {

    bot.sendMessage(
        msg.chat.id,
`
🤖 AI交易Agent

功能：

✅ 自动扫描热门合约
✅ RSI异动检测
✅ 爆量检测
✅ AI趋势分析
✅ Telegram自动推送

自动扫描：

BTC
ETH
SOL
PEPE
MEME
热门山寨
`
    );
});

// =========================
// AI聊天
// =========================
bot.on('message', async (msg) => {

    const text = msg.text;

    if (!text) return;

    if (text.startsWith('/')) return;

    const chatId = msg.chat.id;

    await bot.sendMessage(
        chatId,
        '🤖 AI分析中...'
    );

    try {

        const completion =
            await openai.chat.completions.create({

                model:
                    'openai/gpt-3.5-turbo',

                messages: [

                    {
                        role: 'system',
                        content:
                            '你是专业加密货币交易员。'
                    },

                    {
                        role: 'user',
                        content: text
                    }
                ]
            });

        const reply =
            completion
            .choices[0]
            .message
            .content;

        await bot.sendMessage(
            chatId,
            reply
        );

    } catch (e) {

        console.log('❌ 聊天错误:', e.message);

        await bot.sendMessage(
            chatId,
            '❌ AI服务异常'
        );
    }
});

// =========================
// 每30秒扫描一次
// =========================
setInterval(() => {

    scanMarket();

}, 30 * 1000);

// =========================
// 启动立即扫描
// =========================
scanMarket();

// =========================
// Render 保活
// =========================
const server = http.createServer((req, res) => {

    res.end('ok');
});

const PORT =
    process.env.PORT || 10000;

server.listen(PORT, () => {

    console.log(`🚀 Server on ${PORT}`);
});