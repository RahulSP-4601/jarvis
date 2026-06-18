import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { env } from "../lib/env";
import { supabase } from "../lib/supabase";

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(true);
  const processedAuthCodes = useRef(new Set<string>());

  useEffect(() => {
    if (!supabase) {
      setIsBusy(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
      }

      setSession(data.session);
      setIsBusy(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    const unsubscribeCallback = window.jarvisDesktop.onAuthCallback((url) => {
      void handleAuthCallback(url);
    });

    void window.jarvisDesktop.getAuthCallback().then((url) => {
      if (url) {
        void handleAuthCallback(url);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
      unsubscribeCallback();
    };
  }, []);

  async function handleAuthCallback(url: string) {
    if (!supabase) {
      return;
    }

    try {
      setIsBusy(true);
      setError("");
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get("code");

      if (!code) {
        const callbackError = parsedUrl.searchParams.get("error_description") || parsedUrl.searchParams.get("error");
        throw new Error(callbackError || "Missing auth code from Google OAuth callback.");
      }

      if (processedAuthCodes.current.has(code)) {
        return;
      }

      processedAuthCodes.current.add(code);

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw exchangeError;
      }
    } catch (callbackError) {
      setError(callbackError instanceof Error ? callbackError.message : "Google OAuth failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setError("Supabase auth is not configured yet.");
      return;
    }

    try {
      setIsBusy(true);
      setError("");

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: env.authRedirectUrl,
          skipBrowserRedirect: true
        }
      });

      if (oauthError) {
        throw oauthError;
      }

      if (!data.url) {
        throw new Error("Google OAuth did not return a redirect URL.");
      }

      await window.jarvisDesktop.openExternalUrl(data.url);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : "Google OAuth failed.");
      setIsBusy(false);
      return;
    }

    setIsBusy(false);
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    processedAuthCodes.current.clear();
    await supabase.auth.signOut();
  }

  return {
    error,
    isBusy,
    isConfigured: env.isAuthConfigured,
    session,
    signInWithGoogle,
    signOut
  };
}
