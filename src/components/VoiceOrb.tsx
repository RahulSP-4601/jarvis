type VoiceOrbProps = {
  transcript: string;
  stateLabel: string;
  voiceState: string;
  error: string;
};

function getOrbHint(stateLabel: string, transcript: string) {
  if (errorPresent(transcript)) {
    return transcript;
  }

  if (stateLabel === "Listening") {
    return "Go ahead. Jarvis is with you.";
  }

  if (stateLabel === "Working on it") {
    return "Researching now. I'll answer first, then show details if you want them.";
  }

  if (stateLabel === "Speaking") {
    return "Replying in a calm voice, then easing back into the background.";
  }

  if (transcript) {
    return transcript;
  }

  return 'Say "Hey Jarvis" whenever you want help.';
}

function errorPresent(transcript: string) {
  return transcript.startsWith("Error:");
}

export function VoiceOrb(props: VoiceOrbProps) {
  const { transcript, stateLabel, voiceState, error } = props;
  const detailText = error || getOrbHint(stateLabel, transcript);

  return (
    <section className={`voice-orb voice-orb-${voiceState}`}>
      <div className="voice-orb-ring" aria-hidden="true">
        <div className="voice-orb-core" />
      </div>

      <div className="voice-orb-copy">
        <p className="eyebrow">Jarvis</p>
        <h1>{stateLabel}</h1>
        <p>{detailText}</p>
      </div>
    </section>
  );
}
