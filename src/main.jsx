import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles.css";
import App from "./App.jsx";

class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{padding: 32, fontFamily: "system-ui", background: "#fff", minHeight: "100vh"}}>
        <h2 style={{color: "#d32f2f"}}>RiderPro could not load</h2>
        <p>{this.state.error?.message || "Unknown application error"}</p>
        <pre style={{whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 16, borderRadius: 8}}>{this.state.error?.stack || ""}</pre>
        <button onClick={() => { localStorage.clear(); location.reload(); }} style={{padding: "10px 16px"}}>Reset local app data</button>
      </div>;
    }
    return this.props.children;
  }
}

function showFatalError(error) {
  console.error("RiderPro fatal error:", error);
  const root = document.getElementById("root");
  if (!root || root.hasChildNodes()) return;
  root.innerHTML = `<div style="padding:32px;font-family:system-ui;background:#fff;min-height:100vh"><h2 style="color:#d32f2f">RiderPro failed to start</h2><p>${String(error?.message || error || "Unknown error")}</p><p>Check the terminal and browser console for the exact error.</p></div>`;
}
window.addEventListener("error", e => showFatalError(e.error || e.message));
window.addEventListener("unhandledrejection", e => showFatalError(e.reason));

// Service workers from older versions can cache a blank/stale app during development.
// Disable them on localhost and remove old caches. Register only in production builds.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { console.warn("Service worker cleanup skipped:", e); }
  });
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js?v=4").catch(console.error));
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </HashRouter>
  </React.StrictMode>
);
