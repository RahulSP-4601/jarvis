import { useEffect, useRef, useState } from "react";
import { requestResearch } from "../services/research";
import type { ResearchResponse } from "../types/research";

type VoiceState = "idle" | "waiting" | "thinking" | "ready" | "error";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor() {
  const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return recognition as SpeechRecognitionCtor | undefined;
}

function speak(text: string) {
  if (!("speechSynthesis" in window) || text === "") {
    return;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

function normalizeTranscript(transcript: string) {
  return transcript.trim().replace(/\s+/g, " ");
}

function extractWakeCommand(transcript: string) {
  const normalized = transcript.toLowerCase();
  const wakePhrase = "hey jarvis";
  const index = normalized.indexOf(wakePhrase);
  if (index === -1) {
    return null;
  }

  return normalizeTranscript(transcript.slice(index + wakePhrase.length));
}

function isShowDetailsCommand(transcript: string) {
  const normalized = transcript.toLowerCase();
  return ["show details", "show me the details", "open the report", "show the research"].some(
    (phrase) => normalized.includes(phrase)
  );
}

function isCloseOverlayCommand(transcript: string) {
  const normalized = transcript.toLowerCase();
  return ["close this", "close it", "okay close it", "hide jarvis"].some((phrase) =>
    normalized.includes(phrase)
  );
}

export function useVoiceSession() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const manualStopRef = useRef(false);
  const awaitingPromptRef = useRef(false);
  const latestResultRef = useRef<ResearchResponse | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (!RecognitionCtor) {
      setVoiceState("error");
      setError("Speech recognition is not available in this environment.");
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    setVoiceState("waiting");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult?.isFinal) {
        return;
      }

      const nextTranscript = normalizeTranscript(lastResult[0].transcript);
      setTranscript(nextTranscript);
      void handleTranscript(nextTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      setVoiceState("error");
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (manualStopRef.current) {
        manualStopRef.current = false;
        return;
      }

      try {
        recognition.start();
      } catch {
        setVoiceState("error");
        setError("Jarvis could not restart background listening.");
      }
    };

    recognition.start();

    return () => {
      manualStopRef.current = true;
      recognition.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  async function handleTranscript(nextTranscript: string) {
    setError("");

    if (isCloseOverlayCommand(nextTranscript)) {
      await window.jarvisDesktop.hideOverlay();
      setResult(null);
      latestResultRef.current = null;
      setVoiceState("waiting");
      speak("Closing the details.");
      return;
    }

    if (isShowDetailsCommand(nextTranscript) && latestResultRef.current) {
      setResult(latestResultRef.current);
      await window.jarvisDesktop.showOverlay();
      setVoiceState("ready");
      speak("Showing the details.");
      return;
    }

    if (isShowDetailsCommand(nextTranscript)) {
      speak("There is no recent research to show yet.");
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
    setVoiceState("ready");
    speak("I am listening.");
  }

  async function runResearch(command: string) {
    setVoiceState("thinking");
    setTranscript(command);

    try {
      const response = await requestResearch(command);
      latestResultRef.current = response;
      setVoiceState("ready");
      setResult(null);
      speak(response.summary);
    } catch (requestError) {
      setVoiceState("error");
      setError(requestError instanceof Error ? requestError.message : "Unknown error");
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
