import { rmSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const tempRoot = path.join(root, ".tmp", "wake-runtime");
const distRoot = path.join(root, "vendor", "wake");
const isWindows = process.platform === "win32";
const pythonBin = process.env.PYTHON_BIN || process.env.OPENWAKEWORD_PYTHON_BIN || (isWindows ? "python" : "python3");
const outputName = isWindows ? "jarvis-wake.exe" : "jarvis-wake";

prepareDirectories();
runPyInstaller();

function prepareDirectories() {
  rmSync(tempRoot, { force: true, recursive: true });
  rmSync(distRoot, { force: true, recursive: true });
  mkdirSync(tempRoot, { recursive: true });
  mkdirSync(distRoot, { recursive: true });
}

function runPyInstaller() {
  const args = [
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--onefile",
    "--name",
    "jarvis-wake",
    "--distpath",
    distRoot,
    "--workpath",
    path.join(tempRoot, "build"),
    "--specpath",
    path.join(tempRoot, "spec"),
    "--collect-all",
    "openwakeword",
    "--collect-all",
    "onnxruntime",
    "--hidden-import",
    "sounddevice",
    "--hidden-import",
    "numpy",
    path.join("scripts", "openwakeword_daemon.py")
  ];

  const result = spawnSync(pythonBin, args, {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log(`Built wake runtime: ${path.join(distRoot, outputName)}`);
}
