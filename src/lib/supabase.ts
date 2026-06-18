import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export const supabase = env.isAuthConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
      }
    })
  : null;
