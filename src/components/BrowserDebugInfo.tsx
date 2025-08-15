import { useEffect } from "react";

export default function BrowserDebugInfo() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nav = navigator as any;

    const has = (k: string) => typeof (window as any)[k] !== "undefined";
    const hasNav = (k: string) => typeof nav?.[k] !== "undefined";

    // WebGL renderer/vendor (fingerprinting light)
    const getWebGLInfo = () => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) return { webgl: false };
        const dbg = (gl as any).getExtension("WEBGL_debug_renderer_info");
        return {
          webgl: true,
          webglVendor: dbg ? (gl as any).getParameter(dbg.UNMASKED_VENDOR_WEBGL) : "hidden",
          webglRenderer: dbg ? (gl as any).getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "hidden",
        };
      } catch {
        return { webgl: false };
      }
    };

    const net = nav.connection || nav.mozConnection || nav.webkitConnection;

    const info = {
      // Identité technique du navigateur / device
      userAgent: nav.userAgent,
      platform: nav.platform,
      hardwareConcurrency: nav.hardwareConcurrency,       // nb de cœurs logiques
      deviceMemory: nav.deviceMemory,                      // Go (approx.)
      doNotTrack: nav.doNotTrack ?? nav.msDoNotTrack ?? (window as any).doNotTrack,

      // Langue & fuseau
      languages: nav.languages,
      timeZone: tz,

      // Écran & rendu
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        devicePixelRatio: window.devicePixelRatio,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      },

      // Capacités & stockage
      features: {
        cookiesEnabled: nav.cookieEnabled,
        localStorage: (() => { try { localStorage.setItem("_t","1"); localStorage.removeItem("_t"); return true; } catch { return false; } })(),
        sessionStorage: (() => { try { sessionStorage.setItem("_t","1"); sessionStorage.removeItem("_t"); return true; } catch { return false; } })(),
        serviceWorker: hasNav("serviceWorker"),
        webRTC: has("RTCPeerConnection"),
        webSocket: has("WebSocket"),
        webGPU: has("navigator") && !!(nav.gpu),
        webGL: getWebGLInfo(),
        touchSupport: "ontouchstart" in window || nav.maxTouchPoints > 0,
      },

      // Préférences UI
      prefers: {
        colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light",
        reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "reduce" : "no-preference",
      },

      // Réseau (indicatif)
      network: net ? {
        effectiveType: net.effectiveType,  // ex: '4g'
        downlinkMbps: net.downlink,        // estimation
        rttMs: net.rtt,
        saveData: net.saveData,
        type: net.type
      } : "n/a",

      // Navigation
      referrer: document.referrer || "direct",
      pageVisibility: document.visibilityState,
    };

    console.groupCollapsed("%cVisitor info (sans consentement)", "font-weight:600");
    console.log("🌐 Identité navigateur / device");
    console.table({
      userAgent: info.userAgent,
      platform: info.platform,
      cores: info.hardwareConcurrency,
      deviceMemory_GB: info.deviceMemory,
      doNotTrack: info.doNotTrack,
      timeZone: info.timeZone,
      languages: (info.languages || []).join(", "),
    });

    console.log("🖥️ Écran & viewport");
    console.table(info.screen);

    console.log("⚙️ Capacités & stockage");
    console.table({
      cookiesEnabled: info.features.cookiesEnabled,
      localStorage: info.features.localStorage,
      sessionStorage: info.features.sessionStorage,
      serviceWorker: info.features.serviceWorker,
      webRTC: info.features.webRTC,
      webSocket: info.features.webSocket,
      webGPU: info.features.webGPU,
      touchSupport: info.features.touchSupport,
      webgl: (info.features.webGL as any).webgl,
      webglVendor: (info.features.webGL as any).webglVendor,
      webglRenderer: (info.features.webGL as any).webglRenderer,
    });

    console.log("🎨 Préférences UI");
    console.table(info.prefers);

    console.log("📶 Réseau (indicatif)");
    console.table(info.network);

    console.log("🔗 Navigation");
    console.table({ referrer: info.referrer, pageVisibility: info.pageVisibility });

    console.groupEnd();
  }, []);

  return null; // composant muet
}
