const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('请设置环境变量 BOT_TOKEN');
    process.exit(1);
}
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/price (.+)/, async (msg, match) => {
    const symbol = match[1].toUpperCase();
    const chatId = msg.chat.id;
    try {
        const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`);
        const price = res.data.price;
        bot.sendMessage(chatId, `${symbol} 当前价格: ${price} USDT`);
    } catch (e) {
        bot.sendMessage(chatId, '获取失败，请检查币种名（例如 BTC）');
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '你好！试试 /price BTC');
});

console.log('机器人已启动...');
