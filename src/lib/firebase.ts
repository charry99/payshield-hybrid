// Firebase app initialisation for PayShield Hybrid.
//
// The Firebase web config is read from Vite environment variables
// (see .env.example). If the config is absent or incomplete, this module
// reports "not configured" and the rest of the app keeps working — the
// offline rule engine does not depend on Firebase at all.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export type FirebaseState =
  | { status: "ready"; app: FirebaseApp; config: FirebaseConfig }
  | { status: "not-configured"; missing: string[] }
  | { status: "error"; message: string };

const REQUIRED: [keyof FirebaseConfig, string][] = [
  ["apiKey", "VITE_FIREBASE_API_KEY"],
  ["authDomain", "VITE_FIREBASE_AUTH_DOMAIN"],
  ["projectId", "VITE_FIREBASE_PROJECT_ID"],
  ["storageBucket", "VITE_FIREBASE_STORAGE_BUCKET"],
  ["messagingSenderId", "VITE_FIREBASE_MESSAGING_SENDER_ID"],
  ["appId", "VITE_FIREBASE_APP_ID"],
];

function readConfig(): { config: FirebaseConfig | null; missing: string[] } {
  const env = import.meta.env;
  const config: FirebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || "",
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };
  const missing = REQUIRED.filter(([key]) => !config[key]).map(
    ([, envName]) => envName,
  );
  return { config: missing.length === 0 ? config : null, missing };
}

let cached: FirebaseState | null = null;

export function getFirebaseState(): FirebaseState {
  if (cached) return cached;

  const { config, missing } = readConfig();
  if (!config) {
    cached = { status: "not-configured", missing };
    return cached;
  }

  try {
    const app = initializeApp(config);
    initAppCheck(app);
    cached = { status: "ready", app, config };
  } catch (err) {
    cached = {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  return cached;
}

// App Check protects the Gemini API behind AI Logic. Two paths:
//
// 1. Production: VITE_RECAPTCHA_SITE_KEY is set -> reCAPTCHA v3 provider.
// 2. Local dev / hackathon demo: VITE_APPCHECK_DEBUG_TOKEN is set ->
//    assign it to self.FIREBASE_APPCHECK_DEBUG_TOKEN *before*
//    initializeAppCheck, as the App Check docs require. With the value
//    "true" the SDK generates a token and prints it in the browser
//    console; register that token in the Firebase console under
//    App Check > Apps > Manage debug tokens. A fixed UUID also works.
function initAppCheck(app: FirebaseApp): void {
  const env = import.meta.env;
  const siteKey: string = env.VITE_RECAPTCHA_SITE_KEY || "";
  const debugToken: string = env.VITE_APPCHECK_DEBUG_TOKEN || "";

  if (debugToken) {
    // Must be set before initializeAppCheck() is called.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean })
      .FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugToken === "true" ? true : debugToken;
  }

  if (!siteKey && !debugToken) {
    // No provider configured. AI Logic calls will be rejected by App
    // Check enforcement; the UI surfaces that error. We still skip
    // initialisation rather than crash the whole app.
    console.info(
      "[PayShield] App Check not configured: set VITE_RECAPTCHA_SITE_KEY " +
        "or VITE_APPCHECK_DEBUG_TOKEN (see .env.example).",
    );
    return;
  }

  try {
    initializeAppCheck(app, {
      // With the debug token global set, the SDK uses the debug provider
      // regardless of the provider passed here.
      provider: new ReCaptchaV3Provider(siteKey || "debug-token-in-use"),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("[PayShield] App Check initialisation failed:", err);
  }
}
