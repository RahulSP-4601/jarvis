const apiBaseUrl = import.meta.env.VITE_JARVIS_API_BASE_URL;

if (!apiBaseUrl) {
  console.warn("Missing VITE_JARVIS_API_BASE_URL. Using localhost fallback.");
}

export const env = {
  apiBaseUrl: apiBaseUrl || "http://localhost:8080"
};
