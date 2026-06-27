"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (production only) so the app is installable
 * and shows an offline fallback. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failure is non-fatal; the app still works online.
      });
    };
    // On a fast load the window 'load' event may have already fired before
    // this effect runs, so register immediately in that case.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
