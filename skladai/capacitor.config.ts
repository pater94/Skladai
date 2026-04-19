import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skladai.app",
  appName: "SkładAI",
  webDir: "www",
  server: {
    // Hybrid mode — native shell loads web content from the custom domain.
    //
    // MUST be `www.skladai.com` (NOT apex `skladai.com`) because the
    // apex redirects 307 to www, and WKWebView on iOS 26 black-screens
    // on a redirect during initial server.url navigation:
    //   apex HTTP 307 → www 200 OK  →  Capacitor bridge injected at
    //   apex origin stays there, window.Capacitor is undefined at www
    //   origin after redirect, JS/native bridge misaligned, hydration
    //   crashes → blank WebView. Root cause confirmed 2026-04-18 via
    //   bisection to commit a89a6b9 (domain switch) then response
    //   header comparison.
    // Pointing directly at www skips the redirect entirely — same
    // content, same origin throughout.
    url: "https://www.skladai.com",
    cleartext: true,
    // NOTE: do NOT add allowNavigation — when set, Capacitor opens any
    // non-matching navigation in SFSafariViewController (which shows the
    // iOS Safari URL bar at the bottom). Without it, all navigation
    // happens inside the main WKWebView with no toolbar.
  },
  plugins: {
    Camera: {
      presentationStyle: "fullScreen",
    },
    StatusBar: {
      backgroundColor: "#0a0f0d",
      style: "DARK",
    },
    SplashScreen: {
      backgroundColor: "#0a0f0d",
      showSpinner: false,
      launchAutoHide: true,
      launchShowDuration: 1500,
    },
    SpeechRecognition: {
      // Will use native speech on both platforms
    },
  },
  android: {
    backgroundColor: "#0a0f0d",
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: "#0a0f0d",
    contentInset: "automatic",
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
