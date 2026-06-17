import type { ResearchResponse } from "../types/research";

type OverlayCardProps = {
  transcript: string;
  result: ResearchResponse | null;
  stateLabel: string;
  error: string;
  onClose: () => void;
};

function renderImage(url: string, index: number) {
  return <img key={url} src={url} alt={`Research result ${index + 1}`} />;
}

function renderFinding(finding: string) {
  return <li key={finding}>{finding}</li>;
}

export function OverlayCard(props: OverlayCardProps) {
  const { transcript, result, stateLabel, error, onClose } = props;

  return (
    <section className="overlay-card">
      <header className="overlay-header">
        <div>
          <p className="eyebrow">Jarvis Detail Overlay</p>
          <h1>Voice-first research details</h1>
        </div>
        <button className="ghost-button" onClick={onClose} type="button">
          Close
        </button>
      </header>

      <div className="status-pill">{stateLabel}</div>

      <div className="command-panel">
        <p className="panel-label">Latest Voice Intent</p>
        <p>{transcript || "Say “Hey Jarvis” and ask for details when you need them."}</p>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {result ? (
        <article className="result-panel">
          <h2>{result.title}</h2>
          <p>{result.summary}</p>

          <section>
            <p className="panel-label">Key Findings</p>
            <ul>{result.keyFindings.map(renderFinding)}</ul>
          </section>

          <section>
            <p className="panel-label">Recommendation</p>
            <p>{result.recommendation}</p>
          </section>

          <section>
            <p className="panel-label">Reference Images</p>
            <div className="image-grid">{result.images.map(renderImage)}</div>
          </section>
        </article>
      ) : null}
    </section>
  );
}
