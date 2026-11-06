import { createApp } from "vue";
import App from "./App.vue";
import { startTheme } from "./core/theme";
import { startSegSlide } from "./core/segSlide";
import { startReloadOnMissingFiles, startUpdates } from "./core/update";
import { installAndroidBridge } from "./native/android";
import "./styles/index.css";

// before the theme starts, so the Android app's bars get the first look too
installAndroidBridge();

startTheme();
startReloadOnMissingFiles();
createApp(App).mount("#app");
// every row of tabs gets its gliding highlight without any code in the pages
startSegSlide();

// The service worker keeps the whole app on the device (every built file, from the first open on), so it works with no
// connection. Only for the built app: in development it would only get in the way. The desktop and Android apps carry
// their own files, so they don't need it. updateViaCache "none" (in startUpdates): sw.js itself is always checked with
// the server, so a new version is noticed on the next open. The worker sits in the app's folder (BASE_URL: "/", or
// "/calculator/" on GitHub Pages), so its scope is exactly the app.
const g = globalThis as { Capacitor?: { isNativePlatform?: () => boolean }; calcDesktop?: unknown };
if (import.meta.env.PROD && "serviceWorker" in navigator && !g.Capacitor?.isNativePlatform?.() && !g.calcDesktop) startUpdates(import.meta.env.BASE_URL + "sw.js");
