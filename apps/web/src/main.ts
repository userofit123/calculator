import { createApp } from "vue";
import App from "./App.vue";
import { startTheme } from "./core/theme";
import { startSegSlide } from "./core/segSlide";
import { loaders } from "./shell/nav";
import "./styles/index.css";

startTheme();
createApp(App).mount("#app");
// every row of tabs gets its gliding highlight without any code in the pages
startSegSlide();

// The service worker makes the web app installable and able to open offline. Only for the built app: in development
// it would only get in the way. The desktop and Android apps carry their own files, so they don't need it.
const g = globalThis as { Capacitor?: { isNativePlatform?: () => boolean }; calcDesktop?: unknown };
if (import.meta.env.PROD && "serviceWorker" in navigator && !g.Capacitor?.isNativePlatform?.() && !g.calcDesktop) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { /* not installable here, nothing else changes */ }));
  // Once the calculator is up, fetch the other pages' code (so they open offline too), then hand the worker the list of
  // everything loaded: on the very first visit those files came before it was looking after the page.
  addEventListener("load", () => setTimeout(async () => {
    await Promise.allSettled([...Object.values(loaders).map((l) => l()), import("./shell/AppearancePanel.vue")]);
    const sw = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((ok) => setTimeout(() => ok(null), 10_000))]);
    const files = performance.getEntriesByType("resource").map((e) => new URL(e.name)).filter((u) => u.origin === location.origin).map((u) => u.pathname);
    sw?.active?.postMessage({ keep: ["/", ...new Set(files)] });
  }, 2000));
}
