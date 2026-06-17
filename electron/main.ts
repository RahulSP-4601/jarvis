import { app, BrowserWindow, globalShortcut, ipcMain, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;

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

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    app.dock.hide();
  }

  app.setLoginItemSettings({
    openAtLogin: true
  });

  const overlayWindow = createOverlayWindow();
  registerShortcuts(overlayWindow);

  ipcMain.handle("jarvis:show-overlay", () => {
    overlayWindow.show();
    overlayWindow.focus();
  });

  ipcMain.handle("jarvis:hide-overlay", () => {
    overlayWindow.hide();
  });

  overlayWindow.once("ready-to-show", () => {
    overlayWindow.hide();
  });
});

app.on("window-all-closed", () => {
  return;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
