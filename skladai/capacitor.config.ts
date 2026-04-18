import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skladai.app",
  appName: "SkładAI",
  webDir: "www",
  server: {
    // Hybrid mode — native shell loads web content from the custom domain
    url: "https://skladai.com",
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
    // Required companion to WKAppBoundDomains in Info.plist.
    //
    // WebKit behaviour (webkit.org/blog/10882/app-bound-domains/ +
    // Apple WKWebViewConfiguration docs): once an app declares
    // WKAppBoundDomains, every WKWebView it creates DEFAULTS to
    // refusing JavaScript injection, custom stylesheets, cookie
    // manipulation, and message handlers — unless the config opts
    // into app-bound mode explicitly by setting this flag to true.
    //
    // Without this flag and with WKAppBoundDomains present, the
    // Capacitor bridge cannot inject `window.Capacitor`, inline
    // <script> tags never run, and the WebView stays permanently
    // blank while Safari on the same device loads the same URL
    // fine. Symptom reproduced on iPhone 17 Pro (iOS 26.3) fresh
    // install with build 1037 and confirmed via missing POSTs to
    // /api/debug-log from Capacitor UA.
    //
    // GitHub: ionic-team/capacitor#4721 + PR #4789.
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
