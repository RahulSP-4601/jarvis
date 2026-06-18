import { useEffect, useRef, useState } from "react";
import { requestResearch } from "../services/research";
import type { ResearchResponse } from "../types/research";

type VoiceState = "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
type SpeechRecognitionCtor = new () => SpeechRecognition;

type VoiceRuntime = {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

function getSpeechRecognitionCtor() {
  const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return recognition as SpeechRecognitionCtor | undefined;
}

function normalizeTranscript(transcript: string) {
  return transcript.trim().replace(/\s+/g, " ");
}

function extractWakeCommand(transcript: string) {
  const normalized = transcript.toLowerCase();
  const match = normalized.match(/\b(hey|hi|okay|ok)\s+jarvis\b|\bjarvis\b/);
  if (!match || match.index === undefined) {
    return null;
  }

  return normalizeTranscript(transcript.slice(match.index + match[0].length));
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
    "open that"
  ]);
}

function isCloseOverlayCommand(transcript: string) {
  return includesAnyPhrase(transcript, [
    "close this",
    "close it",
    "close jarvis",
    "hide jarvis",
    "hide that",
    "dismiss this",
    "okay close it"
  ]);
}

function pickPreferredVoice() {
  if (!("speechSynthesis" in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }

  return (
    voices.find((voice) => /samantha|ava|allison|daniel/i.test(voice.name)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ||
    voices[0]
  );
}

function createFriendlySpeech(text: string) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickPreferredVoice();

  if (voice) {
    utterance.voice = voice;
  }

  utterance.rate = 1;
  utterance.pitch = 0.95;
  return utterance;
}

async function pauseFor(durationMs: number) {
  await new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

export function useVoiceSession(enabled: boolean) {
  const runtimeRef = useRef<VoiceRuntime | null>(null);
  const awaitingPromptRef = useRef(false);
  const latestResultRef = useRef<ResearchResponse | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      resetSessionState(setVoiceState, setTranscript, setResult, setError);
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setVoiceState("error");
      setError("Speech recognition is not available in this environment.");
      return;
    }

    const runtime = createVoiceRuntime(RecognitionCtor, {
      onTranscript: (nextTranscript) => {
        setTranscript(nextTranscript);
        void handleTranscript(nextTranscript);
      },
      onRestartFailure: () => {
        setVoiceState("error");
        setError("Jarvis could not restart background listening.");
      },
      onListening: () => {
        setVoiceState("waiting");
      }
    });

    runtimeRef.current = runtime;
    setVoiceState("waiting");
    runtime.start();

    return () => {
      runtime.stop();
      runtimeRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, [enabled]);

  async function handleTranscript(nextTranscript: string) {
    setError("");

    if (isCloseOverlayCommand(nextTranscript)) {
      setResult(null);
      latestResultRef.current = null;
      setVoiceState("waiting");
      await window.jarvisDesktop.hideOverlay();
      await speak(runtimeRef.current, setVoiceState, "Alright. I'll get out of the way.");
      return;
    }

    if (isShowDetailsCommand(nextTranscript) && latestResultRef.current) {
      setResult(latestResultRef.current);
      setVoiceState("ready");
      await window.jarvisDesktop.showOverlay();
      await speak(runtimeRef.current, setVoiceState, "I've put the details on screen.");
      return;
    }

    if (isShowDetailsCommand(nextTranscript)) {
      await speak(runtimeRef.current, setVoiceState, "I don't have anything recent to show yet.");
      return;
    }

    if (awaitingPromptRef.current) {
      awaitingPromptRef.current = false;
      await runResearch(nextTranscript);
      return;
    }

    const wakeCommand = extractWakeCommand(nextTranscript);
    if (wakeCommand === null) {
      return;
    }

    if (wakeCommand.length > 0) {
      await runResearch(wakeCommand);
      return;
    }

    awaitingPromptRef.current = true;
    setVoiceState("listening");
    await speak(runtimeRef.current, setVoiceState, "I'm here. Go ahead.");
  }

  async function runResearch(command: string) {
    setVoiceState("thinking");
    setTranscript(command);

    try {
      const response = await requestResearch(command);
      latestResultRef.current = response;
      setVoiceState("ready");
      setResult(response.action === "respond" ? null : null);

      if (response.action === "hide_overlay") {
        await window.jarvisDesktop.hideOverlay();
      }

      await speak(runtimeRef.current, setVoiceState, response.summary);
    } catch (requestError) {
      setVoiceState("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Jarvis hit a snag while working on that."
      );
    }
  }

  async function hideOverlay() {
    setResult(null);
    await window.jarvisDesktop.hideOverlay();
  }

  return {
    voiceState,
    transcript,
    result,
    error,
    hideOverlay
  };
}

function resetSessionState(
  setVoiceState: (value: VoiceState) => void,
  setTranscript: (value: string) => void,
  setResult: (value: ResearchResponse | null) => void,
  setError: (value: string) => void
) {
  setVoiceState("idle");
  setTranscript("");
  setResult(null);
  setError("");
}

function createVoiceRuntime(
  RecognitionCtor: SpeechRecognitionCtor,
  handlers: {
    onTranscript: (transcript: string) => void;
    onRestartFailure: () => void;
    onListening: () => void;
  }
) {
  const recognition = new RecognitionCtor();
  let manualStop = false;
  let pausedForSpeech = false;

  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const lastResult = event.results[event.results.length - 1];
    if (!lastResult?.isFinal) {
      return;
    }

    handlers.onTranscript(normalizeTranscript(lastResult[0].transcript));
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error === "no-speech" || event.error === "aborted") {
      return;
    }

    handlers.onRestartFailure();
  };

  recognition.onend = () => {
    if (manualStop || pausedForSpeech) {
      return;
    }

    try {
      handlers.onListening();
      recognition.start();
    } catch {
      handlers.onRestartFailure();
    }
  };

  function start() {
    manualStop = false;
    pausedForSpeech = false;
    recognition.start();
  }

  function stop() {
    manualStop = true;
    pausedForSpeech = false;
    recognition.stop();
  }

  function pause() {
    pausedForSpeech = true;
    recognition.stop();
  }

  function resume() {
    pausedForSpeech = false;
    try {
      recognition.start();
    } catch {
      handlers.onRestartFailure();
    }
  }

  return {
    start,
    stop,
    pause,
    resume
  };
}

async function speak(
  runtime: VoiceRuntime | null,
  setVoiceState: (value: VoiceState) => void,
  text: string
) {
  if (!("speechSynthesis" in window) || text === "") {
    return;
  }

  runtime?.pause();
  setVoiceState("speaking");
  window.speechSynthesis.cancel();

  await new Promise<void>((resolve) => {
    const utterance = createFriendlySpeech(text);
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });

  await pauseFor(180);
  runtime?.resume();
  setVoiceState("waiting");
}
