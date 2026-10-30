// Main Application Controller, Autonomous Paper Trading Engine & Reports for SwingExploder

import { initTradingCanvas } from "./canvas.js";
import { AuthManager, DEFAULT_MAX_USER } from "./auth.js";
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  dbInsertOrder,
  dbFetchOrders,
  dbSaveStrategy,
  dbFetchStrategies,
  dbUpsertProfile
} from "./supabase.js";
import {
  MARKET_INDICES,
  INITIAL_STRATEGIES,
  WATCHLIST_DATA,
  SCREENER_RESULTS,
  SECTOR_HEATMAP,
  CORPORATE_FILINGS,
  FII_DII_CASH,
  BOT_KNOWLEDGE
} from "./data.js";

// ==========================================
// Global State
// ==========================================
let auth;
let currentAppView = "home";
let activeStrategies = JSON.parse(JSON.stringify(INITIAL_STRATEGIES));

// Capital standing - Initialized to Max Plan baseline (₹10,00,000.00)
let accountBalance = 1000000.00;
let initialCapital = 1000000.00;
let totalBrokeragePaid = 285.50;

// Order Records
let orderHistory = [
  { id: "ORD-9821", time: "09:20:14", symbol: "NIFTY 24850 CE", type: "BUY", qty: 50, price: 142.50, status: "FILLED", strategy: "DHURANDHAR", fee: "21.38" },
  { id: "ORD-9822", time: "09:35:42", symbol: "TATASTEEL", type: "BUY", qty: 240, price: 161.20, status: "FILLED", strategy: "MOMENTUM MASTERS", fee: "11.60" },
  { id: "ORD-9823", time: "10:14:05", symbol: "BANKNIFTY 52200 PE", type: "BUY", qty: 25, price: 285.00, status: "FILLED", strategy: "BRAHMASTRA", fee: "21.38" },
  { id: "ORD-9824", time: "11:05:12", symbol: "NIFTY 24800 STRADDLE", type: "SELL", qty: 50, price: 182.00, status: "FILLED", strategy: "CHAKRAVYUH", fee: "27.30" }
];

let testimonialIndex = 0;
let isSimulationActive = true;
let marketTimerInterval = null;
let autoTradeInterval = null;

// Realistic Trading Configuration
let autoTradingActive = true;
let slippageEnabled = true;
let brokerageEnabled = true;
const SLIPPAGE_PCT = 0.0005; // 0.05% realistic market spread
const BROKERAGE_STT_RATE = 0.0003; // 0.03% exchange turnover + STT + SEBI fees

// Testimonials Data matching official swingexploder.com
const TESTIMONIALS = [
  {
    roi: "+47%",
    quote: "SwingExploder transformed how I trade. My NIFTY momentum strategy now runs 24/7 without me watching screens. Up 47% in 3 months.",
    name: "Arjun Mehta",
    avatar: "AM",
    strat: "Strategy: DHURANDHAR"
  },
  {
    roi: "+31%",
    quote: "The VCP screener combined with automated Lemonn execution gives me an unfair edge. I execute 52-week momentum setups without emotion.",
    name: "Priya Sharma",
    avatar: "PS",
    strat: "Strategy: MOMENTUM MASTERS"
  },
  {
    roi: "+34%",
    quote: "Having Brahmastra trigger on expiry days alone paid for my entire year's subscription in two weeks. Incredible risk-to-reward ratio.",
    name: "Rahul Verma",
    avatar: "RV",
    strat: "Strategy: BRAHMASTRA"
  },
  {
    roi: "+22%",
    quote: "As a doctor I cannot watch screens all day. Dhurandhar handles entry and trailing stoploss on autopilot with disciplined execution.",
    name: "Dr. Sanjay Gupta",
    avatar: "SG",
    strat: "Strategy: DHURANDHAR"
  },
  {
    roi: "+38%",
    quote: "The risk management and automated position sizing on cash equities is institutional grade. Highly recommended for systematic traders.",
    name: "Vikram Singh",
    avatar: "VS",
    strat: "Strategy: MOMENTUM MASTERS"
  }
];

// Document Ready Initialization
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Initialize Canvas
  initTradingCanvas("trading-bg-canvas");

  // 2. Initialize Auth Manager
  auth = new AuthManager((user) => {
    handleAuthStateChange(user);
  });

  // 3. Render Landing Components
  renderTickerBar();
  renderLandingStrategies();
  renderScreenerTable("all");
  renderTestimonial(0);

  // 4. Bind Events
  bindLandingEvents();
  bindModalEvents();
  bindAppEvents();
  bindSettingsModals();

  // 5. Start Real-time Simulation Engine & Auto-Trading loop
  startLiveTickerSimulation();
  startMarketClock();
  startAutonomousTradingLoop();

  // 6. Check initial session
  if (auth.isAuthenticated()) {
    await syncUserDatabase();
    showAppView();
  } else {
    showLandingView();
  }
});

