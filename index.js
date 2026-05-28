const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const OpenAI = require("openai");
const http = require("http");

// =========================
// 环境变量
// =========================
const BOT_TOKEN = process.env.BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!BOT_TOKEN || !OPENAI_API_KEY) {
  console.log("❌ 缺少环境变量");
  process.exit(1);
}

// =========================
// Telegram Bot
// =========================
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
});

// =========================
// OpenAI
// =========================
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// =========================
// 获取币安数据
// =========================
async function getMarketData(symbol) {
  try {
    const pair = symbol.toUpperCase() + "USDT";

    // 24h数据
    const ticker = await axios.get(
      `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`
    );

    // K线数据
    const klines = await axios.get(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=1h&limit=100`
    );

    const closes = klines.data.map((k) => parseFloat(k[4]));

    return {
      symbol: pair,
      price: parseFloat(ticker.data.lastPrice),
      change: parseFloat(ticker.data.priceChangePercent),
      volume: parseFloat(ticker.data.quoteVolume),
      closes,
    };
  } catch (err) {
    console.log("Binance错误:", err.message);
    return null;
  }
}

// =========================
// RSI计算
// =========================
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];

    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  if (losses === 0) return 100;

  const rs = gains / losses;

  return 100 - 100 / (1 + rs);
}

// =========================
// AI分析
// =========================
async function aiAnalysis(symbol) {
  const data = await getMarketData(symbol);

  if (!data) {
    return "❌ 币种不存在或获取数据失败";
  }

  const rsi = calculateRSI(data.closes);

  const prompt = `
你是专业加密货币合约分析师。

分析以下数据：

币种：${data.symbol}

当前价格：${data.price}

24小时涨跌：${data.change}%

成交额：${Math.round(data.volume)}

RSI：${rsi.toFixed(2)}

请返回：

1. 市场趋势
2. 做多还是做空
3. 风险等级
4. 支撑位
5. 压力位
6. 短线建议

回答必须专业、简洁、像交易员。
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "你是顶级加密货币交易员，擅长短线合约、趋势分析、市场情绪。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.log("OpenAI错误:", err.message);
    return "❌ AI分析失败";
  }
}

// =========================
// /start
// =========================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`
🤖 AI合约分析机器人

直接发送币种即可：

BTC
ETH
SOL
DOGE
PEPE

功能：

✅ Binance合约行情
✅ AI趋势分析
✅ RSI指标
✅ 做多/做空建议
✅ 风险评级
✅ 支撑压力位
`
  );
});

// =========================
// 消息监听
// =========================
bot.on("message", async (msg) => {
  const text = msg.text;

  if (!text) return;

  // 跳过命令
  if (text.startsWith("/")) return;

  const chatId = msg.chat.id;

  // 清理输入
  const symbol = text
    .replace("分析", "")
    .replace("币", "")
    .replace(/\s/g, "")
    .toUpperCase();

  await bot.sendMessage(chatId, "🤖 AI分析中...");

  const result = await aiAnalysis(symbol);

  await bot.sendMessage(chatId, result);
});

// =========================
// 错误监听
// =========================
bot.on("polling_error", (err) => {
  console.log("polling_error:", err.message);
});

// =========================
// 启动
// =========================
console.log("🚀 AI交易机器人启动");

// =========================
// Render保活
// =========================
http
  .createServer((req, res) => {
    res.end("ok");
  })
  .listen(process.env.PORT || 3000);