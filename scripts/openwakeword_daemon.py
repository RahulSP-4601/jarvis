import json
import queue
import sys
import tempfile
import threading
import time
import wave

import numpy as np
import sounddevice as sd
from openwakeword.model import Model

SAMPLE_RATE = 16000
BLOCK_SIZE = 1280
WAKE_THRESHOLD = 0.45
SPEECH_THRESHOLD = 1100
START_TIMEOUT_SECONDS = 5
MAX_CAPTURE_SECONDS = 20
SILENCE_SECONDS = 1.2


def emit(payload):
    print(json.dumps(payload), flush=True)


def peak_amplitude(samples):
    return int(np.max(np.abs(samples))) if samples.size else 0


def command_reader(command_queue):
    for line in sys.stdin:
        payload = line.strip()
        if not payload:
            continue
        try:
            command_queue.put(json.loads(payload))
        except json.JSONDecodeError:
            emit({"type": "error", "message": f"Invalid command: {payload}"})


def write_wav(samples):
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    with wave.open(handle, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(samples.tobytes())
    return handle.name


def start_capture(state, emit_wake):
    state["mode"] = "capture"
    state["frames"] = []
    state["capture_started_at"] = time.time()
    state["last_speech_at"] = 0
    if emit_wake:
        emit({"type": "wake"})


def reset_wake(state):
    state["mode"] = "wake"
    state["frames"] = []
    state["last_speech_at"] = 0


def apply_command(state, command):
    name = command.get("command", "")
    if name == "force_capture":
        start_capture(state, False)
    elif name == "reset_wake":
        reset_wake(state)


def should_finish_capture(state, now):
    if now - state["capture_started_at"] >= MAX_CAPTURE_SECONDS:
        return True
    if state["last_speech_at"] == 0:
        return False
    return now - state["last_speech_at"] >= SILENCE_SECONDS


def flush_capture(state):
    merged = np.concatenate(state["frames"]) if state["frames"] else np.array([], dtype=np.int16)
    reset_wake(state)
    if merged.size == 0:
        return
    emit({"type": "utterance", "path": write_wav(merged)})


def handle_capture_chunk(state, samples):
    now = time.time()
    speaking = peak_amplitude(samples) > SPEECH_THRESHOLD
    if speaking:
        state["last_speech_at"] = now
    if speaking or state["frames"]:
        state["frames"].append(samples.copy())
    if not state["frames"] and now - state["capture_started_at"] > START_TIMEOUT_SECONDS:
        reset_wake(state)
        return
    if state["frames"] and should_finish_capture(state, now):
        flush_capture(state)


def next_prediction(model, samples):
    prediction = model.predict(samples)
    return max(prediction.values()) if prediction else 0


def main():
    audio_queue = queue.Queue()
    command_queue = queue.Queue()
    threading.Thread(target=command_reader, args=(command_queue,), daemon=True).start()
    model = Model()
    state = {
        "mode": "wake",
        "frames": [],
        "capture_started_at": time.time(),
        "last_speech_at": 0,
    }

    def callback(indata, _frames, _time_info, status):
        if status:
            emit({"type": "error", "message": str(status)})
            return
        audio_queue.put(indata.copy().reshape(-1))

    with sd.InputStream(
        channels=1,
        samplerate=SAMPLE_RATE,
        dtype="int16",
        blocksize=BLOCK_SIZE,
        callback=callback,
    ):
        while True:
            while not command_queue.empty():
                command = command_queue.get()
                if command.get("command") == "stop":
                    return
                apply_command(state, command)
            samples = audio_queue.get()
            if state["mode"] == "capture":
                handle_capture_chunk(state, samples)
                continue
            if next_prediction(model, samples) >= WAKE_THRESHOLD:
                start_capture(state, True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        emit({"type": "error", "message": str(error)})
