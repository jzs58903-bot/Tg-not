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
// 你的 Telegram CHAT_ID
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
// OpenRouter AI
// =========================
const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: OPENROUTER_API_KEY
});

console.log('🤖 AI合约监控Agent已启动');

// =========================
// 自动获取高成交量币种
// =========================
async function getTopSymbols() {

    try {

        const url =
            'https://fapi.binance.com/fapi/v1/ticker/24hr';

        const res = await axios.get(url);

        const data = res.data;

        // 过滤
        const filtered = data.filter(item => {

            const volume =
                parseFloat(item.quoteVolume);

            return (
                item.symbol.endsWith('USDT') &&
                volume > 1000000 && // 100万美元以上
                !item.symbol.includes('BUSD') &&
                !item.symbol.includes('USDC')
            );
        });

        // 按成交量排序
        filtered.sort((a, b) =>
            parseFloat(b.quoteVolume) -
            parseFloat(a.quoteVolume)
        );

        // 取前50
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
async function aiAnalysis(symbol, price, change, rsi) {

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

请输出：

1. 趋势
2. 风险
3. 是否适合追多
4. 是否可能回调

控制在100字内。
`;

        const completion =
            await openai.chat.completions.create({

                model:
                    'deepseek/deepseek-chat-v3-0324:free',

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
// 市场扫描
// =========================
async function scanMarket() {

    console.log('🔍 扫描市场...');

    // 自动获取币种
    const symbols = await getTopSymbols();

    console.log(`📊 扫描币种数量: ${symbols.length}`);

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

            // 当前价格
            const last =
                closes[closes.length - 1];

            // 前一根K线
            const prev =
                closes[closes.length - 2];

            // 5分钟涨跌
            const change =
                ((last - prev) / prev) * 100;

            // RSI
            const rsiData =
                RSI.calculate({
                    values: closes,
                    period: 14
                });

            const rsi =
                rsiData[rsiData.length - 1];

            // 成交量
            const avgVolume =
                volumes.reduce((a, b) => a + b, 0)
                / volumes.length;

            const lastVolume =
                volumes[volumes.length - 1];

            const volumeRatio =
                lastVolume / avgVolume;

            // =========================
            // 异动条件
            // =========================
            const isPump =
                Math.abs(change) >= 1;

            const isRSI =
                rsi >= 75 || rsi <= 25;

            const isVolume =
                volumeRatio >= 2;

            if (
                isPump ||
                isRSI ||
                isVolume
            ) {

                // 防止重复报警
                const now = Date.now();

                const lastAlert =
                    alertCache.get(symbol);

                if (
                    lastAlert &&
                    now - lastAlert < 30 * 60 * 1000
                ) {
                    continue;
                }

                alertCache.set(symbol, now);

                console.log(`🚨 ${symbol} 异动`);

                // AI分析
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

📈 5分钟涨跌:
${change.toFixed(2)}%

📊 RSI:
${rsi.toFixed(2)}

🔥 成交量倍数:
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
🤖 AI合约监控Agent

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
// 手动聊天
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
                    'deepseek/deepseek-chat-v3-0324:free',

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

        console.log(e.message);

        await bot.sendMessage(
            chatId,
            '❌ AI服务异常'
        );
    }
});

// =========================
// 每5分钟扫描一次
// =========================
setInterval(() => {

    scanMarket();

}, 5 * 60 * 1000);

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