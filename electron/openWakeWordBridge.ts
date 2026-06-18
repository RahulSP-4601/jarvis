import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export type WakeCommand = "force_capture" | "reset_wake";

export type WakeEvent =
  | { type: "wake" }
  | { type: "utterance"; path: string }
  | { type: "error"; message: string };

type BridgeOptions = {
  command: string;
  args: string[];
  onEvent: (event: WakeEvent) => void;
};

export class OpenWakeWordBridge {
  private readonly options: BridgeOptions;
  private child: ChildProcessWithoutNullStreams | null = null;

  constructor(options: BridgeOptions) {
    this.options = options;
  }

  async start() {
    if (this.child) {
      return;
    }

    this.child = spawn(this.options.command, this.options.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.attachStreams(this.child);
    await this.waitForSpawn(this.child);
  }

  async stop() {
    if (!this.child) {
      return;
    }

    const child = this.child;
    this.child = null;
    this.send({ command: "stop" });
    child.kill();
    await onceExit(child);
  }

  sendCommand(command: WakeCommand) {
    this.send({ command });
  }

  private attachStreams(child: ChildProcessWithoutNullStreams) {
    createInterface({ input: child.stdout }).on("line", (line) => {
      this.forwardStdout(line);
    });

    createInterface({ input: child.stderr }).on("line", (line) => {
      this.options.onEvent({ type: "error", message: line });
    });
  }

  private forwardStdout(line: string) {
    try {
      const event = JSON.parse(line) as WakeEvent;
      this.options.onEvent(event);
    } catch {
      this.options.onEvent({ type: "error", message: line });
    }
  }

  private send(payload: Record<string, string>) {
    if (!this.child || this.child.killed) {
      return;
    }

    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private waitForSpawn(child: ChildProcessWithoutNullStreams) {
    return new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", (error) => reject(error));
    });
  }
}

function onceExit(child: ChildProcessWithoutNullStreams) {
  return new Promise<void>((resolve) => {
    const finish = () => resolve();
    child.once("close", finish);
    child.once("exit", finish);
  });
}
