export type Verdict = 'safe' | 'caution' | 'danger';

export type InferenceMode = 'hybrid' | 'on-device' | 'cloud';

export type EffectiveInferenceSource = 'on-device' | 'cloud';

export interface RuleFinding {
  id: string;
  ruleKey:
    | 'lookalike-domain'
    | 'unencrypted-http'
    | 'url-shortener'
    | 'risky-tld'
    | 'seed-phrase'
    | 'advance-fee'
    | 'guaranteed-return'
    | 'urgency-pressure'
    | 'ip-literal'
    | 'hidden-destination'
    | 'crypto-address'
    | 'qr-receive'
    | 'id-documents'
    | 'wallet-verify-lure'
    | 'airdrop-lure'
    | 'support-impersonation'
    | 'gift-card-wire'
    | 'secrecy-demand';
  category: string;
  severity: 'caution' | 'danger';
  title: string;
  explanation: string;
  matchedSnippet: string;
}

export interface PassedCheck {
  id: string;
  label: string;
  detail: string;
}

export interface ExtractedUrl {
  raw: string;
  protocol: string;
  hostname: string;
  tld: string;
  isHttps: boolean;
  isShortener: boolean;
  isTrustedBrand: boolean;
  trustedBrandName?: string;
  /** True when the URL carries userinfo (https://brand@evil.tld/...) that hides the real host. */
  hidesDestination: boolean;
}

export interface DetectedAddress {
  raw: string;
  kind: 'evm' | 'bitcoin' | 'solana';
}

export interface LocalAnalysisResult {
  verdict: Verdict;
  findings: RuleFinding[];
  passedChecks: PassedCheck[];
  urls: ExtractedUrl[];
  addresses: DetectedAddress[];
  checkedRuleCount: number;
  durationMs: number;
  shouldResolveLocallyInHybrid: boolean;
  hybridRoutingReason: string;
}

export interface AiOpinionResult {
  verdict: Verdict;
  headline: string;
  explanation: string;
  keyRisks: string[];
  recommendedAction: string;
  source: EffectiveInferenceSource;
  routingNote?: string;
  /** Raw inferenceSource value reported by the Firebase AI Logic SDK (e.g. "ON_DEVICE"), when the opinion came from the AI. */
  inferenceSourceRaw?: string | null;
  /** How long the AI call took, in milliseconds, when the opinion came from the AI. */
  elapsedMs?: number;
}

export interface SampleCase {
  id: 'safe' | 'suspicious' | 'scam';
  label: string;
  shortHint: string;
  expectedVerdict: Verdict;
  content: string;
}
