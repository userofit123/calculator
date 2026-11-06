// What the Calculator page can ask of the desktop app. Kept tiny on purpose: the page runs sandboxed and gets no Node.
import { contextBridge, ipcRenderer } from "electron";

// the web app skips its service worker when this is set (apps/web/src/main.ts): the app carries its own files
contextBridge.exposeInMainWorld("calcDesktop", true);
// core/theme.ts calls this whenever the look changes; the window takes the background colour (and opens in it next time)
contextBridge.exposeInMainWorld("calcApp", {
  setBars: (bg: string) => { if (typeof bg === "string") ipcRenderer.send("look:bg", bg); },
});
// in-app updates (Settings → Updates): the main process makes the requests, the page only asks and shows
let onProgress: ((share: number) => void) | null = null;
ipcRenderer.on("update:progress", (_e, p: number) => onProgress?.(p));
contextBridge.exposeInMainWorld("calcUpdate", {
  version: () => ipcRenderer.invoke("update:version"),
  mode: () => ipcRenderer.invoke("update:mode"),
  latest: () => ipcRenderer.invoke("update:latest"),
  download: (version: string) => ipcRenderer.invoke("update:download", String(version)),
  onProgress: (cb: (share: number) => void) => { onProgress = typeof cb === "function" ? cb : null; },
  install: () => ipcRenderer.invoke("update:install"),
});