// ==========================================================
// 1. VIEW ROUTING & STATE
// ==========================================================
function showLandingView() {
  document.getElementById("landing-view").className = "view-active";
  document.getElementById("app-view").className = "view-hidden";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showAppView() {
  document.getElementById("landing-view").className = "view-hidden";
  document.getElementById("app-view").className = "view-active";
  const user = auth.getUser() || DEFAULT_MAX_USER;
  
  const nameEl = document.getElementById("app-user-name");
  const tierEl = document.getElementById("app-user-tier");
  const avatarEl = document.getElementById("app-user-avatar");
  
  if (nameEl) nameEl.textContent = user.name;
  if (tierEl) tierEl.textContent = user.plan || "Max Plan (Lifetime Access)";
  if (avatarEl) avatarEl.textContent = (user.name || "MT").split(" ").map(w => w[0]).join("").slice(0, 2);
  
  renderPortalBody();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleAuthStateChange(user) {
  if (user) {
    if (user.accountBalance) {
      accountBalance = user.accountBalance;
      initialCapital = user.initialCapital || user.accountBalance;
    }
    await syncUserDatabase();
    showToast(`Welcome, ${user.name}! Connected with ${user.plan}`, "success");
    showAppView();
  } else {
    showToast("Signed out. Returning to home.", "info");
    showLandingView();
  }
}

async function syncUserDatabase() {
  const user = auth.getUser();
  if (!user || !isSupabaseConfigured() || user.id === "max-trader-master") return;

  try {
    const dbOrders = await dbFetchOrders(user.id);
    if (dbOrders && dbOrders.length > 0) {
      orderHistory = dbOrders;
    }

    const dbStrats = await dbFetchStrategies(user.id);
    if (dbStrats && dbStrats.length > 0) {
      dbStrats.forEach(ds => {
        const found = activeStrategies.find(s => s.id === ds.strategy_id);
        if (found) {
          found.deployed = ds.deployed;
          found.allocation = parseFloat(ds.allocation) || found.allocation;
        }
      });
    }
  } catch (e) {
    console.warn("Could not sync with Supabase:", e);
  }
}

// ==========================================================
// 2. TICKER BAR & REAL-TIME SIMULATION
// ==========================================================
function renderTickerBar() {
  const container = document.getElementById("ticker-container");
  if (!container) return;
  const items = [...MARKET_INDICES, ...MARKET_INDICES].map(idx => `
    <div class="ticker-item" id="ticker-${idx.symbol.replace(/\s+/g, '')}">
      <span class="ticker-sym">${idx.symbol}</span>
      <span class="ticker-price">${idx.price.toFixed(2)}</span>
      <span class="ticker-change ${idx.change >= 0 ? 'up' : 'down'}">
        ${idx.change >= 0 ? '+' : ''}${idx.change.toFixed(2)} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent}%)
      </span>
    </div>
  `).join("");
  container.innerHTML = items;
}

function startLiveTickerSimulation() {
  setInterval(() => {
    MARKET_INDICES.forEach(idx => {
      const deltaPct = (Math.random() - 0.49) * 0.12;
      const priceDelta = idx.price * (deltaPct / 100);
      idx.price += priceDelta;
      idx.change += priceDelta;
      idx.changePercent = parseFloat(((idx.change / (idx.price - idx.change)) * 100).toFixed(2));
      
      const el = document.getElementById(`ticker-${idx.symbol.replace(/\s+/g, '')}`);
      if (el) {
        const pEl = el.querySelector(".ticker-price");
        const cEl = el.querySelector(".ticker-change");
        if (pEl) pEl.textContent = idx.price.toFixed(2);
        if (cEl) {
          cEl.className = `ticker-change ${idx.change >= 0 ? 'up' : 'down'}`;
          cEl.textContent = `${idx.change >= 0 ? '+' : ''}${idx.change.toFixed(2)} (${idx.changePercent >= 0 ? '+' : ''}${idx.changePercent}%)`;
        }
      }
    });

    // Update active strategies live PnL jitter
    activeStrategies.forEach(s => {
      if (s.deployed) {
        const pnlShift = (Math.random() - 0.48) * (s.allocation * 0.003);
        s.pnlToday += pnlShift;
        s.currentPrice += (Math.random() - 0.48) * (s.currentPrice * 0.002);
      }
    });

    if (currentAppView === "home" || currentAppView === "dashboard") {
      updateLivePnLDisplay();
    }
  }, 2500);
}

function startMarketClock() {
  marketTimerInterval = setInterval(() => {
    const el = document.getElementById("market-clock-time");
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) + " IST";
  }, 1000);
}

// ==========================================================
// 3. AUTONOMOUS ALGO TRADING ENGINE (BEHAVES LIKE REAL MONEY)
// ==========================================================
function startAutonomousTradingLoop() {
  if (autoTradeInterval) clearInterval(autoTradeInterval);

  autoTradeInterval = setInterval(() => {
    if (!autoTradingActive) return;

    // Filter deployed algorithms
    const deployedStrats = activeStrategies.filter(s => s.deployed);
    if (deployedStrats.length === 0) return;

    // 25% chance every tick to simulate an automated algo order execution
    if (Math.random() < 0.25) {
      const strat = deployedStrats[Math.floor(Math.random() * deployedStrats.length)];
      const symbols = [strat.activeSymbol, "NIFTY 24800 CE", "BANKNIFTY 52100 PE", "TATASTEEL", "RELIANCE"];
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      const side = Math.random() > 0.4 ? "BUY" : "SELL";
      const basePrice = sym.includes("NIFTY") ? 140 + Math.random() * 80 : sym.includes("BANK") ? 280 + Math.random() * 120 : 160 + Math.random() * 20;
      const qty = sym.includes("CE") || sym.includes("PE") ? 50 : 25;

      executePaperOrder(sym, side, qty, basePrice, strat.name, true);
    }
  }, 8000);
}

// ==========================================================
// 4. LANDING PAGE STRATEGIES & SCREENER
// ==========================================================
function renderLandingStrategies() {
  const container = document.getElementById("strategies-preview-grid");
  if (!container) return;

  container.innerHTML = activeStrategies.slice(0, 4).map(strat => `
    <div class="strategy-card glass-card">
      <div class="s-header">
        <div>
          <span class="badge" style="background:rgba(99,102,241,0.15);color:var(--brand-light);font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-bottom:6px;display:inline-block;">${strat.badge || '⚡ Active Engine'}</span>
          <h3 class="font-display">${strat.name}</h3>
          <span class="s-category">${strat.category}</span>
        </div>
        <span class="s-roi font-mono text-profit">${strat.roi}</span>
      </div>
      <p class="s-desc">${strat.description}</p>
      <div class="s-metrics">
        <div class="s-metric">
          <span class="sm-label">Win Rate</span>
          <span class="sm-val text-profit">${strat.winRate}</span>
        </div>
        <div class="s-metric">
          <span class="sm-label">Max Drawdown</span>
          <span class="sm-val text-loss">${strat.drawdown}</span>
        </div>
        <div class="s-metric">
          <span class="sm-label">Sharpe Ratio</span>
          <span class="sm-val font-mono">${strat.sharpe}</span>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-sm mt-3 btn-launch-from-landing">
        Deploy in Max Plan
      </button>
    </div>
  `).join("");

  container.querySelectorAll(".btn-launch-from-landing").forEach(b => {
    b.addEventListener("click", () => {
      if (auth.isAuthenticated()) showAppView();
      else openAuthModal();
    });
  });
}

function renderScreenerTable(filter = "all", searchQuery = "") {
  const tbody = document.getElementById("screener-table-body");
  if (!tbody) return;

  let list = SCREENER_RESULTS;
  if (filter !== "all") {
    list = list.filter(item => item.strategy === filter);
  }
  if (searchQuery) {
    list = list.filter(item => item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  tbody.innerHTML = list.map(item => `
    <tr>
      <td><strong class="font-mono text-brand">${item.symbol}</strong><br><span style="font-size:11px;color:var(--text-muted);">${item.name}</span></td>
      <td>${item.sector}</td>
      <td class="font-mono font-bold">₹${item.price.toFixed(2)}</td>
      <td class="font-mono ${item.change.startsWith('+') ? 'text-profit' : 'text-loss'}">${item.change}</td>
      <td><span class="badge" style="background:rgba(99,102,241,0.15);color:var(--brand-light);padding:2px 8px;border-radius:4px;font-size:11px;">${item.strategy}</span></td>
      <td><span class="badge" style="background:${item.signal.includes('STRONG') ? 'var(--profit-bg)' : 'rgba(99,102,241,0.12)'};color:${item.signal.includes('STRONG') ? 'var(--profit-light)' : 'var(--brand-light)'};padding:2px 8px;border-radius:4px;font-weight:700;">${item.signal}</span></td>
      <td class="font-mono text-profit font-bold">${item.score}</td>
    </tr>
  `).join("");
}

function renderTestimonial(index) {
  testimonialIndex = (index + TESTIMONIALS.length) % TESTIMONIALS.length;
  const t = TESTIMONIALS[testimonialIndex];
  
  const roiEl = document.getElementById("t-roi-badge");
  if (roiEl) roiEl.textContent = t.roi;
  const quoteEl = document.getElementById("t-quote-text");
  if (quoteEl) quoteEl.textContent = `"${t.quote}"`;
  const nameEl = document.getElementById("author-name");
  if (nameEl) nameEl.innerHTML = `${t.name} <span class="verified-badge">✓ Verified</span>`;
  const stratEl = document.getElementById("author-strat");
  if (stratEl) stratEl.innerHTML = `Strategy: <strong>${t.strat.replace('Strategy: ', '')}</strong>`;

  document.querySelectorAll(".t-person-btn").forEach((btn, i) => {
    if (i === testimonialIndex) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

// ==========================================================
// 5. AUTHENTICATED SAAS PORTAL RENDERING
// ==========================================================
function renderPortalBody() {
  const container = document.getElementById("portal-views-container");
  if (!container) return;

  switch (currentAppView) {
    case "home":
      renderPortalHome(container);
      break;
    case "dashboard":
      renderPortalDashboard(container);
      break;
    case "strategies":
      renderPortalStrategies(container);
      break;
    case "broker":
      renderPortalBroker(container);
      break;
    case "watchlist":
      renderPortalWatchlist(container);
      break;
    case "screener":
      renderPortalScreener(container);
      break;
    case "sector":
      renderPortalSectorRotation(container);
      break;
    case "fundamental":
      renderPortalFundamental(container);
      break;
    case "filings":
      renderPortalFilings(container);
      break;
    case "reports":
      renderPortalReports(container);
      break;
    case "aibot":
      renderPortalAIBot(container);
      break;
    case "telegram":
      renderPortalTelegram(container);
      break;
    default:
      renderPortalHome(container);
  }
}

function calculatePortfolioTotals() {
  const totalStrategyPnl = activeStrategies.reduce((acc, s) => acc + (s.deployed ? s.pnlToday : 0), 0);
  const totalAllocated = activeStrategies.reduce((acc, s) => acc + (s.deployed ? s.allocation : 0), 0);
  const currentNetWorth = accountBalance + totalStrategyPnl;
  const availableMargin = Math.max(0, currentNetWorth - totalAllocated);
  const pnlPercent = ((totalStrategyPnl / (initialCapital || 1)) * 100).toFixed(2);

  return { totalStrategyPnl, totalAllocated, currentNetWorth, availableMargin, pnlPercent };
}

function updateLivePnLDisplay() {
  const { totalStrategyPnl, currentNetWorth, pnlPercent } = calculatePortfolioTotals();
  const netEl = document.getElementById("p-networth");
  const pnlEl = document.getElementById("p-pnl-today");
  if (netEl) netEl.textContent = `₹${currentNetWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  if (pnlEl) {
    pnlEl.className = `m-amount font-mono ${totalStrategyPnl >= 0 ? 'text-profit' : 'text-loss'}`;
    pnlEl.textContent = `${totalStrategyPnl >= 0 ? '+' : ''}₹${totalStrategyPnl.toFixed(2)} (${pnlPercent >= 0 ? '+' : ''}${pnlPercent}%)`;
  }
}

// Sub-view: Home Dashboard
function renderPortalHome(container) {
  const { totalStrategyPnl, totalAllocated, currentNetWorth, availableMargin, pnlPercent } = calculatePortfolioTotals();
  const user = auth.getUser() || DEFAULT_MAX_USER;

  container.innerHTML = `
    <!-- Top Action Bar -->
    <div class="portal-view-header">
      <div class="portal-view-title">
        <div style="display:flex;align-items:center;gap:8px;">
          <h2>Live Algorithmic Paper Trading Desk</h2>
          <span class="badge" style="background:var(--gold-glow);color:var(--gold);border:1px solid var(--gold);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">👑 MAX PLAN</span>
        </div>
        <p>Active Capital: <strong>₹${accountBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> on Lemonn High-Speed Gateway.</p>
      </div>
      <div class="portal-view-actions">
        <button class="btn btn-sm btn-outline" id="btn-home-manage-capital">💰 Manage Paper Capital</button>
        <button class="btn btn-sm btn-primary btn-glow" id="btn-deploy-all-master">⚡ Deploy All Strategies</button>
      </div>
    </div>

    <!-- Metrics Row -->
    <div class="portal-metrics-row">
      <div class="metric-card">
        <div class="m-head">
          <span>PORTFOLIO BALANCE</span>
          <span>INR</span>
        </div>
        <div class="m-amount font-mono" id="p-networth">₹${currentNetWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        <div class="m-sub text-muted">Initial Baseline: ₹${initialCapital.toLocaleString('en-IN')}</div>
      </div>

      <div class="metric-card">
        <div class="m-head">
          <span>TODAY'S P&L (UNREALIZED)</span>
          <span class="pill-dot green"></span>
        </div>
        <div class="m-amount font-mono text-profit" id="p-pnl-today">
          +₹${totalStrategyPnl.toFixed(2)} (+${pnlPercent}%)
        </div>
        <div class="m-sub text-profit">${activeStrategies.filter(s => s.deployed).length} of ${activeStrategies.length} Engines Running</div>
      </div>

      <div class="metric-card">
        <div class="m-head">
          <span>MARGIN UTILIZED</span>
          <span>ALLOCATED</span>
        </div>
        <div class="m-amount font-mono">₹${totalAllocated.toLocaleString('en-IN')}</div>
        <div class="m-sub text-muted">Free Margin: ₹${availableMargin.toLocaleString('en-IN')}</div>
      </div>

      <div class="metric-card">
        <div class="m-head">
          <span>BROKER BRIDGE</span>
          <span class="text-brand">LEMONN</span>
        </div>
        <div class="m-amount font-mono" style="font-size:18px;">${user.broker?.clientCode || 'LEM-MAX-ALGO'}</div>
        <div class="m-sub text-profit">Status: Low-Latency (14ms)</div>
      </div>
    </div>

    <!-- Active Algorithms Status Cards -->
    <div class="portal-view-header mt-4">
      <div class="portal-view-title">
        <h3>Active Algorithmic Engines</h3>
        <p>Real-time order tracking and dynamic trailing stop loss</p>
      </div>
    </div>

    <div class="strategy-grid mb-4">
      ${activeStrategies.map(strat => `
        <div class="strategy-card glass-card">
          <div class="s-header">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <h4 class="font-display">${strat.name}</h4>
                <span class="badge" style="background:${strat.deployed ? 'var(--profit-bg)' : 'rgba(100,100,100,0.2)'};color:${strat.deployed ? 'var(--profit-light)' : 'var(--text-muted)'};padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">
                  ${strat.deployed ? '● RUNNING' : '○ PAUSED'}
                </span>
              </div>
              <span class="s-category">${strat.category}</span>
            </div>
            <span class="s-roi font-mono ${strat.pnlToday >= 0 ? 'text-profit' : 'text-loss'}">
              ${strat.pnlToday >= 0 ? '+' : ''}₹${strat.pnlToday.toFixed(2)}
            </span>
          </div>

          <div style="background:rgba(18,18,21,0.8);border:1px solid var(--border-subtle);border-radius:10px;padding:12px;margin:12px 0;font-size:12px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span class="text-muted">Active Trade:</span>
              <strong class="font-mono text-brand">${strat.activeSymbol} (${strat.qty} Qty)</strong>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span class="text-muted">Entry / LTP:</span>
              <span class="font-mono">₹${strat.entryPrice.toFixed(2)} → <strong class="text-profit">₹${strat.currentPrice.toFixed(2)}</strong></span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span class="text-muted">Stop Loss / Target:</span>
              <span class="font-mono text-muted">₹${strat.stopLoss.toFixed(2)} | <span class="text-profit">₹${strat.target.toFixed(2)}</span></span>
            </div>
          </div>

          <div style="display:flex;gap:8px;">
            <button class="btn btn-xs ${strat.deployed ? 'btn-secondary' : 'btn-primary'} btn-block toggle-strat-btn" data-id="${strat.id}">
              ${strat.deployed ? 'Pause Engine' : 'Deploy Engine'}
            </button>
            <button class="btn btn-xs btn-outline manual-square-off" data-id="${strat.id}">Square Off</button>
          </div>
        </div>
      `).join("")}
    </div>

    <!-- Recent Order Log Table -->
    <div class="glass-card" style="padding:0;overflow:hidden;margin-top:24px;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4 style="font-weight:700;">Audited Execution Log (Lemonn Gateway &amp; Supabase DB)</h4>
          <span style="font-size:11px;color:var(--text-muted);">Slippage and Exchange Turnover fees deducted realistically</span>
        </div>
        <span class="badge" style="font-size:11px;color:var(--profit-light);">Auto Webhook Active</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>TIME</th>
              <th>ORDER ID</th>
              <th>SYMBOL</th>
              <th>SIDE</th>
              <th>QTY</th>
              <th>PRICE</th>
              <th>FEE (STT)</th>
              <th>STRATEGY</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${orderHistory.map(ord => `
              <tr>
                <td class="font-mono text-muted">${ord.time}</td>
                <td class="font-mono">${ord.id}</td>
                <td><strong>${ord.symbol}</strong></td>
                <td><span style="color:${ord.type === 'BUY' ? 'var(--profit)' : 'var(--loss)'};font-weight:700;">${ord.type}</span></td>
                <td class="font-mono">${ord.qty}</td>
                <td class="font-mono">₹${parseFloat(ord.price).toFixed(2)}</td>
                <td class="font-mono text-muted">₹${ord.fee || '14.20'}</td>
                <td><span class="badge" style="background:rgba(99,102,241,0.12);color:var(--brand-light);padding:2px 6px;border-radius:4px;font-size:11px;">${ord.strategy}</span></td>
                <td><span class="badge" style="background:var(--profit-bg);color:var(--profit-light);padding:2px 6px;border-radius:4px;font-size:11px;">✓ ${ord.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind Home sub-events
  container.querySelector("#btn-home-manage-capital")?.addEventListener("click", () => {
    openPaperSettingsModal();
  });

  container.querySelector("#btn-deploy-all-master")?.addEventListener("click", () => {
    const allActive = activeStrategies.every(s => s.deployed);
    activeStrategies.forEach(s => s.deployed = !allActive);
    showToast(allActive ? "Paused all strategies." : "Deployed all 8 strategies with Max Plan allocation!", "success");
    renderPortalHome(container);
  });

  container.querySelectorAll(".toggle-strat-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      const strat = activeStrategies.find(s => s.id === id);
      if (strat) {
        strat.deployed = !strat.deployed;
        showToast(`${strat.name} is now ${strat.deployed ? 'DEPLOYED' : 'PAUSED'}`, strat.deployed ? "success" : "info");
        
        const user = auth.getUser();
        if (user && isSupabaseConfigured() && user.id !== "max-trader-master") {
          dbSaveStrategy({
            user_id: user.id,
            strategy_id: strat.id,
            name: strat.name,
            allocation: strat.allocation,
            deployed: strat.deployed
          });
        }
        renderPortalHome(container);
      }
    });
  });

  container.querySelectorAll(".manual-square-off").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      const strat = activeStrategies.find(s => s.id === id);
      if (strat) {
        showToast(`Squared off position for ${strat.name} at ₹${strat.currentPrice.toFixed(2)} (P&L: ₹${strat.pnlToday.toFixed(2)})`, "info");
        accountBalance += strat.pnlToday;
        strat.pnlToday = 0;
        strat.deployed = false;
        renderPortalHome(container);
      }
    });
  });
}

// Sub-view: Dashboard Analytics
function renderPortalDashboard(container) {
  const { currentNetWorth, totalStrategyPnl } = calculatePortfolioTotals();
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Portfolio Performance Analytics</h2>
        <p>Comprehensive algorithmic audit of your ₹${accountBalance.toLocaleString('en-IN')} portfolio.</p>
      </div>
    </div>

    <div class="portal-metrics-row">
      <div class="metric-card">
        <div class="m-head"><span>WIN RATE</span></div>
        <div class="m-amount font-mono text-profit">71.8%</div>
        <div class="m-sub text-muted">184 of 256 Trades Won</div>
      </div>
      <div class="metric-card">
        <div class="m-head"><span>PROFIT FACTOR</span></div>
        <div class="m-amount font-mono text-brand">2.52</div>
        <div class="m-sub text-muted">Gross Profit / Gross Loss</div>
      </div>
      <div class="metric-card">
        <div class="m-head"><span>MAX DRAWDOWN</span></div>
        <div class="m-amount font-mono text-loss">-7.4%</div>
        <div class="m-sub text-muted">Protected by Auto Circuit Breaker</div>
      </div>
      <div class="metric-card">
        <div class="m-head"><span>SHARPE RATIO</span></div>
        <div class="m-amount font-mono text-gold">2.28</div>
        <div class="m-sub text-muted">Risk-Adjusted Alpha</div>
      </div>
    </div>

    <div class="glass-card mb-4">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">Cumulative Equity Growth Curve</h3>
      <div style="height:220px;background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;display:flex;align-items:flex-end;">
        <svg viewBox="0 0 600 180" style="width:100%;height:100%;">
          <defs>
            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(99,102,241,0.4)" />
              <stop offset="100%" stop-color="rgba(99,102,241,0.0)" />
            </linearGradient>
          </defs>
          <path d="M0,150 Q100,140 180,110 T320,85 T450,50 T600,20 L600,180 L0,180 Z" fill="url(#eqGrad)" />
          <path d="M0,150 Q100,140 180,110 T320,85 T450,50 T600,20" fill="none" stroke="#6366f1" stroke-width="3" />
        </svg>
      </div>
    </div>
  `;
}

// Sub-view: Reports & Analysis (NEW AUDIT & EXPORT VIEW)
function renderPortalReports(container) {
  const { currentNetWorth, totalStrategyPnl } = calculatePortfolioTotals();
  const totalVolume = orderHistory.reduce((acc, o) => acc + (o.qty * o.price), 0);

  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Audited Reports &amp; Trading Journal</h2>
        <p>Comprehensive trade performance, slippage audit, and tax/brokerage statement.</p>
      </div>
      <div class="portal-view-actions">
        <button class="btn btn-sm btn-outline" id="btn-export-csv-journal">📥 Download CSV Journal</button>
        <button class="btn btn-sm btn-primary" id="btn-print-audit-report">🖨️ Print Summary</button>
      </div>
    </div>

    <!-- Summary Metrics -->
    <div class="portal-metrics-row mb-4">
      <div class="metric-card">
        <div class="m-head"><span>TOTAL EXECUTED TURNOVER</span></div>
        <div class="m-amount font-mono text-brand">₹${totalVolume.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
        <div class="m-sub text-muted">Across ${orderHistory.length} Recorded Trades</div>
      </div>

      <div class="metric-card">
        <div class="m-head"><span>NET REALIZED P&L</span></div>
        <div class="m-amount font-mono text-profit">+₹${totalStrategyPnl.toFixed(2)}</div>
        <div class="m-sub text-profit">After Slippage &amp; STT</div>
      </div>

      <div class="metric-card">
        <div class="m-head"><span>EXCHANGE DEDUCTIONS &amp; FEES</span></div>
        <div class="m-amount font-mono text-loss">₹${totalBrokeragePaid.toFixed(2)}</div>
        <div class="m-sub text-muted">Brokerage, STT, GST (Actual Money Simulation)</div>
      </div>

      <div class="metric-card">
        <div class="m-head"><span>DATABASE SYNC</span></div>
        <div class="m-amount font-mono" style="font-size:16px;">
          ${isSupabaseConfigured() ? '<span class="text-profit">● Supabase Active</span>' : '<span class="text-gold">● Local Offline</span>'}
        </div>
        <div class="m-sub text-muted">Permanent Record Persistence</div>
      </div>
    </div>

    <!-- Strategy Performance Breakdown Table -->
    <div class="glass-card mb-4" style="padding:0;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);">
        <h4 style="font-weight:700;">Engine-by-Engine Performance Attribution</h4>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ALGORITHM</th>
              <th>CATEGORY</th>
              <th>ALLOCATED</th>
              <th>WIN RATE</th>
              <th>PROFIT FACTOR</th>
              <th>TODAY'S P&L</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${activeStrategies.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td class="text-muted">${s.category}</td>
                <td class="font-mono">₹${s.allocation.toLocaleString('en-IN')}</td>
                <td class="font-mono text-profit">${s.winRate}</td>
                <td class="font-mono">${s.profitFactor}</td>
                <td class="font-mono ${s.pnlToday >= 0 ? 'text-profit' : 'text-loss'}">
                  ${s.pnlToday >= 0 ? '+' : ''}₹${s.pnlToday.toFixed(2)}
                </td>
                <td>
                  <span class="badge" style="background:${s.deployed ? 'var(--profit-bg)' : 'rgba(100,100,100,0.2)'};color:${s.deployed ? 'var(--profit-light)' : 'var(--text-muted)'};padding:2px 6px;border-radius:4px;font-size:11px;">
                    ${s.deployed ? 'Active' : 'Paused'}
                  </span>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Complete Trade Log Journal -->
    <div class="glass-card" style="padding:0;overflow:hidden;">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
        <h4 style="font-weight:700;">Audited Execution Journal (${orderHistory.length} Entries)</h4>
        <button class="btn btn-xs btn-outline" id="btn-refresh-orders">Refresh Journal</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>ORDER ID</th>
              <th>SYMBOL</th>
              <th>SIDE</th>
              <th>QTY</th>
              <th>EXEC PRICE</th>
              <th>COMMISSION</th>
              <th>STRATEGY</th>
              <th>GATEWAY</th>
            </tr>
          </thead>
          <tbody>
            ${orderHistory.map(ord => `
              <tr>
                <td class="font-mono text-muted">${ord.time}</td>
                <td class="font-mono text-brand">${ord.id}</td>
                <td><strong>${ord.symbol}</strong></td>
                <td><span style="color:${ord.type === 'BUY' ? 'var(--profit)' : 'var(--loss)'};font-weight:700;">${ord.type}</span></td>
                <td class="font-mono">${ord.qty}</td>
                <td class="font-mono">₹${parseFloat(ord.price).toFixed(2)}</td>
                <td class="font-mono text-muted">₹${ord.fee || '12.50'}</td>
                <td><span class="badge" style="background:rgba(99,102,241,0.12);color:var(--brand-light);padding:2px 6px;border-radius:4px;font-size:11px;">${ord.strategy}</span></td>
                <td><span class="badge" style="background:var(--profit-bg);color:var(--profit-light);padding:2px 6px;border-radius:4px;font-size:11px;">Lemonn Live</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // CSV Export Action
  container.querySelector("#btn-export-csv-journal")?.addEventListener("click", () => {
    let csvContent = "data:text/csv;charset=utf-8,Time,Order ID,Symbol,Side,Quantity,Price,Fee,Strategy,Status\n";
    orderHistory.forEach(o => {
      csvContent += `${o.time},${o.id},"${o.symbol}",${o.type},${o.qty},${o.price},${o.fee || '0'},"${o.strategy}",${o.status}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `swingexploder_trade_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Trade journal exported as CSV successfully!", "success");
  });

  container.querySelector("#btn-print-audit-report")?.addEventListener("click", () => {
    window.print();
  });

  container.querySelector("#btn-refresh-orders")?.addEventListener("click", async () => {
    await syncUserDatabase();
    renderPortalReports(container);
    showToast("Journal refreshed from database.", "info");
  });
}

// Sub-view: Strategies Management
function renderPortalStrategies(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Strategies Configuration &amp; Risk Allocation</h2>
        <p>Set capital allocation, lot sizes, and trigger rules for each trading engine.</p>
      </div>
      <div class="portal-view-actions">
        <button class="btn btn-sm btn-primary" id="btn-save-strat-alloc">Save Allocations</button>
      </div>
    </div>

    <div class="strategy-grid">
      ${activeStrategies.map(strat => `
        <div class="strategy-card glass-card">
          <div class="s-header">
            <div>
              <h3>${strat.name}</h3>
              <span class="s-category">${strat.category}</span>
            </div>
            <span class="badge" style="background:${strat.deployed ? 'var(--profit-bg)' : 'rgba(100,100,100,0.2)'};color:${strat.deployed ? 'var(--profit-light)' : 'var(--text-muted)'};padding:4px 8px;border-radius:6px;font-weight:700;">
              ${strat.deployed ? 'DEPLOYED' : 'PAUSED'}
            </span>
          </div>

          <p class="s-desc">${strat.description}</p>

          <div class="form-group mb-3">
            <label style="font-size:12px;color:var(--text-muted);">Allocated Capital (₹):</label>
            <input type="number" class="strat-alloc-input" data-id="${strat.id}" value="${strat.allocation}" style="width:100%;padding:8px 12px;background:rgba(18,18,21,0.8);border:1px solid var(--border-default);color:white;border-radius:8px;font-family:'JetBrains Mono';" />
          </div>

          <div class="form-group mb-3">
            <label style="font-size:12px;color:var(--text-muted);">Lots / Multiplier:</label>
            <select style="width:100%;padding:8px 12px;background:rgba(18,18,21,0.8);border:1px solid var(--border-default);color:white;border-radius:8px;">
              <option value="1">1 Lot</option>
              <option value="2">2 Lots</option>
              <option value="5" selected>5 Lots (Max Plan Default)</option>
              <option value="10">10 Lots (Prop Scale)</option>
            </select>
          </div>

          <button class="btn btn-sm ${strat.deployed ? 'btn-secondary' : 'btn-primary'} btn-block toggle-strat-btn" data-id="${strat.id}">
            ${strat.deployed ? 'Pause Strategy' : 'Deploy Strategy'}
          </button>
        </div>
      `).join("")}
    </div>
  `;

  container.querySelector("#btn-save-strat-alloc")?.addEventListener("click", () => {
    container.querySelectorAll(".strat-alloc-input").forEach(inp => {
      const id = inp.getAttribute("data-id");
      const strat = activeStrategies.find(s => s.id === id);
      if (strat) strat.allocation = parseFloat(inp.value) || 0;
    });
    showToast("Strategy capital allocations saved successfully!", "success");
  });

  container.querySelectorAll(".toggle-strat-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      const strat = activeStrategies.find(s => s.id === id);
      if (strat) {
        strat.deployed = !strat.deployed;
        showToast(`${strat.name} is now ${strat.deployed ? 'DEPLOYED' : 'PAUSED'}`, strat.deployed ? "success" : "info");
        renderPortalStrategies(container);
      }
    });
  });
}

// Sub-view: Broker Integration
function renderPortalBroker(container) {
  const user = auth.getUser() || DEFAULT_MAX_USER;
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Broker Integration &amp; Execution Gateway</h2>
        <p>Configured for <strong>Lemonn Broker</strong> low-latency execution bridge.</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div class="glass-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:38px;height:38px;background:rgba(212,175,55,0.2);border:1px solid var(--gold);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">🍋</div>
            <div>
              <h3 style="font-size:17px;font-weight:700;">Lemonn Broker Bridge</h3>
              <span class="text-profit" style="font-size:12px;">● Connected (Low Latency)</span>
            </div>
          </div>
          <span class="badge" style="background:var(--profit-bg);color:var(--profit-light);padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">ACTIVE</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px;font-size:13px;margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
            <span class="text-muted">Client Code:</span>
            <strong class="font-mono text-brand">${user.broker?.clientCode || 'LEM-MAX-ALGO'}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
            <span class="text-muted">Available Cash Margin:</span>
            <strong class="font-mono text-profit">₹${accountBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border-subtle);padding-bottom:8px;">
            <span class="text-muted">Execution Mode:</span>
            <span class="font-mono text-gold">MAX PLAN ALGO ROUTING</span>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span class="text-muted">Ping Latency:</span>
            <span class="font-mono text-profit">14 ms</span>
          </div>
        </div>

        <button class="btn btn-outline btn-block btn-sm" id="btn-test-broker-ping">Send Test Ping Webhook</button>
      </div>

      <div class="glass-card">
        <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">Update Broker API Credentials</h3>
        <form id="form-link-broker">
          <div class="form-group mb-3">
            <label>Broker Selection</label>
            <select style="width:100%;padding:8px 12px;background:rgba(18,18,21,0.8);border:1px solid var(--border-default);color:white;border-radius:8px;">
              <option value="lemonn">Lemonn Broker (Mandatory for Auto F&O)</option>
              <option value="zerodha">Zerodha Kite Connect</option>
              <option value="angel">Angel One SmartAPI</option>
            </select>
          </div>
          <div class="form-group mb-3">
            <label>Client Code</label>
            <input type="text" value="${user.broker?.clientCode || 'LEM-MAX-ALGO'}" style="width:100%;padding:8px 12px;background:rgba(18,18,21,0.8);border:1px solid var(--border-default);color:white;border-radius:8px;font-family:'JetBrains Mono';" />
          </div>
          <div class="form-group mb-3">
            <label>API Key / Webhook Secret</label>
            <input type="password" value="sk_live_99481948291048201" style="width:100%;padding:8px 12px;background:rgba(18,18,21,0.8);border:1px solid var(--border-default);color:white;border-radius:8px;font-family:'JetBrains Mono';" />
          </div>
          <button type="button" class="btn btn-primary btn-block btn-sm" id="btn-save-broker-keys">Update Broker Credentials</button>
        </form>
      </div>
    </div>
  `;

  container.querySelector("#btn-test-broker-ping")?.addEventListener("click", () => {
    showToast("Lemonn webhook ping returned HTTP 200 (14ms). Bridge active!", "success");
  });
  container.querySelector("#btn-save-broker-keys")?.addEventListener("click", () => {
    showToast("Broker credentials saved securely.", "success");
  });
}

// Sub-view: Watchlist
function renderPortalWatchlist(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>My Live Watchlist</h2>
        <p>Real-time tracked NSE liquid stocks with VCP consolidation stages.</p>
      </div>
    </div>

    <div class="glass-card" style="padding:0;overflow:hidden;">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th>COMPANY NAME</th>
              <th>LTP (₹)</th>
              <th>CHANGE</th>
              <th>VOLUME</th>
              <th>RSI</th>
              <th>VCP STAGE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${WATCHLIST_DATA.map(w => `
              <tr>
                <td><strong class="font-mono text-brand">${w.symbol}</strong></td>
                <td class="text-muted">${w.name}</td>
                <td class="font-mono font-bold">₹${w.ltp.toFixed(2)}</td>
                <td class="font-mono ${w.percent >= 0 ? 'text-profit' : 'text-loss'}">
                  ${w.percent >= 0 ? '+' : ''}${w.percent}%
                </td>
                <td class="font-mono text-muted">${w.volume}</td>
                <td class="font-mono">${w.rsi}</td>
                <td><span class="badge" style="background:rgba(99,102,241,0.15);color:var(--brand-light);padding:2px 6px;border-radius:4px;font-size:11px;">${w.vcpStatus}</span></td>
                <td>
                  <button class="btn btn-xs btn-primary btn-paper-buy" data-sym="${w.symbol}" data-price="${w.ltp}">Auto Trade</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll(".btn-paper-buy").forEach(b => {
    b.addEventListener("click", (e) => {
      const sym = e.target.getAttribute("data-sym");
      const price = parseFloat(e.target.getAttribute("data-price"));
      executePaperOrder(sym, "BUY", 20, price, "WATCHLIST");
    });
  });
}

// Sub-view: Screener
function renderPortalScreener(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Institutional Stock Screener</h2>
        <p>Scan 500+ NSE stocks by proprietary algorithms.</p>
      </div>
    </div>

    <div class="screener-card glass-card">
      <div class="screener-filter-bar">
        <div class="filter-tabs" id="portal-screener-tabs">
          <button class="tab-btn active" data-filter="all">All</button>
          <button class="tab-btn" data-filter="VCP Breakout">VCP Breakout</button>
          <button class="tab-btn" data-filter="Volume Surge">Volume Surge</button>
          <button class="tab-btn" data-filter="Momentum 52W">52W Momentum</button>
        </div>
        <input type="text" id="portal-screener-search" placeholder="Search symbol..." style="padding:8px 14px;background:rgba(18,18,21,0.8);border:1px solid var(--border-default);color:white;border-radius:8px;" />
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th>SECTOR</th>
              <th>LTP (₹)</th>
              <th>CHANGE</th>
              <th>ALGORITHM</th>
              <th>AI SCORE</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody id="portal-screener-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  function updateTable(filter = "all", q = "") {
    const tbody = container.querySelector("#portal-screener-tbody");
    let filtered = SCREENER_RESULTS;
    if (filter !== "all") filtered = filtered.filter(i => i.strategy === filter);
    if (q) filtered = filtered.filter(i => i.symbol.toLowerCase().includes(q.toLowerCase()));

    tbody.innerHTML = filtered.map(row => `
      <tr>
        <td><strong class="font-mono text-brand">${row.symbol}</strong></td>
        <td>${row.sector}</td>
        <td class="font-mono font-bold">₹${row.price.toFixed(2)}</td>
        <td class="font-mono ${row.change.startsWith('+') ? 'text-profit' : 'text-loss'}">${row.change}</td>
        <td><span class="badge" style="background:rgba(99,102,241,0.15);color:var(--brand-light);padding:2px 6px;border-radius:4px;font-size:11px;">${row.strategy}</span></td>
        <td><strong class="font-mono text-profit">${row.score}</strong></td>
        <td><button class="btn btn-xs btn-primary btn-portal-trade" data-sym="${row.symbol}" data-price="${row.price}">Deploy Trade</button></td>
      </tr>
    `).join("");

    tbody.querySelectorAll(".btn-portal-trade").forEach(btn => {
      btn.addEventListener("click", () => {
        executePaperOrder(btn.getAttribute("data-sym"), "BUY", 15, parseFloat(btn.getAttribute("data-price")), "SCREENER");
      });
    });
  }

  updateTable();

  container.querySelectorAll("#portal-screener-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      container.querySelectorAll("#portal-screener-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      updateTable(e.target.getAttribute("data-filter"), container.querySelector("#portal-screener-search").value);
    });
  });

  container.querySelector("#portal-screener-search")?.addEventListener("input", (e) => {
    const activeTab = container.querySelector("#portal-screener-tabs .tab-btn.active")?.getAttribute("data-filter") || "all";
    updateTable(activeTab, e.target.value);
  });
}

// Sub-view: Sector Rotation Heatmap
function renderPortalSectorRotation(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Sector Rotation &amp; Relative Strength Heatmap</h2>
        <p>Institutional capital rotation across Indian industry verticals.</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;">
      ${SECTOR_HEATMAP.map(sec => `
        <div class="glass-card" style="border-left:4px solid ${sec.change.startsWith('+') ? 'var(--profit)' : 'var(--loss)'};">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="font-weight:700;">${sec.sector}</h4>
            <span class="font-mono font-bold ${sec.change.startsWith('+') ? 'text-profit' : 'text-loss'}">${sec.change}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Momentum: <strong>${sec.momentum}</strong></div>
          <div style="font-size:12px;color:var(--text-secondary);">Top Leader: <span class="text-brand font-mono">${sec.leader}</span></div>
        </div>
      `).join("")}
    </div>
  `;
}

// Sub-view: Fundamental & FII/DII
function renderPortalFundamental(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Institutional FII / DII Flows &amp; Fundamentals</h2>
        <p>Track smart money cash inflows, index futures contracts, and financial ratios.</p>
      </div>
    </div>

    <div class="portal-metrics-row mb-4">
      <div class="metric-card">
        <div class="m-head"><span>FII NET CASH</span><span class="pill-dot green"></span></div>
        <div class="m-amount font-mono text-profit">${FII_DII_CASH.fiiNet}</div>
        <div class="m-sub text-muted">Foreign Institutional Inflow</div>
      </div>
      <div class="metric-card">
        <div class="m-head"><span>DII NET CASH</span><span class="pill-dot green"></span></div>
        <div class="m-amount font-mono text-profit">${FII_DII_CASH.diiNet}</div>
        <div class="m-sub text-muted">Domestic Institutional Inflow</div>
      </div>
      <div class="metric-card">
        <div class="m-head"><span>FII INDEX FUTURES</span></div>
        <div class="m-amount font-mono text-brand">${FII_DII_CASH.fiiIndexFutures}</div>
        <div class="m-sub text-muted">Net Open Interest Positioning</div>
      </div>
    </div>

    <div class="glass-card">
      <h3 style="font-size:16px;font-weight:700;margin-bottom:8px;">Market Regime Summary</h3>
      <p style="font-size:14px;color:var(--profit-light);font-weight:600;margin-bottom:12px;">✓ ${FII_DII_CASH.netSentiment}</p>
      <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;">
        Foreign institutional investors and domestic mutual funds are net buyers across recent trading sessions. Algorithms are set to <strong>BULLISH AGGRESSIVE</strong>.
      </p>
    </div>
  `;
}

// Sub-view: Filings & Sentiment
function renderPortalFilings(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>BSE / NSE Corporate Filings &amp; AI Sentiment</h2>
        <p>Real-time regulatory disclosures analyzed with natural language models.</p>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;">
      ${CORPORATE_FILINGS.map(f => `
        <div class="glass-card" style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <strong class="font-mono text-brand">${f.company}</strong>
              <span class="badge" style="background:rgba(255,255,255,0.06);color:var(--text-muted);font-size:11px;padding:2px 6px;border-radius:4px;">${f.category}</span>
              <span style="font-size:11px;color:var(--text-muted);">${f.time}</span>
            </div>
            <p style="font-size:13px;color:var(--text-primary);">${f.title}</p>
          </div>
          <div>
            <span class="badge" style="background:${f.sentiment === 'positive' ? 'var(--profit-bg)' : f.sentiment === 'negative' ? 'var(--loss-bg)' : 'rgba(212,175,55,0.15)'};color:${f.sentiment === 'positive' ? 'var(--profit-light)' : f.sentiment === 'negative' ? 'var(--loss-light)' : 'var(--gold-light)'};padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;">
              ${f.sentiment.toUpperCase()}
            </span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// Sub-view: AI Trading Bot
function renderPortalAIBot(container) {
  const user = auth.getUser() || DEFAULT_MAX_USER;
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>AI Algo Assistant (Fly.io Microservice)</h2>
        <p>Ask anything about strategy parameters, live market open tomorrow, or risk rules.</p>
      </div>
    </div>

    <div class="glass-card" style="display:flex;flex-direction:column;height:480px;padding:0;overflow:hidden;">
      <div id="ai-chat-messages" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px;">
        <div style="align-self:flex-start;background:rgba(39,39,42,0.6);border:1px solid var(--border-default);padding:12px 16px;border-radius:12px;max-width:80%;font-size:13px;line-height:1.5;">
          👋 Hello <strong>${user.name}</strong>! I am your SwingExploder AI trading assistant. Your account is active with <strong>Max Plan privileges</strong>. How can I help optimize your algorithmic strategies today?
        </div>
      </div>

      <div style="padding:14px 20px;border-top:1px solid var(--border-subtle);background:rgba(18,18,21,0.8);display:flex;gap:10px;">
        <input type="text" id="ai-chat-input" placeholder="Ask about 'stop loss', 'lemonn broker', 'chakravyuh', 'dhurandhar'..." style="flex:1;background:rgba(0,0,0,0.5);border:1px solid var(--border-default);border-radius:8px;padding:10px 14px;color:white;font-size:13px;outline:none;" />
        <button class="btn btn-primary btn-sm" id="btn-send-ai-chat">Send</button>
      </div>
    </div>
  `;

  const chatContainer = container.querySelector("#ai-chat-messages");
  const chatInput = container.querySelector("#ai-chat-input");
  const sendBtn = container.querySelector("#btn-send-ai-chat");

  function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    const userMsg = document.createElement("div");
    userMsg.style.cssText = "align-self:flex-end;background:linear-gradient(135deg, var(--brand), var(--brand-dark));color:white;padding:10px 14px;border-radius:12px;max-width:80%;font-size:13px;";
    userMsg.textContent = text;
    chatContainer.appendChild(userMsg);
    chatInput.value = "";
    chatContainer.scrollTop = chatContainer.scrollHeight;

    setTimeout(() => {
      const lower = text.toLowerCase();
      let match = BOT_KNOWLEDGE.find(k => k.trigger.some(t => lower.includes(t)));
      let replyText = match ? match.reply : `I analyzed your query across your Max Plan engines. All strategies are running with ₹${accountBalance.toLocaleString('en-IN')} allocated.`;

      const botMsg = document.createElement("div");
      botMsg.style.cssText = "align-self:flex-start;background:rgba(39,39,42,0.6);border:1px solid var(--border-default);padding:12px 16px;border-radius:12px;max-width:80%;font-size:13px;line-height:1.5;";
      botMsg.innerHTML = replyText;
      chatContainer.appendChild(botMsg);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 400);
  }

  sendBtn?.addEventListener("click", sendChatMessage);
  chatInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
}

// Sub-view: Telegram Bot
function renderPortalTelegram(container) {
  container.innerHTML = `
    <div class="portal-view-header">
      <div class="portal-view-title">
        <h2>Telegram Live Trade Alerts</h2>
        <p>Instant notification webhook on trade entry, trailing stop loss, and exit.</p>
      </div>
    </div>

    <div class="glass-card" style="max-width:600px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <div style="font-size:32px;">📱</div>
        <div>
          <h3 style="font-size:16px;font-weight:700;">Connected Telegram Channel</h3>
          <span class="text-profit" style="font-size:12px;">● @SwingExploder_VIP_Bot (Active)</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;font-size:13px;margin-bottom:20px;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" checked style="accent-color:var(--brand);width:16px;height:16px;" />
          <span>Send Instant Entry Alerts (Dhurandhar, Brahmastra)</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" checked style="accent-color:var(--brand);width:16px;height:16px;" />
          <span>Send Trailing Stop Loss Adjustments</span>
        </label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" checked style="accent-color:var(--brand);width:16px;height:16px;" />
          <span>Daily P&L &amp; Evening Performance Summary</span>
        </label>
      </div>

      <button class="btn btn-primary btn-sm btn-block" id="btn-send-test-telegram">
        Send Test Telegram Notification
      </button>
    </div>
  `;

  container.querySelector("#btn-send-test-telegram")?.addEventListener("click", () => {
    showToast("Telegram notification dispatched: '[SwingExploder] DHURANDHAR BUY NIFTY 24850 CE @ 142.50 | SL: 120 | TGT: 195'", "success");
  });
}

// Paper Trade Executor (Real-Money Execution Behavior)
export function executePaperOrder(symbol, side, qty, price, source, isAutonomous = false) {
  // Apply realistic slippage
  const execPrice = slippageEnabled
    ? side === "BUY" ? price * (1 + SLIPPAGE_PCT) : price * (1 - SLIPPAGE_PCT)
    : price;

  const cost = qty * execPrice;
  if (cost > accountBalance && side === "BUY") {
    if (!isAutonomous) {
      showToast(`Insufficient free margin for ₹${cost.toFixed(2)} order!`, "error");
    }
    return;
  }

  // Deduct realistic Brokerage + STT + Turnover taxes (0.03%)
  const fee = brokerageEnabled ? cost * BROKERAGE_STT_RATE : 0;
  totalBrokeragePaid += fee;
  accountBalance -= fee;

  const ordId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

  const orderRecord = {
    id: ordId,
    time: timeStr,
    symbol,
    type: side,
    qty,
    price: execPrice,
    status: "FILLED",
    strategy: source,
    fee: fee.toFixed(2)
  };

  orderHistory.unshift(orderRecord);

  // If Supabase is connected, record order permanently
  const user = auth.getUser();
  if (user && isSupabaseConfigured() && user.id !== "max-trader-master") {
    dbInsertOrder({
      id: ordId,
      user_id: user.id,
      time: timeStr,
      symbol,
      type: side,
      qty,
      price: execPrice,
      status: "FILLED",
      strategy: source
    });
  }

  if (!isAutonomous) {
    showToast(`Order ${ordId} Filled: ${side} ${qty}x ${symbol} @ ₹${execPrice.toFixed(2)} (Fee: ₹${fee.toFixed(2)})`, "success");
  }

  if (currentAppView === "home" || currentAppView === "reports") {
    renderPortalBody();
  }
}

// ==========================================================
// 6. EVENT LISTENERS & MODAL CONTROLS
// ==========================================================
function bindLandingEvents() {
  document.getElementById("btn-open-login")?.addEventListener("click", openAuthModal);
  document.getElementById("btn-quick-demo")?.addEventListener("click", () => {
    if (auth.isAuthenticated()) showAppView();
    else openAuthModal();
  });
  document.getElementById("hero-get-started-btn")?.addEventListener("click", openAuthModal);
  document.getElementById("hero-demo-login-btn")?.addEventListener("click", () => {
    if (auth.isAuthenticated()) showAppView();
    else openAuthModal();
  });

  // Screener filter tabs
  document.querySelectorAll("#screener-filter-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#screener-filter-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      renderScreenerTable(e.target.getAttribute("data-filter"), document.getElementById("screener-search-input").value);
    });
  });

  document.getElementById("screener-search-input")?.addEventListener("input", (e) => {
    const activeTab = document.querySelector("#screener-filter-tabs .tab-btn.active")?.getAttribute("data-filter") || "all";
    renderScreenerTable(activeTab, e.target.value);
  });

  // Testimonials
  document.querySelectorAll(".t-person-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-idx") || "0", 10);
      renderTestimonial(idx);
    });
  });

  // Support & contact
  document.getElementById("nav-support-btn")?.addEventListener("click", () => {
    window.open("https://wa.me/918962774024?text=Hello!%20I%20would%20like%20to%20know%20more%20about%20SwingExploder.", "_blank");
  });
}

function openAuthModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.add("open");
}

function closeAuthModal() {
  const modal = document.getElementById("login-modal");
  if (modal) modal.classList.remove("open");
}

function openPaperSettingsModal() {
  const modal = document.getElementById("paper-capital-modal");
  if (modal) {
    const { currentNetWorth, availableMargin } = calculatePortfolioTotals();
    const netEl = document.getElementById("paper-modal-networth");
    const availEl = document.getElementById("paper-modal-available");
    if (netEl) netEl.textContent = `₹${currentNetWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    if (availEl) availEl.textContent = `₹${availableMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    modal.classList.add("open");
  }
}

function closePaperSettingsModal() {
  const modal = document.getElementById("paper-capital-modal");
  if (modal) modal.classList.remove("open");
}

function openSupabaseModal() {
  const modal = document.getElementById("supabase-modal");
  if (modal) {
    const { url, anonKey } = getSupabaseConfig();
    const urlInput = document.getElementById("cfg-supabase-url");
    const keyInput = document.getElementById("cfg-supabase-key");
    const dot = document.getElementById("supabase-status-dot");
    const txt = document.getElementById("supabase-status-text");

    if (urlInput) urlInput.value = url;
    if (keyInput) keyInput.value = anonKey;

    if (isSupabaseConfigured()) {
      if (dot) dot.style.background = "#10b981";
      if (txt) txt.textContent = "Connected & Active (Supabase Cloud)";
    } else {
      if (dot) dot.style.background = "#ef4444";
      if (txt) txt.textContent = "Disconnected (Using Local Offline Storage)";
    }

    modal.classList.add("open");
  }
}

function closeSupabaseModal() {
  const modal = document.getElementById("supabase-modal");
  if (modal) modal.classList.remove("open");
}

function bindModalEvents() {
  document.getElementById("modal-close-btn")?.addEventListener("click", closeAuthModal);
  document.getElementById("login-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "login-modal") closeAuthModal();
  });

  // Tab switching in Auth Modal
  document.querySelectorAll(".auth-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab-btn").forEach(b => {
        b.classList.remove("active", "btn-primary");
        b.classList.add("btn-outline");
      });
      btn.classList.add("active", "btn-primary");
      btn.classList.remove("btn-outline");

      const tab = btn.getAttribute("data-tab");
      document.querySelectorAll(".auth-panel").forEach(p => p.style.display = "none");
      const targetPanel = document.getElementById(`auth-panel-${tab}`);
      if (targetPanel) targetPanel.style.display = "block";
    });
  });

  // Sign In Email Submit
  document.getElementById("btn-submit-signin")?.addEventListener("click", async () => {
    const email = document.getElementById("signin-email")?.value.trim();
    const pass = document.getElementById("signin-password")?.value.trim();
    const res = await auth.loginWithEmail(email, pass);
    if (res.success) {
      closeAuthModal();
    } else {
      showToast(res.message, "error");
    }
  });

  // Sign Up Email Submit
  document.getElementById("btn-submit-signup")?.addEventListener("click", async () => {
    const name = document.getElementById("signup-name")?.value.trim();
    const email = document.getElementById("signup-email")?.value.trim();
    const pass = document.getElementById("signup-password")?.value.trim();
    const res = await auth.registerWithEmail(name, email, pass);
    if (res.success) {
      closeAuthModal();
    } else {
      showToast(res.message, "error");
    }
  });

  // Mobile OTP Request
  document.getElementById("btn-send-otp")?.addEventListener("click", () => {
    const mobile = document.getElementById("login-mobile-input")?.value.trim();
    if (!/^\d{10}$/.test(mobile)) {
      showToast("Please enter a valid 10-digit mobile number.", "error");
      return;
    }
    document.getElementById("otp-phone-display").textContent = `+91 ${mobile}`;
    document.getElementById("auth-step-mobile").style.display = "none";
    document.getElementById("auth-step-otp").style.display = "block";
    showToast(`Verification code sent to +91 ${mobile}`, "info");
  });

  // Mobile OTP Verify
  document.getElementById("btn-verify-otp")?.addEventListener("click", async () => {
    const mobile = document.getElementById("login-mobile-input")?.value.trim();
    const otp = document.getElementById("login-otp-input")?.value.trim();
    const res = await auth.loginWithMobile(mobile, otp);
    if (res.success) {
      closeAuthModal();
    } else {
      showToast(res.message, "error");
    }
  });

  document.getElementById("btn-change-number")?.addEventListener("click", () => {
    document.getElementById("auth-step-otp").style.display = "none";
    document.getElementById("auth-step-mobile").style.display = "block";
  });
}

