// AI second opinion via Firebase AI Logic HYBRID inference.
//
// API used (Firebase AI Logic docs, "Build hybrid experiences in Web
// apps with on-device and cloud-hosted models" +
// "Configuration options for hybrid experiences in Web apps"):
// https://firebase.google.com/docs/ai-logic/hybrid/web/get-started
// https://firebase.google.com/docs/ai-logic/hybrid/web/configuration-options
//
//   import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode }
//     from "firebase/ai";
//
//   const ai = getAI(app, { backend: new GoogleAIBackend() });
//   const model = getGenerativeModel(ai, {
//     mode: InferenceMode.PREFER_ON_DEVICE,   // Nano first, cloud fallback
//     inCloudParams: { model: "<cloud model>" }, // optional override
//   });
//   model.initializeDeviceModel(onProgress);  // on a user gesture, first
//   const result = await model.generateContent(prompt);
//   result.response.text();                   // the model's reply
//   result.response.inferenceSource;          // "ON_DEVICE" | "IN_CLOUD"
//
// The SDK requires Firebase JS SDK v12.5.0+ for hybrid inference
// (this project uses the v13 line). On-device inference runs through
// Chrome's Prompt API (Gemini Nano) and needs Chrome 139+ on desktop.

import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
} from "firebase/ai";
import type { FirebaseApp } from "firebase/app";
import type {
  EffectiveInferenceSource,
  InferenceMode as UiInferenceMode,
  LocalAnalysisResult,
  Verdict,
} from "../types";

/** Which path actually answered a request. */
export type AnsweredBy = "on-device" | "in-cloud" | "unknown";

export interface AiServiceOpinion {
  verdict: Verdict;
  headline: string;
  explanation: string;
  keyRisks: string[];
  recommendedAction: string;
  /** The path that answered, in UI terms ("on-device" | "cloud"). */
  source: EffectiveInferenceSource;
  answeredBy: AnsweredBy;
  /** Raw inferenceSource value from the SDK, for display/debugging. */
  inferenceSourceRaw: string | null;
  elapsedMs: number;
}

export type AiServiceResult =
  | { status: "ok"; opinion: AiServiceOpinion }
  | { status: "error"; message: string };

const MODE_TO_INFERENCE_MODE: Record<UiInferenceMode, InferenceMode> = {
  hybrid: InferenceMode.PREFER_ON_DEVICE,
  "on-device": InferenceMode.ONLY_ON_DEVICE,
  cloud: InferenceMode.ONLY_IN_CLOUD,
};

let modelCache: { key: string; model: GenerativeModel } | null = null;

function getModel(app: FirebaseApp, mode: UiInferenceMode): GenerativeModel {
  const cloudModel = (import.meta.env.VITE_CLOUD_MODEL || "").trim();
  const key = `${mode}|${cloudModel}`;
  if (modelCache?.key === key) return modelCache.model;

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    mode: MODE_TO_INFERENCE_MODE[mode],
    // Only override the SDK's default cloud fallback model when asked.
    ...(cloudModel ? { inCloudParams: { model: cloudModel } } : {}),
  });
  modelCache = { key, model };
  return model;
}

function buildPrompt(input: string, local: LocalAnalysisResult): string {
  const ruleLines =
    local.findings.length > 0
      ? local.findings
          .slice(0, 8)
          .map((f) => `- [${f.severity}] ${f.category}: ${f.matchedSnippet}`)
          .join("\n")
      : "- (no findings)";

  return [
    "You are the second-opinion reviewer for PayShield, a payment-safety checker.",
    "A user pasted a payment link, a payment-request message, or a crypto address.",
    "Judge only what is in the pasted text: pressure tactics, impersonation,",
    "lookalike domains, requests for seed phrases or private keys, guaranteed",
    "returns, send-money-first conditions, or other fraud signals.",
    "Classify as danger for clear scams, caution when key details are hidden",
    "or unverified, and safe only when nothing looks off. Never claim a",
    "payment is guaranteed safe. Do not invent facts about the link or",
    "address that are not in the text.",
    "",
    `An offline rule engine already scored it "${local.verdict}" with these findings:`,
    ruleLines,
    "",
    "Reply with ONLY a JSON object in exactly this shape:",
    '{"verdict": "safe" | "caution" | "danger", "headline": "short plain-English summary (4 to 9 words)", "explanation": "one short plain-English paragraph for a non-technical user", "keyRisks": ["short signal", "..."], "recommendedAction": "one clear next step"}',
    "Give 2 to 4 short, concrete keyRisks. Write in calm, clear, plain",
    "English and avoid security jargon.",
    "",
    "--- BEGIN PASTED TEXT ---",
    input.slice(0, 3000),
    "--- END PASTED TEXT ---",
  ].join("\n");
}

export interface ParsedOpinion {
  verdict: Verdict;
  headline: string;
  explanation: string;
  keyRisks: string[];
  recommendedAction: string;
}

const HEADLINE_DEFAULTS: Record<Verdict, string> = {
  safe: "No AI concerns spotted",
  caution: "Worth a closer look before paying",
  danger: "AI review flags this as a scam risk",
};

