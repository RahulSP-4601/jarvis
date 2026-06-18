import type { BrowserWindow } from "electron";
import fs from "node:fs/promises";
import { OpenWakeWordBridge, type WakeEvent } from "./openWakeWordBridge.js";

export type VoiceState = "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
export type SurfaceMode = "hidden" | "orb" | "overlay";

type ResearchResponse = {
  action: "respond" | "hide_overlay";
  transcript: string;
  title: string;
  summary: string;
  keyFindings: string[];
  recommendation: string;
  images: string[];
  spokenAnswer?: string;
  followUpPrompts?: string[];
};

export type AssistantState = {
  voiceState: VoiceState;
  surfaceMode: SurfaceMode;
  transcript: string;
  result: ResearchResponse | null;
  error: string;
  nativeWakeEnabled: boolean;
  nativeWakeStatus: string;
  speechText: string;
  speechRequestId: number;
};

type RuntimeConfig = {
  apiBaseUrl: string;
  nativeWakeProvider: string;
  wakeLaunchArgs: string[];
  wakeLaunchCommand: string;
};

type CaptureMode = "idle" | "wake" | "followup" | "thinking" | "speaking";

const followUpTimeoutMs = 12000;

function createInitialState(): AssistantState {
  return {
    voiceState: "idle",
    surfaceMode: "hidden",
    transcript: "",
    result: null,
    error: "",
    nativeWakeEnabled: false,
    nativeWakeStatus: "inactive",
    speechText: "",
    speechRequestId: 0
  };
}

export class AssistantRuntime {
  private readonly window: BrowserWindow;
  private readonly onSurfaceChange: (surface: SurfaceMode) => void;
  private config: RuntimeConfig;
  private state = createInitialState();
  private running = false;
  private captureMode: CaptureMode = "idle";
  private setupComplete = false;
  private wakeBridge: OpenWakeWordBridge | null = null;
  private activeRequest: AbortController | null = null;
  private followUpTimer: NodeJS.Timeout | null = null;
  private pendingSpeechAfterResponse = false;

  constructor(
    window: BrowserWindow,
    config: RuntimeConfig,
    onSurfaceChange: (surface: SurfaceMode) => void
  ) {
    this.window = window;
    this.config = config;
    this.onSurfaceChange = onSurfaceChange;
  }

  getState() {
    return this.state;
  }

  async setSetupComplete(setupComplete: boolean) {
    this.setupComplete = setupComplete;

    if (!setupComplete) {
      await this.stop();
      this.updateState({
        voiceState: "idle",
        nativeWakeEnabled: false,
        nativeWakeStatus: "setup_required"
      });
      return;
    }

    await this.start();
  }

  async updateRuntimeConfig(patch: Partial<RuntimeConfig>) {
    const nextConfig = { ...this.config, ...patch };
    const shouldRestart =
      this.config.apiBaseUrl !== nextConfig.apiBaseUrl ||
      this.config.nativeWakeProvider !== nextConfig.nativeWakeProvider ||
      this.config.wakeLaunchCommand !== nextConfig.wakeLaunchCommand ||
      this.config.wakeLaunchArgs.join("\n") !== nextConfig.wakeLaunchArgs.join("\n");

    this.config = nextConfig;
    if (!shouldRestart) {
      return;
    }

    await this.stop();
    if (this.setupComplete) {
      await this.start();
    }
  }

  async start() {
    if (this.running || !this.setupComplete) {
      return;
    }

    if (this.config.nativeWakeProvider !== "openwakeword") {
      this.updateState({
        voiceState: "waiting",
        nativeWakeEnabled: false,
        nativeWakeStatus: "unsupported_provider"
      });
      return;
    }

    try {
      this.wakeBridge = new OpenWakeWordBridge({
        command: this.config.wakeLaunchCommand,
        args: this.config.wakeLaunchArgs,
        onEvent: (event) => {
          void this.handleWakeEvent(event);
        }
      });
      await this.wakeBridge.start();
      this.running = true;
      this.captureMode = "wake";
      this.updateState({
        voiceState: "waiting",
        nativeWakeEnabled: true,
        nativeWakeStatus: "ready",
        error: ""
      });
    } catch (error) {
      this.updateState({
        voiceState: "error",
        nativeWakeEnabled: false,
        nativeWakeStatus: "init_failed",
        error: formatError(error, "Wake engine failed to start.")
      });
      await this.stop();
    }
  }

  async stop() {
    this.running = false;
    this.captureMode = "idle";
    this.clearFollowUpTimer();
    this.activeRequest?.abort();
    this.activeRequest = null;
    await this.wakeBridge?.stop();
    this.wakeBridge = null;
  }

  async activateListening() {
    if (!this.running) {
      await this.start();
    }

    if (!this.running) {
      this.updateState({
        surfaceMode: "orb",
        voiceState: "error",
        error: "Jarvis wake engine is not active yet."
      });
      return;
    }

    this.clearFollowUpTimer();
    this.beginUtteranceCapture("listening");
    this.captureMode = "thinking";
    this.wakeBridge?.sendCommand("force_capture");
  }

  hideSurface() {
    this.clearFollowUpTimer();
    this.captureMode = this.running ? "wake" : "idle";
    this.wakeBridge?.sendCommand("reset_wake");
    this.updateState({
      surfaceMode: "hidden",
      result: null,
      voiceState: "waiting",
      error: ""
    });
  }