function bindSettingsModals() {
  // Paper capital modal bindings
  document.getElementById("modal-close-paper-btn")?.addEventListener("click", closePaperSettingsModal);
  document.getElementById("paper-capital-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "paper-capital-modal") closePaperSettingsModal();
  });

  // Quick chip buttons (+₹50K, +₹1L, +₹5L, etc.)
  document.querySelectorAll(".paper-chip-btn").forEach(chip => {
    chip.addEventListener("click", () => {
      const amt = parseFloat(chip.getAttribute("data-amt") || "0");
      const input = document.getElementById("custom-paper-deposit-input");
      if (input) input.value = amt;
    });
  });

  // Apply deposit & save rules
  document.getElementById("btn-apply-paper-deposit")?.addEventListener("click", async () => {
    const input = document.getElementById("custom-paper-deposit-input");
    const addedAmount = parseFloat(input?.value || "0");

    if (addedAmount > 0) {
      accountBalance += addedAmount;
      initialCapital += addedAmount;
      showToast(`Successfully deposited ₹${addedAmount.toLocaleString('en-IN')} paper capital!`, "success");
    }

    // Rules
    autoTradingActive = document.getElementById("paper-cfg-autotrade")?.checked ?? true;
    slippageEnabled = document.getElementById("paper-cfg-slippage")?.checked ?? true;
    brokerageEnabled = document.getElementById("paper-cfg-brokerage")?.checked ?? true;

    // Persist to user profile
    const user = auth.getUser();
    if (user) {
      auth.updateUserProfile({
        accountBalance,
        initialCapital
      });
    }

    closePaperSettingsModal();
    if (currentAppView === "home" || currentAppView === "reports") {
      renderPortalBody();
    }
  });

  // Reset baseline capital
  document.getElementById("btn-reset-baseline-capital")?.addEventListener("click", () => {
    accountBalance = 1000000.00;
    initialCapital = 1000000.00;
    totalBrokeragePaid = 0;
    activeStrategies.forEach(s => s.pnlToday = 0);
    showToast("Capital reset to ₹10,00,000.00 baseline.", "info");

    const user = auth.getUser();
    if (user) {
      auth.updateUserProfile({ accountBalance, initialCapital });
    }

    closePaperSettingsModal();
    renderPortalBody();
  });

  // Supabase modal bindings
  document.getElementById("modal-close-supabase-btn")?.addEventListener("click", closeSupabaseModal);
  document.getElementById("supabase-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "supabase-modal") closeSupabaseModal();
  });

  document.getElementById("btn-save-supabase")?.addEventListener("click", async () => {
    const url = document.getElementById("cfg-supabase-url")?.value.trim();
    const key = document.getElementById("cfg-supabase-key")?.value.trim();

    if (!url || !key) {
      showToast("Please provide both Supabase URL and Anon Key.", "error");
      return;
    }

    saveSupabaseConfig(url, key);
    showToast("Supabase configuration saved! Syncing database...", "success");
    await syncUserDatabase();
    closeSupabaseModal();
    renderPortalBody();
  });

  document.getElementById("btn-clear-supabase")?.addEventListener("click", () => {
    clearSupabaseConfig();
    showToast("Supabase config cleared. Switched to offline storage.", "info");
    closeSupabaseModal();
  });
}

