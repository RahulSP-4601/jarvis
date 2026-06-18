import type { ResearchResponse } from "../types/research";

type OverlayCardProps = {
  transcript: string;
  result: ResearchResponse | null;
  stateLabel: string;
  voiceState: string;
  error: string;
  onClose: () => void;
};

function renderImage(url: string, index: number) {
  return <img key={url} src={url} alt={`Research result ${index + 1}`} />;
}

function renderFinding(finding: string) {
  return <li key={finding}>{finding}</li>;
}

function getEmptyStateCopy(stateLabel: string) {
  if (stateLabel === "Listening") {
    return "Go ahead. Jarvis is listening for the rest of your thought.";
  }

  if (stateLabel === "Working on it") {
    return "Jarvis is researching now and will speak first when the answer is ready.";
  }

  return 'Say "Hey Jarvis" to start, then ask for details only when you want them on screen.';
}

function getStateClassName(voiceState: string) {
  return `status-pill status-${voiceState}`;
}

export function OverlayCard(props: OverlayCardProps) {
  const { transcript, result, stateLabel, voiceState, error, onClose } = props;

  return (
    <section className="overlay-card">
      <div className="hero-orb" aria-hidden="true" />

      <header className="overlay-header">
        <div>
          <p className="eyebrow">Jarvis</p>
          <h1>Your research partner, quietly on standby.</h1>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          Close
        </button>
      </header>

      <section className="hero-panel">
        <div className="status-row">
          <div className={getStateClassName(voiceState)}>{stateLabel}</div>
          <p className="muted-text">Voice-first research overlay</p>
        </div>

        <p className="hero-copy">
          {transcript
            ? `You said: ${transcript}`
            : "Jarvis stays off to the side until you need it, then brings the research into view."}
        </p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {result ? (
        <article className="result-panel">
          <section className="result-heading">
            <p className="panel-label">Research Brief</p>
            <h2>{result.title}</h2>
            <p className="summary-text">{result.summary}</p>
          </section>

          <section className="grid-panels">
            <article className="command-panel">
              <p className="panel-label">Key Findings</p>
              <ul className="panel-list">{result.keyFindings.map(renderFinding)}</ul>
            </article>

            <article className="command-panel">
              <p className="panel-label">Recommendation</p>
              <p>{result.recommendation}</p>
            </article>
          </section>

          {result.images.length > 0 ? (
            <section>
              <p className="panel-label">Reference Images</p>
              <div className="image-grid">{result.images.map(renderImage)}</div>
            </section>
          ) : null}
        </article>
      ) : (
        <article className="command-panel empty-panel">
          <p className="panel-label">On-screen Details</p>
          <p>{getEmptyStateCopy(stateLabel)}</p>
        </article>
      )}
    </section>
  );
}
