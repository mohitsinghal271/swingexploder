// Real Authentication & Session Engine with Supabase & Max Plan Privileges
import { getSupabase, isSupabaseConfigured, dbFetchUserProfile, dbUpsertProfile } from "./supabase.js";

export const DEFAULT_MAX_USER = {
  id: "max-trader-master",
  name: "Mohit Singha",
  email: "mohitsingha271l@gmail.com",
  role: "Fund Manager / Prop Algo Trader",
  plan: "Max Plan (Lifetime Elite Access)",
  planExpiry: "2035-12-31",
  mobile: "918962774024",
  accountBalance: 1000000.00,
  initialCapital: 1000000.00,
  utilizedMargin: 0.00,
  availableMargin: 1000000.00,
  broker: {
    name: "Lemonn Broker Bridge",
    clientCode: "LEM-MOHIT-MAX",
    status: "Connected (Live Algo Stream)",
    pingMs: 14,
    accountBalance: "₹10,00,000.00",
    availableMargin: "₹10,00,000.00"
  }
};

export class AuthManager {
  constructor(onAuthChange) {
    this.onAuthChange = onAuthChange;
    this.currentUser = null;
    this.init();
  }

  async init() {
    // 1. Check local session cache first
    const saved = localStorage.getItem("se_user_session");
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch (e) {
        localStorage.removeItem("se_user_session");
      }
    }

    // 2. If Supabase is configured, check active Supabase Auth session
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      if (sb) {
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (session && session.user) {
            await this.loadSupabaseProfile(session.user);
          }

          // Listen for auth state changes
          sb.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
              await this.loadSupabaseProfile(session.user);
            } else if (event === "SIGNED_OUT") {
              this.logout();
            }
          });
        } catch (err) {
          console.warn("Supabase auth session check failed:", err);
        }
      }
    }

    if (this.onAuthChange) {
      this.onAuthChange(this.currentUser);
    }
  }

  async loadSupabaseProfile(sbUser) {
    const profile = await dbFetchUserProfile(sbUser.id);
    this.currentUser = {
      id: sbUser.id,
      name: profile?.name || sbUser.user_metadata?.name || "Master Algo Trader",
      email: sbUser.email || profile?.email || "trader@swingexploder.pro",
      role: profile?.role || "Master Algo Trader",
      plan: profile?.plan || "Max Plan (Lifetime Elite Access)",
      planExpiry: profile?.plan_expiry || "2035-12-31",
      mobile: profile?.phone || sbUser.phone || "",
      accountBalance: parseFloat(profile?.account_balance || 1000000.00),
      initialCapital: parseFloat(profile?.initial_capital || 1000000.00),
      utilizedMargin: parseFloat(profile?.utilized_margin || 0.00),
      availableMargin: parseFloat(profile?.available_margin || 1000000.00),
      broker: {
        name: profile?.broker_name || "Lemonn Broker Bridge",
        clientCode: profile?.broker_client_code || `LEM-${sbUser.id.slice(0, 8).toUpperCase()}`,
        status: profile?.broker_status || "Connected (Live Algo Stream)",
        pingMs: 14,
        accountBalance: `₹${(profile?.account_balance || 1000000).toLocaleString('en-IN')}`,
        availableMargin: `₹${(profile?.available_margin || 1000000).toLocaleString('en-IN')}`
      }
    };
    this.persistSession();
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUser() {
    return this.currentUser;
  }

  // Real Email & Password Login
  async loginWithEmail(email, password) {
    if (!email || !password) {
      return { success: false, message: "Please provide both email and password." };
    }

    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, message: error.message };
      }
      if (data && data.user) {
        await this.loadSupabaseProfile(data.user);
        return { success: true, user: this.currentUser };
      }
    }

    // Direct Login with Max Plan
    this.currentUser = {
      ...DEFAULT_MAX_USER,
      name: email.split("@")[0].toUpperCase() + " (Trader)",
      email: email
    };
    this.persistSession();
    return { success: true, user: this.currentUser };
  }

  // Real Registration with Max Plan Provisioning
  async registerWithEmail(name, email, password) {
    if (!email || !password) {
      return { success: false, message: "Please enter your name, email, and password." };
    }

    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || "Master Trader",
            plan: "Max Plan (Lifetime Elite Access)",
            role: "Master Algo Trader"
          }
        }
      });
      if (error) {
        return { success: false, message: error.message };
      }
      if (data && data.user) {
        // Create initial profile in public.profiles with Max Plan
        await dbUpsertProfile({
          id: data.user.id,
          name: name || "Master Trader",
          email: email,
          role: "Master Algo Trader",
          plan: "Max Plan (Lifetime Elite Access)",
          plan_expiry: "2035-12-31T23:59:59Z",
          account_balance: 1000000.00,
          initial_capital: 1000000.00,
          available_margin: 1000000.00,
          broker_name: "Lemonn Broker Bridge",
          broker_client_code: `LEM-${data.user.id.slice(0, 8).toUpperCase()}`,
          broker_status: "Connected"
        });
        await this.loadSupabaseProfile(data.user);
        return { success: true, user: this.currentUser };
      }
    }

    // Direct Registration fallback with Max Plan
    this.currentUser = {
      ...DEFAULT_MAX_USER,
      name: name || email.split("@")[0].toUpperCase(),
      email: email
    };
    this.persistSession();
    return { success: true, user: this.currentUser };
  }

  // Real or Direct Mobile OTP Login
  async loginWithMobile(mobile, otp) {
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return { success: false, message: "Please enter a valid 10-digit mobile number." };
    }

    if (!otp || otp.length < 4) {
      return { success: false, message: "Please enter the OTP." };
    }

    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      const { data, error } = await sb.auth.verifyOtp({
        phone: `+91${mobile}`,
        token: otp,
        type: "sms"
      });
      if (error) {
        return { success: false, message: error.message };
      }
      if (data && data.user) {
        await this.loadSupabaseProfile(data.user);
        return { success: true, user: this.currentUser };
      }
    }

    // Direct Mobile Login with Max Plan
    this.currentUser = {
      ...DEFAULT_MAX_USER,
      name: `Trader ${mobile.slice(-4)}`,
      email: `trader.${mobile.slice(-4)}@swingexploder.pro`,
      mobile,
      broker: {
        ...DEFAULT_MAX_USER.broker,
        clientCode: `LEM-${mobile.slice(-5)}`
      }
    };
    this.persistSession();
    return { success: true, user: this.currentUser };
  }

  // Update User Profile details
  async updateUserProfile(updates) {
    if (!this.currentUser) return;
    this.currentUser = { ...this.currentUser, ...updates };
    this.persistSession();

    if (isSupabaseConfigured() && this.currentUser.id && this.currentUser.id !== "max-trader-master") {
      await dbUpsertProfile({
        id: this.currentUser.id,
        ...updates
      });
    }
    if (this.onAuthChange) this.onAuthChange(this.currentUser);
  }

  persistSession() {
    localStorage.setItem("se_user_session", JSON.stringify(this.currentUser));
    localStorage.setItem("isuserLogin", "true");
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("userEmail", this.currentUser?.email || "");
    if (this.onAuthChange) this.onAuthChange(this.currentUser);
  }

  async logout() {
    if (isSupabaseConfigured()) {
      const sb = getSupabase();
      if (sb) {
        try {
          await sb.auth.signOut();
        } catch (e) {
          console.warn("Supabase signout failed:", e);
        }
      }
    }
    this.currentUser = null;
    localStorage.removeItem("se_user_session");
    localStorage.removeItem("isuserLogin");
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    if (this.onAuthChange) this.onAuthChange(null);
  }
}
