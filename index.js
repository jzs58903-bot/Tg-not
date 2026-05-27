const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const OpenAI = require("openai");
const http = require("http");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =========================
// 获取 Binance 数据
// =========================
async function getMarketData(symbol) {
  try {
    const pair = symbol.toUpperCase() + "USDT";

    // 价格
    const ticker = await axios.get(
      `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${pair}`
    );

    // K线
    const klines = await axios.get(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=1h&limit=100`
    );

    const closes = klines.data.map((k) => parseFloat(k[4]));

    const price = parseFloat(ticker.data.lastPrice);
    const change = parseFloat(ticker.data.priceChangePercent);
    const volume = parseFloat(ticker.data.quoteVolume);

    return {
      symbol: pair,
      price,
      change,
      volume,
      closes,
    };
  } catch (e) {
    console.log(e.message);
    return null;
  }
}

// =========================
// RSI
// =========================
function calculateRSI(closes, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];

    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

// =========================
// AI 分析
// =========================
async function aiAnalysis(symbol) {
  const data = await getMarketData(symbol);

  if (!data) {
    return "❌ 获取币安数据失败";
  }

  const rsi = calculateRSI(data.closes);

  const prompt = `
你是专业加密货币合约交易员。

请分析下面数据：

币种：${data.symbol}

当前价格：${data.price}

24h涨跌：${data.change}%

24h成交额：${Math.round(data.volume)}

RSI：${rsi.toFixed(2)}

请返回：

1. 当前趋势
2. 是否适合做多或做空
3. 风险等级
4. 支撑位
5. 压力位
6. 短线建议

回复必须专业、简洁。
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "你是顶级加密货币合约分析师，擅长短线交易和市场情绪分析。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    return completion.choices[0].message.content;
  } catch (e) {
    console.log(e.message);
    return "❌ AI分析失败";
  }
}

// =========================
// start
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
PEPE
DOGE

功能：

✅ Binance合约数据
✅ AI趋势分析
✅ RSI分析
✅ 做多/做空建议
✅ 风险评级
✅ 支撑压力位
`
  );
});

// =========================
// 监听消息
// =========================
bot.on("message", async (msg) => {
  const text = msg.text;

  if (!text) return;

  if (text.startsWith("/")) return;

  const chatId = msg.chat.id;

  const symbol = text
    .replace("分析", "")
    .replace("币", "")
    .replace(" ", "")
    .toUpperCase();

  await bot.sendMessage(chatId, "🤖 AI分析中...");

  const result = await aiAnalysis(symbol);

  bot.sendMessage(chatId, result);
});

console.log("🚀 AI交易机器人启动");

// =========================
// Render 保活
// =========================
http
  .createServer((req, res) => {
    res.end("ok");
  })
  .listen(process.env.PORT || 3000);