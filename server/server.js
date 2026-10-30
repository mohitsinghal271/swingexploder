// SwingExploder Railway Backend API Server
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { AlgoTradingEngine } from "./engine.js";

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

// Start autonomous engine immediately on server launch
engine.start();

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SwingExploder Railway Algo Engine",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Engine Status & Overview
app.get("/api/status", (req, res) => {
  res.json(engine.getAuditReport());
});

// Comprehensive Performance & Audit Reports
app.get("/api/reports", (req, res) => {
  res.json({
    success: true,
    report: engine.getAuditReport()
  });
});

// Deposit / Inject Paper Money to User Account
app.post("/api/paper-money/deposit", async (req, res) => {
  const { amount, userId } = req.body;
  const depositAmount = parseFloat(amount);

  if (isNaN(depositAmount) || depositAmount <= 0) {
    return res.status(400).json({ success: false, message: "Invalid deposit amount." });
  }

  // If Supabase client configured, update profiles balance
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
        message: `Deposited ₹${depositAmount.toLocaleString('en-IN')} to Supabase profile!`,
        newBalance
      });
    } catch (e) {
      console.error("Supabase deposit error:", e);
    }
  }

  res.json({
    success: true,
    message: `Deposited ₹${depositAmount.toLocaleString('en-IN')} paper capital (simulated)!`,
    amount: depositAmount
  });
});

// Toggle Autonomous Algo Execution Engine
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
  console.log(`🚀 SwingExploder Backend running on port ${PORT}`);
});
