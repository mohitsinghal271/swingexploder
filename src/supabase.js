// Supabase Client and Database Service for SwingExploder
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

let supabaseInstance = null;

// Retrieve configuration from Vite env, user localStorage override, or project default
export function getSupabaseConfig() {
  const envUrl = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
  const envKey = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";

  const savedUrl = localStorage.getItem("se_supabase_url") || "";
  const savedKey = localStorage.getItem("se_supabase_anon_key") || "";

  const defaultUrl = "https://vobzbxubffeovpnfywbq.supabase.co";
  const defaultKey = "sb_publishable_D8-fu6u54R2YPPYUqGqHTw_cjdC3Pwp";

  return {
    url: savedUrl || envUrl || defaultUrl,
    anonKey: savedKey || envKey || defaultKey
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return !!(url && anonKey && url.startsWith("https://") && anonKey.length > 20);
}

export function initSupabase() {
  const { url, anonKey } = getSupabaseConfig();
  if (url && anonKey) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      return supabaseInstance;
    } catch (err) {
      console.warn("Failed to initialize Supabase client:", err);
      supabaseInstance = null;
    }
  }
  return null;
}

export function getSupabase() {
  if (!supabaseInstance) {
    initSupabase();
  }
  return supabaseInstance;
}

export function saveSupabaseConfig(url, anonKey) {
  if (url) localStorage.setItem("se_supabase_url", url.trim());
  if (anonKey) localStorage.setItem("se_supabase_anon_key", anonKey.trim());
  initSupabase();
}

export function clearSupabaseConfig() {
  localStorage.removeItem("se_supabase_url");
  localStorage.removeItem("se_supabase_anon_key");
  supabaseInstance = null;
}

// ==========================================
// Database Queries & Persistent Record Store
// ==========================================

export async function dbFetchUserProfile(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return null;
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error && error.code !== "PGRST116") console.error("Error fetching profile:", error);
    return data;
  } catch (e) {
    console.error("Supabase profile fetch error:", e);
    return null;
  }
}

export async function dbUpsertProfile(profile) {
  const sb = getSupabase();
  if (!sb || !profile.id) return null;
  try {
    const { data, error } = await sb
      .from("profiles")
      .upsert(profile)
      .select()
      .single();
    if (error) console.error("Error updating profile:", error);
    return data;
  } catch (e) {
    console.error("Supabase profile upsert error:", e);
    return null;
  }
}

export async function dbFetchOrders(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return null;
  try {
    const { data, error } = await sb
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching orders:", error);
    return data || [];
  } catch (e) {
    console.error("Supabase orders fetch error:", e);
    return null;
  }
}

export async function dbInsertOrder(order) {
  const sb = getSupabase();
  if (!sb || !order.user_id) return null;
  try {
    const { data, error } = await sb
      .from("orders")
      .insert([order])
      .select()
      .single();
    if (error) console.error("Error inserting order:", error);
    return data;
  } catch (e) {
    console.error("Supabase order insert error:", e);
    return null;
  }
}

export async function dbFetchStrategies(userId) {
  const sb = getSupabase();
  if (!sb || !userId) return null;
  try {
    const { data, error } = await sb
      .from("user_strategies")
      .select("*")
      .eq("user_id", userId);
    if (error) console.error("Error fetching strategies:", error);
    return data || [];
  } catch (e) {
    console.error("Supabase strategies fetch error:", e);
    return null;
  }
}

export async function dbSaveStrategy(strategy) {
  const sb = getSupabase();
  if (!sb || !strategy.user_id) return null;
  try {
    const { data, error } = await sb
      .from("user_strategies")
      .upsert(strategy, { onConflict: "user_id,strategy_id" })
      .select();
    if (error) console.error("Error saving strategy:", error);
    return data;
  } catch (e) {
    console.error("Supabase strategy upsert error:", e);
    return null;
  }
}
