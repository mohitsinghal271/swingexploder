// SwingExploder Backend API Server with Real NSE Feeds & Backtesting
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AlgoTradingEngine, getIndianMarketStatus, fetchRealQuote } from "./engine.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: "*" }));
app.use(express.json());

// Initialize autonomous trading engine
const engine = new AlgoTradingEngine({
  supabaseUrl: process.env.SUPABASE_URL || "https://vobzbxubffeovpnfywbq.supabase.co",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_D8-fu6u54R2YPPYUqGqHTw_cjdC3Pwp",
  targetUserId: process.env.TARGET_USER_ID || "max-trader-master"
});

// Start engine on launch
engine.start();

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SwingExploder Real-Market Algo Engine",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 1. Live Indian Market Status Endpoint (NSE/BSE)
app.get("/api/market-status", (req, res) => {
  res.json(getIndianMarketStatus());
});

// 2. Real-Time Quotes Endpoint for Major NSE Stocks & Indices
app.get("/api/quotes", async (req, res) => {
  const symbols = [
    { name: "NIFTY 50", ticker: "^NSEI" },
    { name: "BANKNIFTY", ticker: "^NSEBANK" },
    { name: "TATASTEEL", ticker: "TATASTEEL.NS" },
    { name: "RELIANCE", ticker: "RELIANCE.NS" },
    { name: "HDFCBANK", ticker: "HDFCBANK.NS" },
    { name: "DIXON", ticker: "DIXON.NS" }
  ];

  try {
    const quotes = await Promise.all(
      symbols.map(async (s) => {
        const q = await fetchRealQuote(s.ticker);
        return {
          name: s.name,
          ticker: s.ticker,
          price: q ? q.price : 0,
          previousClose: q ? q.previousClose : 0,
          change: q ? parseFloat((q.price - q.previousClose).toFixed(2)) : 0,
          changePercent: q && q.previousClose > 0
            ? parseFloat((((q.price - q.previousClose) / q.previousClose) * 100).toFixed(2))
            : 0
        };
      })
    );
    res.json({ success: true, quotes, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Genuine Historical Backtesting Endpoint on Real NSE OHLC Candles
app.get("/api/backtest", async (req, res) => {
  const symbol = req.query.symbol || "TATASTEEL.NS";
  const strategy = req.query.strategy || "momentum_master";
  const range = req.query.range || "1y";
  const targetPct = parseFloat(req.query.targetPct || "5.0");
  const stopLossPct = parseFloat(req.query.stopLossPct || "2.5");

  try {
    const results = await engine.runBacktest({
      symbol,
      strategy,
      range,
      targetPct,
      stopLossPct
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST version of backtest
app.post("/api/backtest", async (req, res) => {
  const { symbol = "TATASTEEL.NS", strategy = "momentum_master", range = "1y", targetPct = 5.0, stopLossPct = 2.5 } = req.body;
  try {
    const results = await engine.runBacktest({
      symbol,
      strategy,
      range,
      targetPct: parseFloat(targetPct),
      stopLossPct: parseFloat(stopLossPct)
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Engine Status & Real Market Overview
app.get("/api/status", (req, res) => {
  res.json(engine.getAuditReport());
});

app.get("/api/reports", (req, res) => {
  res.json({
    success: true,
    report: engine.getAuditReport()
  });
});

// 5. Deposit / Inject Paper Money to User Account
app.post("/api/paper-money/deposit", async (req, res) => {
  const { amount, userId } = req.body;
  const depositAmount = parseFloat(amount);

  if (isNaN(depositAmount) || depositAmount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid deposit amount." });
  }

  if (engine.supabase && userId) {
    try {
      const { data: profile } = await engine.supabase
        .from("profiles")
        .select("account_balance, initial_capital")
        .eq("id", userId)
        .single();

      const newBalance = (parseFloat(profile?.account_balance) || 1000000) + depositAmount;
      const newInitial = (parseFloat(profile?.initial_capital) || 1000000) + depositAmount;

      await engine.supabase
        .from("profiles")
        .update({
          account_balance: newBalance,
          initial_capital: newInitial,
          available_margin: newBalance
        })
        .eq("id", userId);

      return res.json({
        success: true,
        message: `Deposited ₹${depositAmount.toLocaleString("en-IN")} to Supabase profile!`,
        newBalance
      });
    } catch (e) {
      console.error("Supabase deposit error:", e);
    }
  }

  res.json({
    success: true,
    message: `Deposited ₹${depositAmount.toLocaleString("en-IN")} paper capital (simulated)!`,
    amount: depositAmount
  });
});

// 6. Toggle Engine
app.post("/api/engine/toggle", (req, res) => {
  if (engine.isRunning) {
    engine.stop();
  } else {
    engine.start();
  }
  res.json({
    success: true,
    isRunning: engine.isRunning,
    message: engine.isRunning ? "Autonomous Engine Started" : "Autonomous Engine Paused"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SwingExploder Real-Market Backend running on port ${PORT}`);
});
