import { contextBridge, ipcRenderer } from "electron";

type AssistantState = {
  voiceState: "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
  surfaceMode: "hidden" | "orb" | "overlay";
  transcript: string;
  result: {
    action: "respond" | "hide_overlay";
    transcript: string;
    title: string;
    summary: string;
    keyFindings: string[];
    recommendation: string;
    images: string[];
    spokenAnswer?: string;
    followUpPrompts?: string[];
  } | null;
  error: string;
  nativeWakeEnabled: boolean;
  nativeWakeStatus: string;
  speechText: string;
  speechRequestId: number;
};

const jarvisDesktop = {
  showOverlay: () => ipcRenderer.invoke("jarvis:show-overlay"),
  showOrb: () => ipcRenderer.invoke("jarvis:show-orb"),
  hideSurface: () => ipcRenderer.invoke("jarvis:hide-surface"),
  getBootstrapState: () => ipcRenderer.invoke("jarvis:get-bootstrap-state"),
  requestMicrophoneAccess: () => ipcRenderer.invoke("jarvis:request-microphone-access"),
  openMicrophoneSettings: () => ipcRenderer.invoke("jarvis:open-microphone-settings"),
  openExternalUrl: (url: string) => ipcRenderer.invoke("jarvis:open-external-url", url),
  getAuthCallback: () => ipcRenderer.invoke("jarvis:get-auth-callback"),
  markSetupComplete: () => ipcRenderer.invoke("jarvis:mark-setup-complete"),
  resetSetup: () => ipcRenderer.invoke("jarvis:reset-setup"),
  activateListening: () => ipcRenderer.invoke("jarvis:activate-listening"),
  updateRuntimeConfig: (payload: { apiBaseUrl?: string }) =>
    ipcRenderer.invoke("jarvis:update-runtime-config", payload),
  notifySpeechFinished: (speechRequestId: number) =>
    ipcRenderer.invoke("jarvis:notify-speech-finished", speechRequestId),
  onAuthCallback: (listener: (url: string) => void) => {
    const handler = (_event: unknown, url: string) => {
      listener(url);
    };

    ipcRenderer.on("jarvis:auth-callback", handler);
    return () => {
      ipcRenderer.removeListener("jarvis:auth-callback", handler);
    };
  },
  onAssistantState: (listener: (state: AssistantState) => void) => {
    const handler = (_event: unknown, state: AssistantState) => {
      listener(state);
    };

    ipcRenderer.on("jarvis:assistant-state", handler);
    return () => {
      ipcRenderer.removeListener("jarvis:assistant-state", handler);
    };
  }
};

contextBridge.exposeInMainWorld("jarvisDesktop", jarvisDesktop);
