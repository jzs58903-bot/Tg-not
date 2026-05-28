const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  console.log("❌ 缺少 BOT_TOKEN");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
  polling: true
});

console.log("🤖 Telegram Bot Running");

app.get('/', (req, res) => {
  res.send('Bot Running');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Web Server Running on ${PORT}`);
});

// =========================
// 获取交易对数据
// =========================
async function getMarket(symbol) {

  try {

    const pair = symbol.toUpperCase().replace("USDT","") + "USDT";

    const res = await axios.get(
      `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`
    );

    const data = res.data;

    const price = parseFloat(data.lastPrice);
    const change = parseFloat(data.priceChangePercent);
    const high = parseFloat(data.highPrice);
    const low = parseFloat(data.lowPrice);
    const volume = parseFloat(data.quoteVolume);

    let trend = "震荡";

    if (change > 3) {
      trend = "强势上涨 🚀";
    } else if (change > 0) {
      trend = "上涨 📈";
    } else if (change < -3) {
      trend = "强势下跌 📉";
    } else if (change < 0) {
      trend = "下跌 ⬇️";
    }

    let advice = "观望";

    if (change > 2) {
      advice = "顺势做多";
    }

    if (change < -2) {
      advice = "谨慎做空";
    }

    return `
📊 ${pair} 行情分析

💰 当前价格：${price}

📈 24h涨跌：${change.toFixed(2)}%

📊 今日最高：${high}

📉 今日最低：${low}

💵 成交额：${Math.round(volume)}

📌 当前趋势：${trend}

🚀 交易建议：${advice}

⚠️ 注意风险控制
`;

  } catch (err) {

    console.log(err.message);

    return "❌ 币种不存在或获取失败";
  }
}

// =========================
// 消息监听
// =========================
bot.on('message', async (msg) => {

  const chatId = msg.chat.id;

  const text = msg.text;

  if (!text) return;

  if (text.startsWith('/')) return;

  await bot.sendMessage(chatId, "🔍 正在分析行情...");

  const result = await getMarket(text);

  await bot.sendMessage(chatId, result);
});