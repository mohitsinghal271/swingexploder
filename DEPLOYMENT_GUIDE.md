# SwingExploder: Production Deployment & Max Plan Guide

## 1. Supabase Database Setup (1-Click SQL)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Navigate to the **SQL Editor** on the left menu.
3. Paste the following SQL script and click **Run**:

```sql
-- 1. Profiles & Max Plan Subscription
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT DEFAULT 'Master Trader',
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'Master Algo Trader',
  plan TEXT DEFAULT 'Max Plan (Lifetime Access)',
  plan_expiry TIMESTAMPTZ DEFAULT '2035-12-31 23:59:59+00',
  account_balance NUMERIC DEFAULT 1000000.00,
  initial_capital NUMERIC DEFAULT 1000000.00,
  utilized_margin NUMERIC DEFAULT 0.00,
  available_margin NUMERIC DEFAULT 1000000.00,
  broker_name TEXT DEFAULT 'Lemonn Broker',
  broker_client_code TEXT DEFAULT 'LEM-MAX-ALGO',
  broker_status TEXT DEFAULT 'Connected',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Orders & Permanent Record Tracking
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  time TEXT NOT NULL,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL, -- 'BUY' or 'SELL'
  qty INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  status TEXT DEFAULT 'FILLED',
  strategy TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Strategy Deployments & Capital Allocations
CREATE TABLE IF NOT EXISTS public.user_strategies (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  strategy_id TEXT NOT NULL,
  name TEXT NOT NULL,
  allocation NUMERIC NOT NULL DEFAULT 50000,
  allocated_lots INTEGER NOT NULL DEFAULT 1,
  deployed BOOLEAN NOT NULL DEFAULT true,
  pnl_today NUMERIC NOT NULL DEFAULT 0.00,
  active_symbol TEXT,
  entry_price NUMERIC,
  current_price NUMERIC,
  target NUMERIC,
  stop_loss NUMERIC,
  qty INTEGER,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, strategy_id)
);

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_strategies ENABLE ROW LEVEL SECURITY;

-- 5. Access Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage strategies" ON public.user_strategies FOR ALL USING (auth.uid() = user_id);

-- 6. Trigger: Auto-Provision Max Plan on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, name, plan, role, plan_expiry, account_balance, initial_capital, available_margin)
  VALUES (
    new.id,
    new.email,
    new.phone,
    COALESCE(new.raw_user_meta_data->>'name', 'Master Trader'),
    'Max Plan (Lifetime Access)',
    'Master Algo Trader',
    '2035-12-31 23:59:59+00',
    1000000.00,
    1000000.00,
    1000000.00
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

---

## 2. Deploy Frontend to Vercel
1. Import this repository into [Vercel](https://vercel.com).
2. Set Root Directory to: `./` (or `swingexploder`).
3. Add Environment Variables:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://xyz.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key (`eyJ...`)
   - `VITE_RAILWAY_API_URL`: Your Railway Backend URL (once deployed)
4. Click **Deploy**. Vercel will build with Vite and route through [vercel.json](file:///c:/Users/idea/OneDrive/Desktop/projects/REA/swingexploder/vercel.json).

---

## 3. Deploy 24/7 Algo Worker to Railway
1. Open [Railway](https://railway.com) and create a **New Project**.
2. Deploy from GitHub Repo and select the `server/` directory as the root (or deploy Dockerfile).
3. Set Environment Variables in Railway:
   - `PORT`: `8080`
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role secret key
   - `TARGET_USER_ID`: Your Supabase user UUID
4. The background runner will automatically tick 24/7, execute algorithmic trades, deduct realistic brokerage/STT, and log orders into Supabase!

---

## 4. Features Added in this Version
- **No Mock Banners**: All floating demo credentials and mock test buttons have been purged.
- **Max Plan Enabled**: Immediate access to all 8 algorithms with Master Trader tier.
- **Paper Capital Modal**: Inject custom capital (+₹50K, +₹1L, +₹5L, +₹10L, +₹50L, +₹1Cr) anytime via the `💰 Paper Capital (+Add)` button.
- **Real-Money Simulation**: Orders include realistic 0.05% slippage and 0.03% exchange turnover/STT fees.
- **Audited Reports & Analysis**: Full P&L breakdown, win rate attribution, and 1-click **Download CSV Journal** export.
- **In-App Supabase Sync**: Connect directly via the `🗄️ Supabase DB` button in the topbar.
