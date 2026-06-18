const apiBaseUrl = import.meta.env.VITE_JARVIS_API_BASE_URL;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const authRedirectUrl = import.meta.env.VITE_JARVIS_AUTH_REDIRECT_URL || "jarvis://auth/callback";

if (!apiBaseUrl) {
  console.warn("Missing VITE_JARVIS_API_BASE_URL. Using localhost fallback.");
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase env vars. Auth will remain unavailable until configured.");
}

export const env = {
  apiBaseUrl: apiBaseUrl || "http://localhost:8080",
  supabaseUrl: supabaseUrl || "",
  supabaseAnonKey: supabaseAnonKey || "",
  authRedirectUrl,
  isAuthConfigured: supabaseUrl !== undefined && supabaseAnonKey !== undefined && supabaseUrl !== "" && supabaseAnonKey !== ""
};
