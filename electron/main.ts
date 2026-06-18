import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  shell,
  systemPreferences
} from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const setupStateFile = path.join(app.getPath("userData"), "jarvis-state.json");
const overlayInset = 24;

type SetupState = {
  setupComplete: boolean;
};

type SurfaceMode = "setup" | "orb" | "overlay";

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

function getSurfaceSize(surface: SurfaceMode) {
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

function getSurfaceBounds(surface: SurfaceMode) {
  const { width, height } = getSurfaceSize(surface);
  const workArea = getWorkArea();
  const x = workArea.x + workArea.width - width - overlayInset;
  const y = surface === "orb" ? workArea.y + overlayInset : workArea.y + overlayInset;

  return { x, y, width, height };
}

function createOverlayWindow() {
  const { x, y, width, height } = getSurfaceBounds("setup");
  const window = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  window.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  });

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

function showSurface(window: BrowserWindow, surface: SurfaceMode) {
  const bounds = getSurfaceBounds(surface);
  window.setBounds(bounds);
  window.showInactive();
  window.setAlwaysOnTop(true, "floating");
  window.focus();
}

function registerShortcuts(window: BrowserWindow) {
  globalShortcut.register("CommandOrControl+Shift+J", () => {
    if (window.isVisible()) {
      window.hide();
      return;
    }

    window.show();
    window.focus();
  });
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

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock.hide();
  }

  app.setLoginItemSettings({
    openAtLogin: true
  });

  const overlayWindow = createOverlayWindow();
  const setupState = readSetupState();
  registerShortcuts(overlayWindow);

  ipcMain.handle("jarvis:show-overlay", () => {
    showSurface(overlayWindow, "overlay");
  });

  ipcMain.handle("jarvis:show-orb", () => {
    showSurface(overlayWindow, "orb");
  });

  ipcMain.handle("jarvis:hide-surface", () => {
    overlayWindow.hide();
  });

  ipcMain.handle("jarvis:get-bootstrap-state", () => {
    return {
      setupComplete: readSetupState().setupComplete,
      microphoneStatus: getMicrophoneStatus()
    };
  });

  ipcMain.handle("jarvis:request-microphone-access", async () => {
    if (process.platform !== "darwin") {
      return true;
    }

    return systemPreferences.askForMediaAccess("microphone");
  });

  ipcMain.handle("jarvis:open-microphone-settings", () => {
    openMicrophoneSettings();
  });

  ipcMain.handle("jarvis:mark-setup-complete", () => {
    writeSetupState({ setupComplete: true });
    overlayWindow.hide();
  });

  ipcMain.handle("jarvis:reset-setup", () => {
    writeSetupState({ setupComplete: false });
    overlayWindow.show();
    overlayWindow.focus();
  });

  overlayWindow.once("ready-to-show", () => {
    if (setupState.setupComplete) {
      overlayWindow.hide();
      return;
    }

    showSurface(overlayWindow, "setup");
  });
});

app.on("window-all-closed", () => {
  return;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
