import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  shell,
  systemPreferences
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AssistantRuntime, type SurfaceMode } from "./assistantRuntime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const isDev = !app.isPackaged;
const setupStateFile = path.join(app.getPath("userData"), "jarvis-state.json");
const overlayInset = 24;
const authProtocol = "jarvis";
let isQuitting = false;
let pendingAuthCallbackUrl: string | null = null;

type SetupState = {
  setupComplete: boolean;
};

type PresentationMode = "setup" | "background";

if (!hasSingleInstanceLock) {
  app.quit();
}

if (app.isPackaged) {
  app.setAsDefaultProtocolClient(authProtocol);
}

function readSetupState(): SetupState {
  try {
    const payload = fs.readFileSync(setupStateFile, "utf8");
    return JSON.parse(payload) as SetupState;
  } catch {
    return { setupComplete: false };
  }
}

function writeSetupState(nextState: SetupState) {
  fs.mkdirSync(path.dirname(setupStateFile), { recursive: true });
  fs.writeFileSync(setupStateFile, JSON.stringify(nextState, null, 2), "utf8");
}

function getWorkArea() {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.workArea;
}

function getSurfaceSize(surface: SurfaceMode | "setup") {
  if (surface === "orb") {
    return {
      width: Number(process.env.JARVIS_ORB_WIDTH || 420),
      height: Number(process.env.JARVIS_ORB_HEIGHT || 168)
    };
  }

  if (surface === "setup") {
    return {
      width: Number(process.env.JARVIS_SETUP_WIDTH || 520),
      height: Number(process.env.JARVIS_SETUP_HEIGHT || 640)
    };
  }

  return {
    width: Number(process.env.JARVIS_OVERLAY_WIDTH || 500),
    height: Number(process.env.JARVIS_OVERLAY_HEIGHT || 760)
  };
}

function getSurfaceBounds(surface: SurfaceMode | "setup") {
  const { width, height } = getSurfaceSize(surface);
  const workArea = getWorkArea();
  return {
    x: workArea.x + workArea.width - width - overlayInset,
    y: workArea.y + overlayInset,
    width,
    height
  };
}

function createAssistantWindow(setupComplete: boolean) {
  const bounds = getSurfaceBounds("setup");
  const window = new BrowserWindow({
    ...bounds,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: setupComplete,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void window.loadURL(rendererUrl);
  } else if (isDev) {
    void window.loadURL("http://localhost:5173");
  } else {
    void window.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  return window;
}

function applyPresentationMode(window: BrowserWindow, mode: PresentationMode) {
  window.setSkipTaskbar(mode === "background");

  if (process.platform !== "darwin") {
    return;
  }

  if (mode === "setup") {
    app.dock.show();
    return;
  }

  app.dock.hide();
}

function showSurface(
  window: BrowserWindow,
  surface: SurfaceMode | "setup",
  presentationMode: PresentationMode
) {
  window.setBounds(getSurfaceBounds(surface));
  applyPresentationMode(window, presentationMode);

  if (presentationMode === "setup") {
    window.show();
  } else {
    window.showInactive();
  }

  window.setAlwaysOnTop(true, "floating");
  window.focus();
}

function getMicrophoneStatus() {
  if (process.platform !== "darwin") {
    return "unknown";
  }

  return systemPreferences.getMediaAccessStatus("microphone");
}

function openMicrophoneSettings() {
  if (process.platform === "darwin") {
    void shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
    );
    return;
  }

  if (process.platform === "win32") {
    void shell.openExternal("ms-settings:privacy-microphone");
  }
}

function syncLoginItemSettings(setupComplete: boolean) {
  app.setLoginItemSettings({ openAtLogin: setupComplete });
}

function maybeExtractAuthCallback(argument: string) {
  if (!argument.startsWith(`${authProtocol}://`)) {
    return null;
  }

  return argument;
}

function resolveApiBaseUrl() {
  return process.env.JARVIS_API_BASE_URL || process.env.VITE_JARVIS_API_BASE_URL || "http://localhost:8080";
}

function resolveWakeDaemonScriptPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "scripts", "openwakeword_daemon.py");
  }

  return path.join(process.cwd(), "scripts", "openwakeword_daemon.py");
}

function resolvePackagedWakeExecutablePath() {
  const executableName = process.platform === "win32" ? "jarvis-wake.exe" : "jarvis-wake";
  return path.join(process.resourcesPath, "wake", executableName);
}

function resolveWakeLaunch() {
  if (app.isPackaged) {
    return {
      command: resolvePackagedWakeExecutablePath(),
      args: []
    };
  }

  const pythonBin = process.env.OPENWAKEWORD_PYTHON_BIN || "python3";
  return {
    command: pythonBin,
    args: [resolveWakeDaemonScriptPath()]
  };
}

function registerShortcuts(window: BrowserWindow, runtime: AssistantRuntime) {
  globalShortcut.register("CommandOrControl+Shift+J", () => {
    if (window.isVisible()) {
      runtime.hideSurface();
      window.hide();
      return;
    }

    showSurface(window, "overlay", "background");
  });

  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!readSetupState().setupComplete) {
      showSurface(window, "setup", "setup");
      return;
    }

    void runtime.activateListening();
  });
}

