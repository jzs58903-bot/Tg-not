const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const http = require('http');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('❌ 未找到 BOT_TOKEN');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// CoinGecko 支持的币种 ID 映射 (小写)
const coinMap = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'SOL': 'solana',
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'ADA': 'cardano'
};

bot.onText(/\/price (.+)/, async (msg, match) => {
    const symbol = match[1].toUpperCase();
    const chatId = msg.chat.id;
    const coinId = coinMap[symbol];

    if (!coinId) {
        bot.sendMessage(chatId, `❌ 暂不支持 ${symbol}，目前支持：BTC, ETH, BNB, SOL, XRP, DOGE, ADA`);
        return;
    }

    bot.sendMessage(chatId, `🔍 正在查询 ${symbol} 价格 (via CoinGecko)...`);

    try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        const response = await axios.get(url, { timeout: 10000 });
        const price = response.data[coinId]?.usd;
        if (price) {
            bot.sendMessage(chatId, `💰 ${symbol} 现价：$${price.toFixed(2)} USD`);
        } else {
            bot.sendMessage(chatId, `❌ 未获取到价格，请稍后再试`);
        }
    } catch (error) {
        console.error('CoinGecko 错误:', error.message);
        bot.sendMessage(chatId, `❌ 网络错误，请稍后重试\n详情：${error.message}`);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '🤖 机器人已启动！\n支持币种：BTC, ETH, BNB, SOL, XRP, DOGE, ADA\n用法：/price BTC');
});

console.log('🚀 机器人已启动 (CoinGecko 版本)');

const server = http.createServer((req, res) => res.end('ok'));
server.listen(3000, () => console.log('HTTP server on 3000'));