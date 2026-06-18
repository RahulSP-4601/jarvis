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

type SetupState = {
  setupComplete: boolean;
};

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

function getOverlaySize() {
  const width = Number(process.env.JARVIS_OVERLAY_WIDTH || 460);
  const height = Number(process.env.JARVIS_OVERLAY_HEIGHT || 720);

  return { width, height };
}

function getOverlayPosition(width: number) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { workArea } = primaryDisplay;
  const x = workArea.x + workArea.width - width - 24;
  const y = workArea.y + 24;

  return { x, y };
}

function createOverlayWindow() {
  const { width, height } = getOverlaySize();
  const { x, y } = getOverlayPosition(width);
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
    overlayWindow.show();
    overlayWindow.focus();
  });

  ipcMain.handle("jarvis:hide-overlay", () => {
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
    overlayWindow.show();
    overlayWindow.focus();
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

    overlayWindow.show();
    overlayWindow.focus();
  });
});

app.on("window-all-closed", () => {
  return;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
