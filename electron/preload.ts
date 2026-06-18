import { contextBridge, ipcRenderer } from "electron";

const jarvisDesktop = {
  showOverlay: () => ipcRenderer.invoke("jarvis:show-overlay"),
  hideOverlay: () => ipcRenderer.invoke("jarvis:hide-overlay"),
  getBootstrapState: () => ipcRenderer.invoke("jarvis:get-bootstrap-state"),
  requestMicrophoneAccess: () => ipcRenderer.invoke("jarvis:request-microphone-access"),
  openMicrophoneSettings: () => ipcRenderer.invoke("jarvis:open-microphone-settings"),
  markSetupComplete: () => ipcRenderer.invoke("jarvis:mark-setup-complete"),
  resetSetup: () => ipcRenderer.invoke("jarvis:reset-setup")
};

contextBridge.exposeInMainWorld("jarvisDesktop", jarvisDesktop);
