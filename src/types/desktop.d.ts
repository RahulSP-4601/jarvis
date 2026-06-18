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
      }>;
      requestMicrophoneAccess: () => Promise<boolean>;
      openMicrophoneSettings: () => Promise<void>;
      markSetupComplete: () => Promise<void>;
      resetSetup: () => Promise<void>;
    };
  }
}

export {};
