declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
  }

  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface Window {
    jarvisDesktop: {
      showOverlay: () => Promise<void>;
      showOrb: () => Promise<void>;
      hideSurface: () => Promise<void>;
      getBootstrapState: () => Promise<{
        setupComplete: boolean;
        microphoneStatus: string;
        assistantState: {
          voiceState: "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
          surfaceMode: "hidden" | "orb" | "overlay";
          transcript: string;
          result: import("./research").ResearchResponse | null;
          error: string;
          nativeWakeEnabled: boolean;
          nativeWakeStatus: string;
          speechText: string;
          speechRequestId: number;
        };
      }>;
      requestMicrophoneAccess: () => Promise<boolean>;
      openMicrophoneSettings: () => Promise<void>;
      openExternalUrl: (url: string) => Promise<void>;
      getAuthCallback: () => Promise<string | null>;
      markSetupComplete: () => Promise<void>;
      resetSetup: () => Promise<void>;
      activateListening: () => Promise<void>;
      updateRuntimeConfig: (payload: { apiBaseUrl?: string }) => Promise<void>;
      notifySpeechFinished: (speechRequestId: number) => Promise<void>;
      onAuthCallback: (listener: (url: string) => void) => () => void;
      onAssistantState: (
        listener: (state: {
          voiceState: "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
          surfaceMode: "hidden" | "orb" | "overlay";
          transcript: string;
          result: import("./research").ResearchResponse | null;
          error: string;
          nativeWakeEnabled: boolean;
          nativeWakeStatus: string;
          speechText: string;
          speechRequestId: number;
        }) => void
      ) => () => void;
    };
  }
}

export {};
