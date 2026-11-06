// What the Calculator page can ask of the desktop app. Kept tiny on purpose: the page runs sandboxed and gets no Node.
import { contextBridge, ipcRenderer } from "electron";

// the web app skips its service worker when this is set (apps/web/src/main.ts): the app carries its own files
contextBridge.exposeInMainWorld("calcDesktop", true);
// core/theme.ts calls this whenever the look changes; the window takes the background colour (and opens in it next time)
contextBridge.exposeInMainWorld("calcApp", {
  setBars: (bg: string) => { if (typeof bg === "string") ipcRenderer.send("look:bg", bg); },
});
