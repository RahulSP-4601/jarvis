import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { requestResearch } from "../services/research";
import type { ResearchResponse } from "../types/research";

type VoiceState = "idle" | "waiting" | "listening" | "thinking" | "speaking" | "ready" | "error";
type SurfaceMode = "hidden" | "orb" | "overlay";
type SpeechRecognitionCtor = new () => SpeechRecognition;

type VoiceRuntime = {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
};

const orbHideDelayMs = 12000;

function getSpeechRecognitionCtor() {
  const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return recognition as SpeechRecognitionCtor | undefined;
}

function getRecognitionLanguage() {
  return navigator.languages?.[0] || navigator.language || "en-US";
}

function getAcceptedLocales() {
  return navigator.languages?.length ? [...navigator.languages] : [getRecognitionLanguage()];
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
    "open that",
    "details dikhao",
    "report dikhao",
    "vigato batao",
    "details batao"
  ]);
}

function isCloseSurfaceCommand(transcript: string) {
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
    voices.find((voice) => voice.lang.toLowerCase().startsWith(getRecognitionLanguage().slice(0, 2))) ||
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

  utterance.rate = 0.98;
  utterance.pitch = 0.95;
  return utterance;
}

function clearTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function useVoiceSession(enabled: boolean) {
  const runtimeRef = useRef<VoiceRuntime | null>(null);
  const awaitingPromptRef = useRef(false);
  const followUpOpenRef = useRef(false);
  const latestResultRef = useRef<ResearchResponse | null>(null);
  const hideOrbTimerRef = useRef<number | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("hidden");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      clearSessionState();
      return;
    }

    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setVoiceState("error");
      setError("Speech recognition is not available in this environment.");
      setSurfaceMode("orb");
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
        setSurfaceMode("orb");
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
      clearSessionState();
      window.speechSynthesis?.cancel();
    };
  }, [enabled]);

  async function handleTranscript(nextTranscript: string) {
    clearTimer(hideOrbTimerRef);
    setError("");

    if (isCloseSurfaceCommand(nextTranscript)) {
      followUpOpenRef.current = false;
      setResult(null);
      setSurfaceMode("hidden");
      setVoiceState("waiting");
      await speak(runtimeRef.current, setVoiceState, "Alright. I'll step back.", "waiting");
      return;
    }

    if (isShowDetailsCommand(nextTranscript) && latestResultRef.current) {
      setResult(latestResultRef.current);
      setSurfaceMode("overlay");
      await speak(
        runtimeRef.current,
        setVoiceState,
        "I've opened the full brief on screen.",
        "ready"
      );
      return;
    }

    if (isShowDetailsCommand(nextTranscript)) {
      setSurfaceMode("orb");
      await speak(
        runtimeRef.current,
        setVoiceState,
        "I don't have a recent brief ready yet.",
        "waiting"
      );
      scheduleOrbHide();
      return;
    }

    if (awaitingPromptRef.current) {
      awaitingPromptRef.current = false;
      await runResearch(nextTranscript);
      return;
    }

    if (followUpOpenRef.current && nextTranscript.length > 0) {
      await runResearch(nextTranscript);
      return;
    }

    const wakeCommand = extractWakeCommand(nextTranscript);
    if (wakeCommand === null) {
      return;
    }

    setSurfaceMode("orb");

    if (wakeCommand.length > 0) {
      await runResearch(wakeCommand);
      return;
    }

    awaitingPromptRef.current = true;
    setVoiceState("listening");
    await speak(runtimeRef.current, setVoiceState, "I'm here. Go ahead.", "listening");
  }

  async function runResearch(command: string) {
    setSurfaceMode("orb");
    setVoiceState("thinking");
    setTranscript(command);

    try {
      const response = await requestResearch({
        transcript: command,
        locale: getRecognitionLanguage(),
        acceptedLocales: getAcceptedLocales()
      });

      latestResultRef.current = response;
      followUpOpenRef.current = true;
      setResult(null);

      if (response.action === "hide_overlay") {
        setSurfaceMode("hidden");
      } else {
        setSurfaceMode("orb");
      }

      await speak(
        runtimeRef.current,
        setVoiceState,
        response.spokenAnswer || response.summary,
        "ready"
      );
      scheduleOrbHide();
    } catch (requestError) {
      setSurfaceMode("orb");
      setVoiceState("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Jarvis hit a snag while working on that."
      );
    }
  }

  function dismissSurface() {
    clearTimer(hideOrbTimerRef);
    followUpOpenRef.current = false;
    setResult(null);
    setSurfaceMode("hidden");
  }

  function clearSessionState() {
    clearTimer(hideOrbTimerRef);
    awaitingPromptRef.current = false;
    followUpOpenRef.current = false;
    setVoiceState("idle");
    setSurfaceMode("hidden");
    setTranscript("");
    setResult(null);
    setError("");
  }

  function scheduleOrbHide() {
    clearTimer(hideOrbTimerRef);
    hideOrbTimerRef.current = window.setTimeout(() => {
      followUpOpenRef.current = false;
      setSurfaceMode((currentMode) => (currentMode === "overlay" ? currentMode : "hidden"));
    }, orbHideDelayMs);
  }

  return {
    voiceState,
    surfaceMode,
    transcript,
    result,
    error,
    dismissSurface
  };
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
  recognition.lang = getRecognitionLanguage();

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
  text: string,
  nextState: VoiceState
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

  runtime?.resume();
  setVoiceState(nextState);
}
