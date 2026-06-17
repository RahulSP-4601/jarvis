import { OverlayCard } from "../components/OverlayCard";
import { useVoiceSession } from "../hooks/useVoiceSession";

function getStateLabel(state: string) {
  if (state === "waiting") return "Waiting For Hey Jarvis";
  if (state === "listening") return "Listening";
  if (state === "thinking") return "Researching";
  if (state === "ready") return "Ready";
  if (state === "error") return "Error";
  return "Idle";
}

export function App() {
  const { voiceState, transcript, result, error, hideOverlay } = useVoiceSession();

  async function handleClose() {
    await hideOverlay();
  }

  return (
    <main className="app-shell">
      <OverlayCard
        transcript={transcript}
        result={result}
        stateLabel={getStateLabel(voiceState)}
        error={error}
        onClose={handleClose}
      />
    </main>
  );
}
