import { contextBridge, ipcRenderer } from "electron";

const jarvisDesktop = {
  showOverlay: () => ipcRenderer.invoke("jarvis:show-overlay"),
  hideOverlay: () => ipcRenderer.invoke("jarvis:hide-overlay")
};

contextBridge.exposeInMainWorld("jarvisDesktop", jarvisDesktop);
