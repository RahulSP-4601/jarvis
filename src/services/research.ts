import { env } from "../lib/env";
import type { ResearchResponse } from "../types/research";

type ResearchRequest = {
  transcript: string;
  locale: string;
  acceptedLocales: string[];
};

async function parseResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ResearchResponse>;
}

export async function requestResearch(payload: ResearchRequest, signal?: AbortSignal) {
  const response = await fetch(`${env.apiBaseUrl}/v1/research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal
  });

  return parseResponse(response);
}
