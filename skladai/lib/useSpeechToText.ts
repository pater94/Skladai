"use client";

/**
 * useSpeechToText — shared hook for Web Speech API / SpeechRecognition.
 *
 * Used by:
 *   - components/AgentChat.tsx  (chat input mic)
 *   - app/page.tsx               (food scanner search mic)
 *
 * The hook wraps webkitSpeechRecognition / SpeechRecognition, does the
 * "is this actually available?" check once, and surfaces Polish-language
 * error strings so callers don't have to know anything about the
 * underlying codes. It deliberately does NOT manage any UI — no modal,
 * no animations — just state + start/stop controls.
 *
 * Callers render their own mic button and listen to the `transcript`
 * state. Each `startRecording()` resets the transcript to an empty string,
 * so if a caller wants to append to existing text it should snapshot that
 * text itself before starting.
 *
 * NOTE on Capacitor fallback: `@capacitor-community/speech-recognition` is
 * installed and wired into the native projects but NOT invoked here yet.
 * Web Speech API works inside WKWebView on iOS 16+ / modern Android
 * WebViews for all the devices SkładAI currently targets, so a native
 * bridge would only be needed if we find a device where SpeechRecognition
 * is unexpectedly missing. When that day comes, drop a native-platform
 * branch into `startRecording` and bridge its events to the same
 * setTranscript / setError state — the external contract doesn't change.
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ── Web Speech API type declarations (mirrors VoiceLog.tsx) ──
interface SpeechRecognitionEventShape extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEventShape extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventShape) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventShape) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const W = window as any;
  return W.SpeechRecognition || W.webkitSpeechRecognition || null;
}

export interface UseSpeechToTextOptions {
  /** BCP-47 language tag. Defaults to "pl-PL" (this is a Polish-first app). */
  lang?: string;
  /** Keep listening after each utterance. Defaults to true. */
  continuous?: boolean;
  /** Emit interim (non-final) guesses so the UI can update live. Defaults to true. */
  interimResults?: boolean;
}

export interface UseSpeechToTextResult {
  /** True while the mic is actively listening. */
  isRecording: boolean;
  /** Begin a new recording session. Clears `transcript` and `error`. */
  startRecording: () => void;
  /** Stop the current recording. No-op if not recording. */
  stopRecording: () => void;
  /** Live transcript (finals + interim). Resets on each startRecording(). */
  transcript: string;
  /** Human-readable Polish error string, or null. */
  error: string | null;
  /** True if the browser/WebView exposes SpeechRecognition. Check before rendering the mic button. */
  isSupported: boolean;
  /** Manually clear the transcript without touching recording state. */
  resetTranscript: () => void;
  /** Manually clear the error (e.g. when the user dismisses the toast). */
  resetError: () => void;
}

export function useSpeechToText(options: UseSpeechToTextOptions = {}): UseSpeechToTextResult {
  const { lang = "pl-PL", continuous = true, interimResults = true } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef("");

  // One-shot support check. Runs only on the client — window is undefined
  // during SSR, so we can't use a lazy useState initializer (that would
  // capture `false` on the server and keep it after hydration, never
  // flipping to `true`). The effect fires once after hydration and is
  // the standard hydration-safe pattern for "is this browser feature
  // present?". The lint rule below is for cascading-render scenarios,
  // which doesn't apply to a single-shot detection.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSupported(getSpeechRecognition() !== null);
  }, []);

  // Safety net: abort any live recognition when the owning component
  // unmounts, otherwise iOS keeps the mic indicator lit in the status bar.
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* noop */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    finalRef.current = "";
  }, []);

  const resetError = useCallback(() => setError(null), []);

  const startRecording = useCallback(() => {
    setError(null);
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
      return;
    }

    // Each new session starts with a clean slate. Callers that want to
    // append to existing text should snapshot it before calling us.
    setTranscript("");
    finalRef.current = "";

    let recognition: SpeechRecognitionInstance;
    try {
      recognition = new SR();
    } catch {
      setError("Nie udało się uruchomić rozpoznawania mowy.");
      return;
    }

    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventShape) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalRef.current += t + " ";
        } else {
          interim += t;
        }
      }
      // Collapse whitespace so the caller can drop this straight into an
      // <input>. Trailing space is preserved on purpose so interim text
      // doesn't visibly "snap" when finalised.
      setTranscript(
        (finalRef.current + interim).replace(/\s+/g, " ").trimStart()
      );
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventShape) => {
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isIOS) {
          setError("Zezwól na dostęp do mikrofonu w Ustawieniach → SkładAI.");
        } else if (isAndroid) {
          setError("Brak uprawnień do mikrofonu. Zezwól w ustawieniach aplikacji.");
        } else {
          setError("Brak uprawnień do mikrofonu.");
        }
      } else if (code === "no-speech") {
        setError("Nie wykryto mowy. Kliknij mikrofon i mów wyraźnie.");
      } else if (code === "aborted") {
        // User cancelled, or we stopped programmatically — no toast.
      } else if (code === "network") {
        setError("Brak połączenia. Rozpoznawanie mowy wymaga internetu.");
      } else {
        setError("Wystąpił problem z rozpoznawaniem mowy.");
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      // Drop interim — leave only confirmed finals.
      setTranscript(finalRef.current.replace(/\s+/g, " ").trim());
      setIsRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch {
      setError("Nie udało się uruchomić mikrofonu.");
      setIsRecording(false);
    }
  }, [lang, continuous, interimResults]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    error,
    isSupported,
    resetTranscript,
    resetError,
  };
}
