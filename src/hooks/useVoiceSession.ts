import { useEffect, useState } from "react";
import type { ResearchResponse } from "../types/research";

type VoiceState = "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
type SurfaceMode = "hidden" | "orb" | "overlay";

type AssistantState = {
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

const initialState: AssistantState = {
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

function pickPreferredVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }

  const primaryLanguage = (navigator.languages?.[0] || navigator.language || "en-US")
    .slice(0, 2)
    .toLowerCase();

  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith(primaryLanguage)) ||
    voices.find((voice) => /samantha|ava|allison|daniel/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ||
    voices[0]
  );
}

function speak(text: string) {
  if (!("speechSynthesis" in window) || text === "") {
    return Promise.resolve();
  }

  window.speechSynthesis.cancel();

  return new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickPreferredVoice();

    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 0.98;
    utterance.pitch = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function useVoiceSession(enabled: boolean) {
  const [assistantState, setAssistantState] = useState<AssistantState>(initialState);

  useEffect(() => {
    if (!enabled) {
      setAssistantState(initialState);
      return;
    }

    return window.jarvisDesktop.onAssistantState((state) => {
      setAssistantState(state);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled || assistantState.speechRequestId === 0 || assistantState.speechText === "") {
      return;
    }

    let cancelled = false;

    void speak(assistantState.speechText).then(async () => {
      if (cancelled) {
        return;
      }

      await window.jarvisDesktop.notifySpeechFinished(assistantState.speechRequestId);
    });

    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
    };
  }, [enabled, assistantState.speechRequestId, assistantState.speechText]);

  async function dismissSurface() {
    await window.jarvisDesktop.hideSurface();
  }

  async function activateListening() {
    await window.jarvisDesktop.activateListening();
  }

  return {
    ...assistantState,
    dismissSurface,
    activateListening
  };
}
