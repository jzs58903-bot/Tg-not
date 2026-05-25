const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('❌ 未找到 BOT_TOKEN');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/price (.+)/, async (msg, match) => {
    const symbol = match[1].toUpperCase();
    const chatId = msg.chat.id;

    // 立即回复一个“查询中...”避免用户重复发送
    bot.sendMessage(chatId, `🔍 正在查询 ${symbol}USDT ...`);

    try {
        // 方法1：使用 Binance 公共 API
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`;
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data && response.data.price) {
            const price = parseFloat(response.data.price).toFixed(2);
            bot.sendMessage(chatId, `💰 ${symbol}USDT 现价：${price} USDT`);
        } else {
            bot.sendMessage(chatId, `❌ API 返回数据异常：${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        console.error('API 错误详情:', error.message);
        // 将详细错误信息发给用户（帮助调试）
        let errorMsg = `❌ 获取失败\n`;
        if (error.response) {
            // Binance 返回了错误状态码（比如 404）
            errorMsg += `状态码: ${error.response.status}\n`;
            errorMsg += `错误内容: ${JSON.stringify(error.response.data)}`;
        } else if (error.request) {
            // 请求发出但没有收到响应（网络问题）
            errorMsg += `网络问题：未收到 Binance 响应\n${error.message}`;
        } else {
            errorMsg += `请求错误：${error.message}`;
        }
        bot.sendMessage(chatId, errorMsg);
    }
});

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, '🤖 机器人已启动！试试 /price BTC\n如果出错，我会告诉你具体原因。');
});

console.log('🚀 机器人已启动（增强版）');
const http = require('http');
const server = http.createServer((req, res) => res.end('ok'));
server.listen(3000, () => console.log('HTTP server on 3000'));
