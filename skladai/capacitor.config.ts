import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skladai.app",
  appName: "SkładAI",
  webDir: "www",
  server: {
    // Hybrid mode — native shell loads web content from the custom domain
    url: "https://skladai.com",
    cleartext: true,
    // Pin the WebView's effective Origin to skladai.com on iOS and
    // Android. Without these three fields Capacitor falls back to its
    // internal capacitor://localhost / http://localhost origins for
    // anything not explicitly hit via server.url, which can fight with
    // Supabase auth cookies and session storage across cold reopens.
    //   - hostname: sets the Origin used for internal schemes.
    //   - iosScheme: "https" makes iOS WKWebView treat internal
    //     resources as same-origin with https://skladai.com
    //     (critical for cookies / CORS).
    //   - androidScheme: same on Android.
    hostname: "skladai.com",
    iosScheme: "https",
    androidScheme: "https",
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
