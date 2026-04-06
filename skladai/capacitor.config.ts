import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skladai.app",
  appName: "SkładAI",
  webDir: "www",
  server: {
    // Hybrid mode — native shell loads web content from Vercel
    url: "https://skladai.vercel.app",
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