const ACTION_DEFAULTS: Record<Verdict, string> = {
  safe: "Double-check the recipient name and amount on the payment screen before confirming.",
  caution:
    "Pause before clicking. Contact the sender or company using a phone number or website you already trust.",
  danger:
    "Do not click any links, transfer funds, or enter wallet credentials from this message.",
};

export function parseOpinion(raw: string, fallbackVerdict: Verdict): ParsedOpinion {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as {
        verdict?: unknown;
        headline?: unknown;
        explanation?: unknown;
        keyRisks?: unknown;
        reasons?: unknown;
        recommendedAction?: unknown;
      };
      const v = String(obj.verdict || "").toLowerCase();
      if (v === "safe" || v === "caution" || v === "danger") {
        const risksRaw = Array.isArray(obj.keyRisks)
          ? obj.keyRisks
          : Array.isArray(obj.reasons)
            ? obj.reasons
            : [];
        const keyRisks = risksRaw
          .map((r) => String(r))
          .filter(Boolean)
          .slice(0, 4);
        const explanation =
          typeof obj.explanation === "string" && obj.explanation.trim()
            ? obj.explanation.trim()
            : keyRisks.join(" ");
        return {
          verdict: v,
          headline:
            typeof obj.headline === "string" && obj.headline.trim()
              ? obj.headline.trim()
              : HEADLINE_DEFAULTS[v],
          explanation: explanation || HEADLINE_DEFAULTS[v],
          keyRisks,
          recommendedAction:
            typeof obj.recommendedAction === "string" &&
            obj.recommendedAction.trim()
              ? obj.recommendedAction.trim()
              : ACTION_DEFAULTS[v],
        };
      }
    } catch {
      // Fall through to the plain-text fallback below.
    }
  }

  // The model answered but not in JSON (small on-device models do this
  // sometimes). Show its words as the explanation and let the rule
  // verdict stand as the AI verdict.
  return {
    verdict: fallbackVerdict,
    headline: HEADLINE_DEFAULTS[fallbackVerdict],
    explanation: raw.trim().slice(0, 900) || HEADLINE_DEFAULTS[fallbackVerdict],
    keyRisks: [],
    recommendedAction: ACTION_DEFAULTS[fallbackVerdict],
  };
}

function mapInferenceSource(raw: unknown): AnsweredBy {
  // Docs: the value is ON_DEVICE or IN_CLOUD (InferenceSource enum).
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("device")) return "on-device";
  if (s.includes("cloud")) return "in-cloud";
  return "unknown";
}

/**
 * Ask the hybrid model for a second opinion.
 *
 * Must be called from (or after) a user gesture: the docs require
 * model.initializeDeviceModel() to be called on/after a page interaction
 * and before generateContent(). The Check button click satisfies this.
 *
 * onProgress receives Gemini Nano download progress (0..1) when the
 * on-device model still needs to be downloaded.
 */
export async function getAiOpinion(
  app: FirebaseApp,
  mode: UiInferenceMode,
  input: string,
  local: LocalAnalysisResult,
  onProgress?: (fraction: number) => void,
): Promise<AiServiceResult> {
  const started = performance.now();
  try {
    const model = getModel(app, mode);

    // Required by the hybrid docs before the first prompt request.
    // Fire-and-forget with the progress callback, per the docs example.
    try {
      model.initializeDeviceModel((val) => {
        if (onProgress && typeof val === "number") onProgress(val);
      });
    } catch {
      // Older SDK / unsupported browser: generateContent will surface
      // the real error if on-device inference is impossible.
    }

    const result = await model.generateContent(buildPrompt(input, local));
    const response = result.response;
    const rawText = response.text();
    const sourceRaw =
      (response as { inferenceSource?: unknown }).inferenceSource ?? null;

    const answeredBy = mapInferenceSource(sourceRaw);
    const parsed = parseOpinion(rawText, local.verdict);

    return {
      status: "ok",
      opinion: {
        ...parsed,
        // If the SDK did not report a source, fall back to the path the
        // requested mode primarily targets so the badge still renders.
        source:
          answeredBy === "in-cloud"
            ? "cloud"
            : answeredBy === "on-device"
              ? "on-device"
              : mode === "cloud"
                ? "cloud"
                : "on-device",
        answeredBy,
        inferenceSourceRaw: sourceRaw == null ? null : String(sourceRaw),
        elapsedMs: Math.round(performance.now() - started),
      },
    };
  } catch (err) {
    return {
      status: "error",
      message: friendlyError(err),
    };
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/on-device|ondevice|LanguageModel|Prompt API/i.test(msg)) {
    return (
      "On-device inference is not available in this browser. Hybrid mode " +
      "needs Chrome 139+ on desktop with the Gemini Nano Prompt API " +
      "enabled. Cloud mode still works. (" +
      msg +
      ")"
    );
  }
  if (/app-check|appcheck|401|403/i.test(msg)) {
    return (
      "Firebase rejected the request (App Check / permissions). Make sure " +
      "AI Logic is enabled in the Firebase console and your App Check " +
      "debug token is registered. (" +
      msg +
      ")"
    );
  }
  if (/api-key|api key|PERMISSION_DENIED|not found/i.test(msg)) {
    return (
      "Firebase AI Logic is not fully set up for this project yet. Enable " +
      "AI Logic with the Gemini Developer API in the Firebase console. (" +
      msg +
      ")"
    );
  }
  return msg;
}
