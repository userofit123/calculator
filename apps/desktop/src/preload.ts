// What the Calculator page can ask of the desktop app. Kept tiny on purpose: the page runs sandboxed and gets no Node.
import { contextBridge, ipcRenderer } from "electron";

// the web app skips its service worker when this is set (apps/web/src/main.ts): the app carries its own files
contextBridge.exposeInMainWorld("calcDesktop", true);
// core/theme.ts calls this whenever the look changes; the window takes the background colour (and opens in it next time)
contextBridge.exposeInMainWorld("calcApp", {
  setBars: (bg: string) => { if (typeof bg === "string") ipcRenderer.send("look:bg", bg); },
});
// the window frame (main.ts, frameOptions): the page draws the title strip and tells the window its colours, so the
// window buttons on it match the look (core/theme.ts adds html.dframe when this is there). macOS keeps its own title bar.
if (process.platform !== "darwin") contextBridge.exposeInMainWorld("desktopFrame", {
  setTitleBar: (bg: string, fg: string) => ipcRenderer.send("frame:titlebar", String(bg).trim(), String(fg).trim()),
});
// in-app updates (Settings → App & updates): the main process makes the requests, the page only asks and shows
let onProgress: ((share: number) => void) | null = null;
// a share 0-1, or -1 while the size is unknown; anything else is dropped
ipcRenderer.on("update:progress", (_e, p: unknown) => { if (typeof p === "number" && Number.isFinite(p) && p >= -1 && p <= 1) onProgress?.(p); });
contextBridge.exposeInMainWorld("calcUpdate", {
  version: () => ipcRenderer.invoke("update:version"),
  mode: () => ipcRenderer.invoke("update:mode"),
  kind: () => ipcRenderer.invoke("update:kind"),
  latest: () => ipcRenderer.invoke("update:latest"),
  download: (version: string, onQuit?: boolean) => ipcRenderer.invoke("update:download", String(version), onQuit === true),
  installOnQuit: (on: boolean) => ipcRenderer.invoke("update:onQuit", on === true),
  onProgress: (cb: (share: number) => void) => { onProgress = typeof cb === "function" ? cb : null; },
  install: () => ipcRenderer.invoke("update:install"),
});