  notifySpeechFinished(speechRequestId: number) {
    if (speechRequestId !== this.state.speechRequestId || !this.pendingSpeechAfterResponse) {
      return;
    }

    this.pendingSpeechAfterResponse = false;
    this.captureMode = "followup";
    this.scheduleFollowUpExpiry();
    this.updateState({ voiceState: "ready" });
    this.wakeBridge?.sendCommand("force_capture");
  }

  private beginUtteranceCapture(voiceState: VoiceState) {
    this.updateState({
      surfaceMode: "orb",
      voiceState,
      transcript: "",
      error: ""
    });
    this.onSurfaceChange("orb");
  }

  private async handleWakeEvent(event: WakeEvent) {
    if (!this.running) {
      return;
    }

    if (event.type === "error") {
      this.updateState({
        voiceState: "error",
        nativeWakeEnabled: false,
        nativeWakeStatus: "init_failed",
        error: event.message
      });
      return;
    }

    if (event.type === "wake") {
      this.captureMode = "thinking";
      this.beginUtteranceCapture("listening");
      return;
    }

    await this.processUtterance(event.path);
  }

  private async processUtterance(audioPath: string) {
    const controller = new AbortController();
    this.activeRequest = controller;
    this.updateState({ voiceState: "thinking", surfaceMode: "orb", error: "" });

    try {
      const audioBuffer = await fs.readFile(audioPath);
      const response = await this.sendAudioCommand(audioBuffer, controller.signal);
      this.handleResponse(response);
    } catch (error) {
      if (!controller.signal.aborted) {
        this.handleRequestError(error);
      }
    } finally {
      if (this.activeRequest === controller) {
        this.activeRequest = null;
      }

      await fs.unlink(audioPath).catch(() => undefined);
    }
  }

  private handleResponse(response: ResearchResponse) {
    if (isCloseCommand(response.transcript)) {
      this.updateState({
        transcript: response.transcript,
        result: null,
        surfaceMode: "hidden",
        voiceState: "waiting"
      });
      this.captureMode = "wake";
      this.onSurfaceChange("hidden");
      return;
    }

    if (isShowDetailsCommand(response.transcript)) {
      this.handleShowDetails(response.transcript);
      return;
    }

    const nextSurface = response.action === "hide_overlay" ? "hidden" : "orb";
    this.captureMode = "speaking";
    this.pushSpeech(response.spokenAnswer || response.summary, {
      transcript: response.transcript,
      result: response,
      surfaceMode: nextSurface,
      voiceState: "speaking",
      error: ""
    });
    this.onSurfaceChange(nextSurface);
  }

  private handleShowDetails(transcript: string) {
    this.captureMode = "speaking";
    if (this.state.result) {
      this.pushSpeech("I've opened the full brief on screen.", {
        transcript,
        surfaceMode: "overlay",
        voiceState: "speaking"
      });
      this.onSurfaceChange("overlay");
      return;
    }

    this.pushSpeech("I don't have a recent brief ready yet.", {
      transcript,
      surfaceMode: "orb",
      voiceState: "speaking"
    });
    this.onSurfaceChange("orb");
  }

  private handleRequestError(error: unknown) {
    this.captureMode = "wake";
    this.updateState({
      voiceState: "error",
      surfaceMode: "orb",
      error: formatError(error, "Jarvis could not process that request.")
    });
    this.onSurfaceChange("orb");
  }

  private async sendAudioCommand(audioBuffer: Buffer, signal: AbortSignal) {
    const formData = new FormData();
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" });
    formData.set("audio", audioBlob, "jarvis-command.wav");

    const response = await fetch(`${this.config.apiBaseUrl}/v1/voice/command`, {
      method: "POST",
      body: formData,
      signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as ResearchResponse;
  }

  private pushSpeech(text: string, patch: Partial<AssistantState>) {
    this.pendingSpeechAfterResponse = true;
    this.updateState({
      ...patch,
      speechText: text,
      speechRequestId: this.state.speechRequestId + 1
    });
  }

  private scheduleFollowUpExpiry() {
    this.clearFollowUpTimer();
    this.followUpTimer = setTimeout(() => {
      this.captureMode = "wake";
      this.wakeBridge?.sendCommand("reset_wake");
      this.updateState({ surfaceMode: "hidden", voiceState: "waiting" });
      this.onSurfaceChange("hidden");
    }, followUpTimeoutMs);
  }

  private clearFollowUpTimer() {
    if (!this.followUpTimer) {
      return;
    }

    clearTimeout(this.followUpTimer);
    this.followUpTimer = null;
  }

  private updateState(patch: Partial<AssistantState>) {
    this.state = { ...this.state, ...patch };
    this.window.webContents.send("jarvis:assistant-state", this.state);
  }
}

function formatError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function includesAnyPhrase(transcript: string, phrases: string[]) {
  const normalized = transcript.toLowerCase();
  return phrases.some((phrase) => normalized.includes(phrase));
}

function isShowDetailsCommand(transcript: string) {
  return includesAnyPhrase(transcript, [
    "show details",
    "show me the details",
    "show the research",
    "show me that",
    "put it on screen",
    "open the report",
    "open that",
    "details dikhao",
    "report dikhao",
    "vigato batao",
    "details batao"
  ]);
}

function isCloseCommand(transcript: string) {
  return includesAnyPhrase(transcript, [
    "close this",
    "close it",
    "close jarvis",
    "hide jarvis",
    "hide that",
    "dismiss this",
    "okay close it",
    "band karo",
    "hide karo",
    "બંધ કરો"
  ]);
}
