import { env } from "../lib/env";
import type { ResearchResponse } from "../types/research";

async function parseResponse(response: Response) {
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<ResearchResponse>;
}

export async function requestResearch(transcript: string) {
  const response = await fetch(`${env.apiBaseUrl}/v1/research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ transcript })
  });

  return parseResponse(response);
}
