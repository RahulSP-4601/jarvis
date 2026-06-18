import type { BrowserWindow } from "electron";
import { BuiltinKeyword, Porcupine } from "@picovoice/porcupine-node";
import { PvRecorder } from "@picovoice/pvrecorder-node";

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
  nativeWakeAccessKey: string;
};

type CaptureMode = "idle" | "wake" | "command" | "followup" | "thinking" | "speaking";

const followUpTimeoutMs = 12000;
const maxUtteranceMs = 20000;
const speechStartTimeoutMs = 5000;
const silenceWindowMs = 1200;
const amplitudeThreshold = 900;

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
  private config: RuntimeConfig;
  private readonly onSurfaceChange: (surface: SurfaceMode) => void;
  private state = createInitialState();
  private recorder: PvRecorder | null = null;
  private porcupine: Porcupine | null = null;
  private running = false;
  private captureMode: CaptureMode = "idle";
  private setupComplete = false;
  private shouldStop = false;
  private utteranceFrames: Int16Array[] = [];
  private utteranceStartedAt = 0;
  private lastSpeechAt = 0;
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
      this.updateState({ voiceState: "idle", nativeWakeEnabled: false, nativeWakeStatus: "setup_required" });
      return;
    }

    await this.start();
  }

  async updateRuntimeConfig(patch: Partial<RuntimeConfig>) {
    const nextConfig = {
      ...this.config,
      ...patch
    };
    const shouldRestart =
      this.config.apiBaseUrl !== nextConfig.apiBaseUrl ||
      this.config.nativeWakeAccessKey !== nextConfig.nativeWakeAccessKey;

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

    if (!this.config.nativeWakeAccessKey) {
      this.updateState({
        voiceState: "waiting",
        nativeWakeEnabled: false,
        nativeWakeStatus: "missing_access_key"
      });
      return;
    }

    try {
      this.porcupine = new Porcupine(
        this.config.nativeWakeAccessKey,
        [BuiltinKeyword.JARVIS],
        [0.65]
      );
      this.recorder = new PvRecorder(this.porcupine.frameLength);
      this.recorder.start();
      this.running = true;
      this.shouldStop = false;
      this.captureMode = "wake";
      this.updateState({
        voiceState: "waiting",
        nativeWakeEnabled: true,
        nativeWakeStatus: "ready",
        error: ""
      });
      void this.runLoop();
    } catch (error) {
      this.updateState({
        voiceState: "error",
        nativeWakeEnabled: false,
        nativeWakeStatus: "init_failed",
        error: error instanceof Error ? error.message : "Wake engine failed to start."
      });
      await this.stop();
    }
  }

  async stop() {
    this.shouldStop = true;
    this.running = false;
    this.captureMode = "idle";
    this.clearFollowUpTimer();
    this.activeRequest?.abort();
    this.activeRequest = null;
    this.recorder?.release();
    this.recorder = null;
    this.porcupine?.release();
    this.porcupine = null;
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
    this.captureMode = "command";
    this.beginUtteranceCapture("listening");
  }

  hideSurface() {
    this.clearFollowUpTimer();
    this.captureMode = this.running ? "wake" : "idle";
    this.updateState({ surfaceMode: "hidden", result: null, voiceState: "waiting", error: "" });
  }

  notifySpeechFinished(speechRequestId: number) {
    if (speechRequestId !== this.state.speechRequestId || !this.pendingSpeechAfterResponse) {
      return;
    }

    this.pendingSpeechAfterResponse = false;
    this.captureMode = "followup";
    this.scheduleFollowUpExpiry();
    this.updateState({ voiceState: "ready" });
  }

  private async runLoop() {
    while (this.running && !this.shouldStop && this.recorder && this.porcupine) {
      const frame = await this.recorder.read();

      if (this.captureMode === "wake") {
        if (this.porcupine.process(frame) >= 0) {
          this.captureMode = "command";
          this.beginUtteranceCapture("listening");
        }
        continue;
      }

      if (this.captureMode === "command" || this.captureMode === "followup") {
        await this.consumeUtteranceFrame(frame);
      }
    }
  }

  private beginUtteranceCapture(voiceState: VoiceState) {
    this.utteranceFrames = [];
    this.utteranceStartedAt = Date.now();
    this.lastSpeechAt = 0;
    this.updateState({
      surfaceMode: "orb",
      voiceState,
      transcript: "",
      error: ""
    });
    this.onSurfaceChange("orb");
  }

  private async consumeUtteranceFrame(frame: Int16Array) {
    const now = Date.now();
    const amplitude = peakAmplitude(frame);
    const detectedSpeech = amplitude > amplitudeThreshold;

    if (detectedSpeech) {
      this.lastSpeechAt = now;
    }

    if (detectedSpeech || this.utteranceFrames.length > 0) {
      this.utteranceFrames.push(frame.slice());
    }

    if (this.utteranceFrames.length === 0 && now - this.utteranceStartedAt > speechStartTimeoutMs) {
      this.captureMode = "wake";
      this.updateState({ voiceState: "waiting", surfaceMode: "hidden" });
      this.onSurfaceChange("hidden");
      return;
    }

    if (this.utteranceFrames.length === 0) {
      return;
    }

    const utteranceElapsed = now - this.utteranceStartedAt;
    const silenceElapsed = this.lastSpeechAt > 0 ? now - this.lastSpeechAt : 0;
    const utteranceFinished =
      utteranceElapsed >= maxUtteranceMs ||
      (this.lastSpeechAt > 0 && silenceElapsed >= silenceWindowMs);

    if (!utteranceFinished) {
      return;
    }

    const audioFrames = this.utteranceFrames;
    this.utteranceFrames = [];
    this.captureMode = "thinking";
    await this.processUtterance(audioFrames);
  }

  private async processUtterance(frames: Int16Array[]) {
    const audioBuffer = wavFromFrames(frames, this.porcupine?.sampleRate || 16000);
    const controller = new AbortController();
    this.activeRequest = controller;
    this.updateState({ voiceState: "thinking", surfaceMode: "orb", error: "" });

    try {
      const response = await this.sendAudioCommand(audioBuffer, controller.signal);

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

      if (isShowDetailsCommand(response.transcript) && this.state.result) {
        this.captureMode = "speaking";
        this.pushSpeech("I've opened the full brief on screen.", {
          transcript: response.transcript,
          surfaceMode: "overlay",
          voiceState: "speaking"
        });
        this.onSurfaceChange("overlay");
        return;
      }

      if (isShowDetailsCommand(response.transcript)) {
        this.captureMode = "speaking";
        this.pushSpeech("I don't have a recent brief ready yet.", {
          transcript: response.transcript,
          surfaceMode: "orb",
          voiceState: "speaking"
        });
        this.onSurfaceChange("orb");
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
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      this.captureMode = "wake";
      this.updateState({
        voiceState: "error",
        surfaceMode: "orb",
        error: error instanceof Error ? error.message : "Jarvis could not process that request."
      });
      this.onSurfaceChange("orb");
    } finally {
      if (this.activeRequest === controller) {
        this.activeRequest = null;
      }
    }
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
    this.state = {
      ...this.state,
      ...patch
    };
    this.window.webContents.send("jarvis:assistant-state", this.state);
  }
}

function peakAmplitude(frame: Int16Array) {
  let peak = 0;

  for (let index = 0; index < frame.length; index += 1) {
    const value = Math.abs(frame[index] || 0);
    if (value > peak) {
      peak = value;
    }
  }

  return peak;
}

function wavFromFrames(frames: Int16Array[], sampleRate: number) {
  const sampleCount = frames.reduce((sum, frame) => sum + frame.length, 0);
  const pcmBuffer = Buffer.alloc(sampleCount * 2);
  let offset = 0;

  for (const frame of frames) {
    for (const sample of frame) {
      pcmBuffer.writeInt16LE(sample, offset);
      offset += 2;
    }
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
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
