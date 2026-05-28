require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!BOT_TOKEN || !CHAT_ID || !OPENROUTER_API_KEY) {
  console.log("❌ 缺少环境变量");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
});

const app = express();

app.get("/", (req, res) => {
  res.send("Bot Running");
});

app.listen(3000, () => {
  console.log("🌐 Web Server Running");
});

console.log("🤖 Telegram Bot Running");

async function analyzeCoin(symbol) {
  try {
    const pair = `${symbol.toUpperCase()}USDT`;

    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=15m&limit=50`;

    const response = await axios.get(url);

    const candles = response.data;

    if (!candles || candles.length === 0) {
      return "❌ 获取行情失败";
    }

    const closes = candles.map(c => parseFloat(c[4]));

    const lastPrice = closes[closes.length - 1];
    const prevPrice = closes[closes.length - 2];

    const change =
      (((lastPrice - prevPrice) / prevPrice) * 100).toFixed(2);

    let trend = "震荡";

    if (change > 1) trend = "强势上涨 🚀";
    if (change < -1) trend = "弱势下跌 📉";

    const aiRes = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `
分析 ${pair} 当前行情：

最新价格：${lastPrice}
涨跌幅：${change}%
趋势：${trend}

请给出：
1. 趋势分析
2. 做多还是做空
3. 风险提示
4. 简短建议
`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiText =
      aiRes.data.choices[0].message.content;

    return `
📊 ${pair} AI行情分析

💰 最新价格：${lastPrice}
📈 涨跌幅：${change}%
📌 趋势：${trend}

🤖 AI分析：

${aiText}
`;
  } catch (err) {
    console.log(err.response?.data || err.message);

    return "❌ AI分析失败";
  }
}

bot.on("message", async msg => {
  const chatId = msg.chat.id;

  const text = msg.text?.toLowerCase();

  if (!text) return;

  const loading = await bot.sendMessage(
    chatId,
    "🤖 AI分析中..."
  );

  const result = await analyzeCoin(text);

  bot.deleteMessage(chatId, loading.message_id);

  bot.sendMessage(chatId, result);
});