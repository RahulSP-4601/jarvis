import type { Session } from "@supabase/supabase-js";
import { env } from "../lib/env";
import type { BootstrapResponse } from "../types/bootstrap";

type BootstrapRequest = {
  platform: string;
  arch: string;
  appVersion: string;
  deviceName: string;
};

function getBootstrapRequest(): BootstrapRequest {
  return {
    platform: navigator.platform || "unknown",
    arch: "unknown",
    appVersion: "0.1.0",
    deviceName: navigator.userAgent || "unknown-device"
  };
}

export async function fetchBootstrap(session: Session) {
  const response = await fetch(`${env.apiBaseUrl}/v1/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify(getBootstrapRequest())
  });

  if (!response.ok) {
    let message = `Bootstrap failed with status ${response.status}`;

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // Ignore JSON parsing failures and fall back to the status-based message.
    }

    throw new Error(message);
  }

  return (await response.json()) as BootstrapResponse;
}
