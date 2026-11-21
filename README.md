# PayShield Hybrid

**Check a payment link before you pay it.**

PayShield Hybrid is a pay-link safety checker built for the
**#BuildHybridAI 2026** hackathon. Paste a payment link, a
payment-request message, or a crypto address, and you get two
independent judgements:

1. **A deterministic rule engine** (offline, instant, identical on
   every device) scores the input **Safe / Caution / Danger** with
   named, plain-English findings.
2. **An AI second opinion** from **Firebase AI Logic hybrid
   inference**: the prompt runs on **Gemini Nano on-device**
   (Chrome's Prompt API) when available, and **falls back to a cloud
   Gemini model** when it is not. The UI always shows which one
   answered — read straight from the response's `inferenceSource`.

The final banner combines both judgements conservatively: **the
stricter verdict always wins**.

Payment scams work because they rush people. A checker that runs
locally is private (the pasted text never has to leave the device),
works offline, and costs nothing to run — and when the small
on-device model is not available, the cloud model keeps the feature
working for everyone. That is exactly the hybrid story this app
demonstrates.

> This project merges two builds of the same idea: a Google AI Studio
> UI (React + Tailwind) and a Firebase AI Logic hybrid-inference
> implementation. The result keeps the Studio UI and rule design, and
> runs every AI call through Firebase AI Logic — there is no backend
> server and no direct Gemini API key anywhere in the app.

---

## Features

- **Three input types**: payment links, free-text payment-request
  messages, and bare crypto addresses (EVM / Bitcoin / Solana shapes).
- **Rule engine** — 18 checks, all deterministic and offline:
  - Brand lookalike detection: leetspeak swaps (`paypa1`), near-miss
    spellings (Levenshtein), brand names on wrong domains, brand
    names parked in subdomains, punycode (`xn--`) hosts.
  - Link tricks: `http://`, raw IP hosts, `@`-sign destination
    hiding, URL shorteners, risky TLDs.
  - Message patterns: seed-phrase/private-key asks, send-money-first
    (advance-fee), guaranteed returns, money doubling,
    QR-to-receive reversal scams, ID-document asks, urgency
    pressure, suspension threats, wallet-verify lures, airdrop
    lures, fake-support routing, gift-card/wire payment, secrecy
    coaching.
  - Honest address handling: a bare address is never called "safe" —
    it gets Caution with guidance, because an address string alone
    carries no reputation.
- **Hybrid AI second opinion** with:
  - A mode picker: **Hybrid (auto)**, **On-device only**, **Cloud
    only** — mapped to `InferenceMode.PREFER_ON_DEVICE`,
    `ONLY_ON_DEVICE`, and `ONLY_IN_CLOUD`.
  - An **inference-mode badge** driven by
    `result.response.inferenceSource`, so you always know whether
    Gemini Nano or cloud Gemini answered.
  - A **Hybrid privacy shortcut**: when the local rules already find
    high-confidence scam signals, Hybrid mode resolves on-device and
    the text never leaves the browser (you can still ask the AI
    explicitly with "Ask AI anyway").
  - Gemini Nano **download progress** while the on-device model is
    fetched for the first time.
  - Tolerant JSON parsing with a plain-text fallback, because small
    on-device models do not always emit perfect JSON.
- **Graceful degradation**: with no Firebase config at all, the app
  still loads and the rule engine still works; the AI panel explains
  what is missing, and On-device only mode falls back to a clearly
  labelled local-rules summary.
- **Three built-in samples** (safe / suspicious / obvious scam) for a
  one-click demo.
- **Unit tests** for the rule engine, the verdict combiner, and the
  AI-response parser (Vitest).

## How hybrid inference is used (exact SDK calls)

From the official docs:

- Get started: <https://firebase.google.com/docs/ai-logic/hybrid/web/get-started>
- Configuration options (inference modes, `inferenceSource`, fallback
  model): <https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options>

All of this lives in `src/lib/ai.ts` and `src/lib/firebase.ts`:

```ts
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
} from "firebase/ai";

const app = initializeApp(firebaseConfig);

// App Check (enforced by AI Logic) — see "App Check" below.
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(siteKey),
  isTokenAutoRefreshEnabled: true,
});

// Gemini Developer API backend.
const ai = getAI(app, { backend: new GoogleAIBackend() });

// One model per UI mode. inCloudParams only when a cloud model
// override is configured via VITE_CLOUD_MODEL.
const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE, // or ONLY_ON_DEVICE / ONLY_IN_CLOUD
  inCloudParams: { model: "gemini-2.5-flash" }, // optional
});

// Required by the docs: after/on a user gesture (our Check button
// click) and before generateContent(). The callback reports Gemini
// Nano download progress (0..1).
model.initializeDeviceModel((val) => {
  console.log(`Download progress: ${Math.round(val * 100)}%`);
});

const result = await model.generateContent(prompt);
const text = result.response.text();

// The badge in the UI: "ON_DEVICE" or "IN_CLOUD".
const source = result.response.inferenceSource;
```

Notes from the docs that shaped this implementation:

- Hybrid inference needs **Firebase JS SDK v12.5.0+** (this project
  uses the v13 line) and **Chrome 139+ on desktop** for the
  on-device path; on-device inference goes through Chrome's
  **Prompt API**.
- On-device inference supports single-turn text generation
  (streaming or not) and structured output. We ask for JSON in the
  prompt and parse tolerantly, which behaves identically on both
  paths.
- The default cloud fallback model can be overridden with
  `inCloudParams` (here: the optional `VITE_CLOUD_MODEL` env var).

## Setup

### 1. Create a Firebase project and enable AI Logic

1. In the [Firebase console](https://console.firebase.google.com),
   create a project (or add Firebase to an existing Google Cloud
   project). Google Analytics is not required.
2. Go to **AI Services → AI Logic** and click **Get started**.
3. Choose the **Gemini Developer API** provider (free to start) and
   finish the workflow. This also enforces **App Check** for
   AI Logic.
4. Register a **Web app** in the project and copy its Firebase
   config.

### 2. Configure the app

```bash
cp .env.example .env
```

Fill in `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` from
your web app's config. (Without them the app still runs — rules
only.)

### 3. App Check

AI Logic enforces App Check, so pick one path:

- **Local development / hackathon demo (debug token)**
  1. Set `VITE_APPCHECK_DEBUG_TOKEN=true` in `.env`.
  2. Run the app and open the browser console — the SDK prints
     `AppCheck debug token: "..."`.
  3. In the Firebase console: **App Check → Apps → your web app →
     Manage debug tokens**, and register that token.
  (You can also paste a fixed debug-token UUID instead of `true`.)
- **Production**: register a **reCAPTCHA v3** provider for your app
  in the App Check console and put its site key in
  `VITE_RECAPTCHA_SITE_KEY`.

### 4. Set up Chrome for on-device inference (end-user machines)

1. Chrome **139+** on desktop, up to date.
2. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`
   and restart Chrome.
3. The first on-device request downloads Gemini Nano in the
   background (the app shows progress). In DevTools you can check
   `await LanguageModel.availability()`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # rule-engine + parser unit tests (Vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

## Deploy

The build output in `dist/` is a fully static site — any static host
works. For Firebase Hosting:

```bash
npm run build
npx firebase-tools deploy --only hosting   # after `firebase init hosting`
```

Remember to register your production domain's App Check provider
(reCAPTCHA v3) before real users rely on the AI panel.

## Project layout

```
src/
  App.tsx                 React UI shell: input, samples, results
  types.ts                Shared types (verdicts, findings, AI opinion)
  components/
    Header.tsx            Brand bar + New Check action
    VerdictBanner.tsx     Combined verdict (stricter wins)
    LocalFindingsPanel.tsx  On-device rule findings + link breakdown
    AiOpinionPanel.tsx    Mode toggle, inference badge, AI opinion
    HowItWorks.tsx        Privacy / hybrid explainer
  lib/
    localRules.ts         Deterministic rule engine (18 checks)
    verdict.ts            Stricter-verdict-wins combiner
    samples.ts            Built-in demo inputs (safe / suspicious / scam)
    firebase.ts           Config from .env, app init, App Check
    ai.ts                 Firebase AI Logic hybrid client
tests/
  localRules.test.ts      Rule-engine suite
  verdict.test.ts         Verdict combiner suite
  ai.test.ts              AI-response parser suite
```

## Limitations (honest list)

- A checker is a safety aid, not a guarantee. The rule engine cannot
  see an address's on-chain history or a page's live content, and it
  says so in its findings.
- On-device inference needs Chrome 139+ on desktop with the Prompt
  API flag; elsewhere the same call falls back to the cloud model
  (or, in On-device only mode, reports the limitation).
- AI monitoring in the Firebase console does not cover on-device
  inference (per the docs); cloud answers are monitored as usual.

## License

MIT — see [LICENSE](./LICENSE).
