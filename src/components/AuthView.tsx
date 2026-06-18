type AuthViewProps = {
  error: string;
  isBusy: boolean;
  isGoogleEnabled: boolean;
  onGoogle: () => Promise<void>;
};

export function AuthView(props: AuthViewProps) {
  const { error, isBusy, isGoogleEnabled, onGoogle } = props;

  return (
    <section className="overlay-card setup-card">
      <div className="hero-orb" aria-hidden="true" />

      <header className="overlay-header">
        <div>
          <p className="eyebrow">Jarvis Access</p>
          <h1>Sign in once so Jarvis can provision itself on this laptop.</h1>
        </div>
      </header>

      <section className="hero-panel">
        <div className="status-row">
          <div className="status-pill status-setup">Launch soon beta</div>
          <p className="muted-text">Smooth install, no manual key setup</p>
        </div>

        <p className="hero-copy">
          Continue with Google once. If it is your first time, your Jarvis account is created
          automatically. Then Jarvis fetches your runtime config and prepares this laptop behind
          the scenes.
        </p>
      </section>

      <section className="command-panel auth-form">
        <div className="grid-panels">
          <article className="command-panel">
            <p className="panel-label">How Access Works</p>
            <ul className="panel-list">
              <li>Google is the only sign-in method for V1.</li>
              <li>Your first Google login creates the account automatically.</li>
              <li>Jarvis then asks for microphone permission one time on this laptop.</li>
            </ul>
          </article>

          <article className="command-panel">
            <p className="panel-label">After First Setup</p>
            <ul className="panel-list">
              <li>Jarvis starts with the laptop after you complete setup.</li>
              <li>You do not need to manually open the app every time.</li>
              <li>You wake it with "Hey Jarvis" and similar supported commands.</li>
            </ul>
          </article>
        </div>

        <div className="actions">
          <button
            className="primary-button"
            disabled={isBusy || !isGoogleEnabled}
            onClick={onGoogle}
            type="button"
          >
            {isBusy ? "Opening Google..." : "Continue with Google"}
          </button>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </section>
  );
}