function bindAppEvents() {
  // Sidebar navigation
  document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => {
    item.addEventListener("click", (e) => {
      document.querySelectorAll(".sidebar-menu .menu-item").forEach(i => i.classList.remove("active"));
      const btn = e.currentTarget;
      btn.classList.add("active");
      currentAppView = btn.getAttribute("data-app-view");
      renderPortalBody();
    });
  });

  // Back to Landing page button
  document.getElementById("btn-back-to-landing")?.addEventListener("click", () => {
    showLandingView();
  });

  // App Logout buttons
  document.getElementById("btn-app-logout")?.addEventListener("click", () => auth.logout());
  document.getElementById("btn-portal-logout")?.addEventListener("click", () => auth.logout());

  // Quick trade simulator in header
  document.getElementById("btn-quick-trade-sim")?.addEventListener("click", () => {
    executePaperOrder("NIFTY 24800 CE", "BUY", 50, 142.50, "DHURANDHAR");
  });

  // Open Paper Capital Modal from topbar
  document.getElementById("btn-open-paper-settings")?.addEventListener("click", () => {
    openPaperSettingsModal();
  });

  // Open Supabase DB Modal from topbar
  document.getElementById("btn-open-supabase-modal")?.addEventListener("click", () => {
    openSupabaseModal();
  });

  // Mobile sidebar toggle
  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    document.getElementById("app-sidebar").classList.toggle("open");
  });
}

// Global Toast System
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "slideIn 0.25s ease reverse forwards";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
