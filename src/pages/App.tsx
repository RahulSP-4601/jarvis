import { useEffect, useState } from "react";
import { AuthView } from "../components/AuthView";
import { OverlayCard } from "../components/OverlayCard";
import { VoiceOrb } from "../components/VoiceOrb";
import { useAuthSession } from "../hooks/useAuthSession";
import { useVoiceSession } from "../hooks/useVoiceSession";
import { fetchBootstrap } from "../services/bootstrap";
import type { BootstrapResponse } from "../types/bootstrap";

type BootstrapState = "loading" | "auth" | "bootstrap" | "setup" | "ready";
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
  const [bootstrapPayload, setBootstrapPayload] = useState<BootstrapResponse | null>(null);
  const [bootstrapError, setBootstrapError] = useState("");
  const {
    error: authError,
    isBusy: isAuthBusy,
    isConfigured: isAuthConfigured,
    session,
    signInWithGoogle,
    signOut
  } = useAuthSession();
  const {
    voiceState,
    surfaceMode,
    transcript,
    result,
    error,
    nativeWakeEnabled,
    nativeWakeStatus,
    dismissSurface,
    activateListening
  } = useVoiceSession(
    bootstrapState === "ready"
  );
  const isGoogleEnabled = bootstrapPayload?.features.googleOAuthEnabled ?? true;

  useEffect(() => {
    void loadBootstrapState();
  }, [session]);

  async function loadBootstrapState() {
    if (!isAuthConfigured) {
      setBootstrapState("auth");
      return;
    }

    if (!session) {
      setBootstrapPayload(null);
      setBootstrapState("auth");
      await window.jarvisDesktop.updateRuntimeConfig({
        apiBaseUrl: "",
        nativeWakeAccessKey: ""
      });
      return;
    }

    try {
      setBootstrapState("bootstrap");
      setBootstrapError("");
      const payload = await fetchBootstrap(session);
      setBootstrapPayload(payload);
      await window.jarvisDesktop.updateRuntimeConfig({
        apiBaseUrl: payload.runtime.apiBaseUrl,
        nativeWakeAccessKey: payload.runtime.nativeWakeAccessKey
      });
    } catch (error) {
      setBootstrapError(error instanceof Error ? error.message : "Bootstrap failed.");
      setBootstrapState("auth");
      return;
    }

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
  }

  async function handleActivateListening() {
    await activateListening();
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

  if (bootstrapState === "bootstrap") {
    return (
      <main className="app-shell app-shell-setup">
        <section className="overlay-card">
          <div className="hero-orb" aria-hidden="true" />
          <div className="status-pill">Provisioning Jarvis</div>
          <p className="hero-copy">
            Signing you in, fetching your runtime config, and preparing Jarvis for this laptop.
          </p>
        </section>
      </main>
    );
  }

  if (bootstrapState === "auth") {
    return (
      <main className="app-shell app-shell-setup">
        {isAuthConfigured ? (
          <AuthView
            error={bootstrapError || authError}
            isBusy={isAuthBusy}
            isGoogleEnabled={isGoogleEnabled}
            onGoogle={signInWithGoogle}
          />
        ) : (
          <section className="overlay-card setup-card">
            <div className="hero-orb" aria-hidden="true" />
            <div className="status-pill status-error">Auth not configured</div>
            <p className="hero-copy">
              Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable sign in, sign up, and
              Google OAuth in the app.
            </p>
          </section>
        )}
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
        <div className="session-bar">
          <span>{bootstrapPayload?.user.email}</span>
          <button className="ghost-button" onClick={() => void signOut()} type="button">
            Sign Out
          </button>
        </div>
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
      <div className="session-bar">
        <span>{bootstrapPayload?.user.email}</span>
        <button className="ghost-button" onClick={() => void signOut()} type="button">
          Sign Out
        </button>
      </div>
      <VoiceOrb
        transcript={transcript}
        stateLabel={getStateLabel(voiceState)}
        voiceState={voiceState}
        error={error || getWakeStatusHint(nativeWakeEnabled, nativeWakeStatus)}
      />
      {nativeWakeEnabled ? null : (
        <button className="manual-activate-button" onClick={handleActivateListening} type="button">
          Start Jarvis
        </button>
      )}
    </main>
  );
}

function getWakeStatusHint(nativeWakeEnabled: boolean, nativeWakeStatus: string) {
  if (nativeWakeEnabled) {
    return "";
  }

  if (nativeWakeStatus === "missing_access_key") {
    return "Native wake engine is waiting for PICOVOICE_ACCESS_KEY. You can still test with the Start Jarvis button.";
  }

  if (nativeWakeStatus === "init_failed") {
    return "Native wake engine could not start. Use the Start Jarvis button while we check the device setup.";
  }

  return "";
}