app.whenReady().then(() => {
  const initialSetupState = readSetupState();
  syncLoginItemSettings(initialSetupState.setupComplete);

  const assistantWindow = createAssistantWindow(initialSetupState.setupComplete);
  applyPresentationMode(
    assistantWindow,
    initialSetupState.setupComplete ? "background" : "setup"
  );
  const wakeLaunch = resolveWakeLaunch();
  const runtime = new AssistantRuntime(
    assistantWindow,
    {
      apiBaseUrl: resolveApiBaseUrl(),
      nativeWakeProvider: process.env.JARVIS_WAKE_PROVIDER || "openwakeword",
      wakeLaunchCommand: wakeLaunch.command,
      wakeLaunchArgs: wakeLaunch.args
    },
    (surface) => {
      if (surface === "hidden") {
        assistantWindow.hide();
        return;
      }

      showSurface(assistantWindow, surface, "background");
    }
  );

  registerShortcuts(assistantWindow, runtime);
  void runtime.setSetupComplete(initialSetupState.setupComplete);

  app.on("second-instance", (_event, argv) => {
    const authCallbackUrl = argv.find((value) => value.startsWith(`${authProtocol}://`));
    if (authCallbackUrl) {
      pendingAuthCallbackUrl = authCallbackUrl;
      assistantWindow.webContents.send("jarvis:auth-callback", authCallbackUrl);
    }

    if (!readSetupState().setupComplete) {
      showSurface(assistantWindow, "setup", "setup");
      return;
    }

    showSurface(assistantWindow, "orb", "background");
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    pendingAuthCallbackUrl = url;
    assistantWindow.webContents.send("jarvis:auth-callback", url);
  });

  app.on("activate", () => {
    if (!readSetupState().setupComplete) {
      showSurface(assistantWindow, "setup", "setup");
    }
  });

  assistantWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    assistantWindow.hide();
  });

  ipcMain.handle("jarvis:show-overlay", () => {
    showSurface(assistantWindow, "overlay", "background");
  });

  ipcMain.handle("jarvis:show-orb", () => {
    showSurface(assistantWindow, "orb", "background");
  });

  ipcMain.handle("jarvis:hide-surface", () => {
    runtime.hideSurface();
  });

  ipcMain.handle("jarvis:get-bootstrap-state", () => ({
    setupComplete: readSetupState().setupComplete,
    microphoneStatus: getMicrophoneStatus(),
    assistantState: runtime.getState()
  }));

  ipcMain.handle("jarvis:request-microphone-access", async () => {
    if (process.platform !== "darwin") {
      return true;
    }

    return systemPreferences.askForMediaAccess("microphone");
  });

  ipcMain.handle("jarvis:open-microphone-settings", () => {
    openMicrophoneSettings();
  });

  ipcMain.handle("jarvis:open-external-url", (_event, url: string) => {
    return shell.openExternal(url);
  });

  ipcMain.handle("jarvis:get-auth-callback", () => {
    const callbackUrl = pendingAuthCallbackUrl;
    pendingAuthCallbackUrl = null;
    return callbackUrl;
  });

  ipcMain.handle("jarvis:mark-setup-complete", async () => {
    writeSetupState({ setupComplete: true });
    syncLoginItemSettings(true);
    applyPresentationMode(assistantWindow, "background");
    assistantWindow.hide();
    await runtime.setSetupComplete(true);
  });

  ipcMain.handle("jarvis:reset-setup", async () => {
    writeSetupState({ setupComplete: false });
    syncLoginItemSettings(false);
    applyPresentationMode(assistantWindow, "setup");
    await runtime.setSetupComplete(false);
    showSurface(assistantWindow, "setup", "setup");
  });

  ipcMain.handle("jarvis:activate-listening", async () => {
    await runtime.activateListening();
  });

  ipcMain.handle(
    "jarvis:update-runtime-config",
    async (
      _event,
      payload: {
        apiBaseUrl?: string;
      }
    ) => {
      await runtime.updateRuntimeConfig({
        apiBaseUrl: payload.apiBaseUrl || ""
      });
    }
  );

  ipcMain.handle("jarvis:notify-speech-finished", (_event, speechRequestId: number) => {
    runtime.notifySpeechFinished(speechRequestId);
  });

  assistantWindow.once("ready-to-show", () => {
    const argvCallback = process.argv.find(maybeExtractAuthCallback);
    if (argvCallback) {
      pendingAuthCallbackUrl = argvCallback;
      assistantWindow.webContents.send("jarvis:auth-callback", argvCallback);
    }

    if (readSetupState().setupComplete) {
      applyPresentationMode(assistantWindow, "background");
      assistantWindow.hide();
      return;
    }

    showSurface(assistantWindow, "setup", "setup");
  });

  assistantWindow.webContents.on("did-finish-load", () => {
    if (!readSetupState().setupComplete && !assistantWindow.isVisible()) {
      showSurface(assistantWindow, "setup", "setup");
    }
  });

  assistantWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error("Jarvis renderer failed to load", {
        errorCode,
        errorDescription,
        validatedURL
      });
      applyPresentationMode(assistantWindow, "setup");
      dialog.showErrorBox(
        "Jarvis failed to load",
        `The Jarvis interface could not start.\n\n${errorDescription} (${errorCode})\n${validatedURL}`
      );
    }
  );
});

app.on("window-all-closed", () => {
  return;
});

app.on("will-quit", () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});
