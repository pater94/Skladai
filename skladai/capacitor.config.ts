import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skladai.app",
  appName: "SkładAI",
  webDir: "www",
  server: {
    // Hybrid mode — native shell loads web content from Vercel
    url: "https://skladai.vercel.app",
    cleartext: true,
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
