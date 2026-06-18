import { useEffect, useState } from "react";
import { OverlayCard } from "../components/OverlayCard";
import { VoiceOrb } from "../components/VoiceOrb";
import { useVoiceSession } from "../hooks/useVoiceSession";

type BootstrapState = "loading" | "setup" | "ready";
type SurfaceMode = "hidden" | "orb" | "overlay";

function getStateLabel(state: string) {
  if (state === "waiting") return "Waiting for you";
  if (state === "listening") return "Listening";
  if (state === "thinking") return "Working on it";
  if (state === "speaking") return "Speaking";
  if (state === "ready") return "Ready";
  if (state === "error") return "Needs attention";
  return "Idle";
}

function getSetupHint(microphoneStatus: string) {
  if (microphoneStatus === "denied") {
    return "Microphone access was denied. Open System Settings, allow Jarvis, then come back here.";
  }

  if (microphoneStatus === "granted" || microphoneStatus === "authorized") {
    return "Microphone access is ready. Finish setup and Jarvis will stay quietly available in the background.";
  }

  return "Jarvis needs microphone access once so you can talk naturally and get spoken answers back.";
}

function SetupView(props: {
  microphoneStatus: string;
  error: string;
  onEnableMicrophone: () => Promise<void>;
  onOpenSettings: () => Promise<void>;
  onFinishSetup: () => Promise<void>;
}) {
  const { microphoneStatus, error, onEnableMicrophone, onOpenSettings, onFinishSetup } = props;
  const microphoneReady =
    microphoneStatus === "granted" || microphoneStatus === "authorized";
  const microphoneDenied = microphoneStatus === "denied";

  return (
    <section className="overlay-card setup-card">
      <div className="hero-orb" aria-hidden="true" />

      <header className="overlay-header">
        <div>
          <p className="eyebrow">Jarvis First Launch</p>
          <h1>Let Jarvis hear you once, then stay available like a quiet partner.</h1>
        </div>
      </header>

      <section className="hero-panel">
        <div className="status-row">
          <div className="status-pill status-setup">Setup in progress</div>
          <p className="muted-text">Voice-first desktop chief of staff</p>
        </div>

        <p className="hero-copy">{getSetupHint(microphoneStatus)}</p>
      </section>

      <section className="grid-panels">
        <article className="command-panel">
          <p className="panel-label">Microphone Status</p>
          <p>{microphoneStatus}</p>
        </article>

        <article className="command-panel">
          <p className="panel-label">What Jarvis Does</p>
          <ul className="panel-list">
            <li>Runs in the background after setup.</li>
            <li>Listens when you say "Hey Jarvis".</li>
            <li>Speaks first, then shows the full brief only when asked.</li>
          </ul>
        </article>
      </section>

      <div className="actions">
        {!microphoneReady ? (
          <button className="primary-button" onClick={onEnableMicrophone} type="button">
            Allow Microphone
          </button>
        ) : (
          <button className="primary-button" onClick={onFinishSetup} type="button">
            Finish Setup
          </button>
        )}

        {microphoneDenied ? (
          <button className="ghost-button" onClick={onOpenSettings} type="button">
            Open Settings
          </button>
        ) : null}
      </div>

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}

export function App() {
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>("loading");
  const [microphoneStatus, setMicrophoneStatus] = useState("unknown");
  const [setupError, setSetupError] = useState("");
  const { voiceState, surfaceMode, transcript, result, error, dismissSurface } = useVoiceSession(
    bootstrapState === "ready"
  );

  useEffect(() => {
    void loadBootstrapState();
  }, []);

  useEffect(() => {
    if (bootstrapState !== "ready") {
      return;
    }

    void syncSurface(surfaceMode);
  }, [bootstrapState, surfaceMode]);

  async function syncSurface(nextSurface: SurfaceMode) {
    if (nextSurface === "overlay") {
      await window.jarvisDesktop.showOverlay();
      return;
    }

    if (nextSurface === "orb") {
      await window.jarvisDesktop.showOrb();
      return;
    }

    await window.jarvisDesktop.hideSurface();
  }

  async function loadBootstrapState() {
    const nextState = await window.jarvisDesktop.getBootstrapState();
    setMicrophoneStatus(nextState.microphoneStatus);
    setBootstrapState(nextState.setupComplete ? "ready" : "setup");
  }

  async function enableMicrophone() {
    setSetupError("");

    try {
      const granted = await window.jarvisDesktop.requestMicrophoneAccess();
      if (!granted) {
        setSetupError("Jarvis still needs microphone access before it can listen properly.");
      }
    } catch (requestError) {
      setSetupError(
        requestError instanceof Error ? requestError.message : "Jarvis could not request microphone access."
      );
    }

    await loadBootstrapState();
  }

  async function openMicrophoneSettings() {
    await window.jarvisDesktop.openMicrophoneSettings();
  }

  async function finishSetup() {
    const microphoneReady =
      microphoneStatus === "granted" || microphoneStatus === "authorized";

    if (!microphoneReady) {
      setSetupError("Allow microphone access first so Jarvis can hear you.");
      return;
    }

    await window.jarvisDesktop.markSetupComplete();
    await loadBootstrapState();
  }

  async function handleClose() {
    dismissSurface();
    await window.jarvisDesktop.hideSurface();
  }

  if (bootstrapState === "loading") {
    return (
      <main className="app-shell app-shell-setup">
        <section className="overlay-card">
          <div className="hero-orb" aria-hidden="true" />
          <div className="status-pill">Preparing Jarvis</div>
        </section>
      </main>
    );
  }

  if (bootstrapState === "setup") {
    return (
      <main className="app-shell app-shell-setup">
        <SetupView
          microphoneStatus={microphoneStatus}
          error={setupError}
          onEnableMicrophone={enableMicrophone}
          onOpenSettings={openMicrophoneSettings}
          onFinishSetup={finishSetup}
        />
      </main>
    );
  }

  if (surfaceMode === "overlay") {
    return (
      <main className="app-shell app-shell-overlay">
        <OverlayCard
          transcript={transcript}
          result={result}
          stateLabel={getStateLabel(voiceState)}
          voiceState={voiceState}
          error={error}
          onClose={handleClose}
        />
      </main>
    );
  }

  return (
    <main className="app-shell app-shell-orb">
      <VoiceOrb
        transcript={transcript}
        stateLabel={getStateLabel(voiceState)}
        voiceState={voiceState}
        error={error}
      />
    </main>
  );
}
