import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Eraser, ShieldCheck } from 'lucide-react';
import { Header } from './components/Header';
import { VerdictBanner } from './components/VerdictBanner';
import { LocalFindingsPanel } from './components/LocalFindingsPanel';
import { AiOpinionPanel } from './components/AiOpinionPanel';
import { HowItWorks } from './components/HowItWorks';
import { buildOnDeviceOpinion, runLocalRules } from './lib/localRules';
import { SAMPLE_CASES } from './lib/samples';
import { combineVerdicts } from './lib/verdict';
import { getFirebaseState } from './lib/firebase';
import { getAiOpinion } from './lib/ai';
import type {
  AiOpinionResult,
  EffectiveInferenceSource,
  InferenceMode,
  LocalAnalysisResult,
  SampleCase,
} from './types';

const CHECKED_RULE_OVERVIEW = [
  'Lookalike brand domains (paypa1, g00gle)',
  'Unencrypted http:// payment links',
  'URL shorteners hiding the destination',
  'Risky low-cost endings (.xyz, .top, .click)',
  'Seed phrase or private key requests',
  '“Send money first to unlock” traps',
  'Guaranteed-return profit promises',
  'Artificial urgency & threat pressure',
  'Links to raw IP addresses',
  'Destinations hidden behind an @ sign',
  'QR codes you scan to “receive” money',
  'Identity documents requested up front',
  '“Verify your wallet” drainer wording',
  'Unsolicited airdrop & prize claims',
  '“Support team” impersonation in chat',
  'Gift card or wire-transfer demands',
  'Demands to keep the payment secret',
  'Bare crypto addresses that cannot be verified offline',
];

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Incremented on every new AI request (and on clear/unmount) so a slow
  // answer from an earlier check can never overwrite a newer one.
  const requestTokenRef = useRef(0);

  // Firebase app + App Check are initialised once. When no config is
  // present the state is "not-configured" and only the AI paths that
  // need Firebase are affected — the rule engine always works.
  const firebaseState = useMemo(() => getFirebaseState(), []);

  const [inputText, setInputText] = useState('');
  const [checkedText, setCheckedText] = useState('');
  const [activeSampleId, setActiveSampleId] = useState<SampleCase['id'] | null>(null);
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>('hybrid');

  const [localResult, setLocalResult] = useState<LocalAnalysisResult | null>(null);
  const [aiOpinion, setAiOpinion] = useState<AiOpinionResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<EffectiveInferenceSource | null>(null);
  const [canEscalateToCloud, setCanEscalateToCloud] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      requestTokenRef.current += 1;
    };
  }, []);

  const notConfiguredMessage = useCallback((): string => {
    if (firebaseState.status === 'not-configured') {
      return (
        'Firebase AI Logic is not configured yet, so the AI second opinion cannot run. ' +
        `Add your Firebase web config to a .env file (${firebaseState.missing.join(', ') || 'VITE_FIREBASE_*'} — see .env.example), ` +
        'or switch to On-device only to use the local rules summary instead.'
      );
    }
    if (firebaseState.status === 'error') {
      return `Firebase failed to initialise: ${firebaseState.message}. The on-device rule results above still stand.`;
    }
    return 'Firebase AI Logic is not available right now.';
  }, [firebaseState]);

  const applyLocalOpinion = useCallback(
    (local: LocalAnalysisResult, note: string, canEscalate: boolean) => {
      requestTokenRef.current += 1;
      setAiLoading(false);
      setAiError(null);
      setDownloadProgress(null);
      setActiveSource('on-device');
      setCanEscalateToCloud(canEscalate);
      setAiOpinion(buildOnDeviceOpinion(local, note));
    },
    [],
  );

  const requestAiOpinion = useCallback(
    async (
      text: string,
      local: LocalAnalysisResult,
      mode: InferenceMode,
      routingNote: string,
    ) => {
      if (firebaseState.status !== 'ready') {
        // On-device only mode still has an honest offline fallback: the
        // local rules summary, clearly labelled as such.
        if (mode === 'on-device') {
          applyLocalOpinion(
            local,
            'On-device only mode is active and Firebase is not configured, so this summary comes from the local rules only. Nothing was sent over the network.',
            false,
          );
          return;
        }
        requestTokenRef.current += 1;
        setAiLoading(false);
        setAiOpinion(null);
        setDownloadProgress(null);
        setCanEscalateToCloud(false);
        setAiError(notConfiguredMessage());
        return;
      }

      const token = ++requestTokenRef.current;
      setAiLoading(true);
      setAiError(null);
      setDownloadProgress(null);
      setCanEscalateToCloud(false);

      const result = await getAiOpinion(
        firebaseState.app,
        mode,
        text,
        local,
        (fraction) => {
          if (requestTokenRef.current === token) {
            setDownloadProgress(fraction);
          }
        },
      );

      if (requestTokenRef.current !== token) return; // superseded

      setAiLoading(false);
      setDownloadProgress(null);

      if (result.status === 'ok') {
        const { opinion } = result;
        const answeredDetail =
          opinion.answeredBy === 'on-device'
            ? `Answered on this device by Gemini Nano via Firebase AI Logic (inferenceSource: ${opinion.inferenceSourceRaw ?? 'ON_DEVICE'}, ${(opinion.elapsedMs / 1000).toFixed(1)}s).`
            : opinion.answeredBy === 'in-cloud'
              ? `Answered by a cloud Gemini model via Firebase AI Logic (inferenceSource: ${opinion.inferenceSourceRaw ?? 'IN_CLOUD'}, ${(opinion.elapsedMs / 1000).toFixed(1)}s).`
              : 'The Firebase AI Logic SDK did not report which path answered this request.';
        setAiOpinion({
          verdict: opinion.verdict,
          headline: opinion.headline,
          explanation: opinion.explanation,
          keyRisks: opinion.keyRisks,
          recommendedAction: opinion.recommendedAction,
          source: opinion.source,
          routingNote: `${routingNote} ${answeredDetail}`,
          inferenceSourceRaw: opinion.inferenceSourceRaw,
          elapsedMs: opinion.elapsedMs,
        });
        setActiveSource(opinion.source);
      } else {
        setAiOpinion(null);
        setAiError(
          `${result.message} Your on-device check results are still shown above.`,
        );
      }
    },
    [applyLocalOpinion, firebaseState, notConfiguredMessage],
  );

  const evaluateAiForMode = useCallback(
    (
      text: string,
      local: LocalAnalysisResult,
      mode: InferenceMode,
      forceAiOverride = false,
    ) => {
      // Hybrid privacy shortcut: when the local rules already found
      // high-confidence scam signals, Hybrid resolves on-device and the
      // text never leaves the browser (unless the user asks the AI).
      if (mode === 'hybrid' && local.shouldResolveLocallyInHybrid && !forceAiOverride) {
        applyLocalOpinion(local, local.hybridRoutingReason, true);
        return;
      }

      const note = forceAiOverride
        ? 'Sent to Gemini AI at your request for a second opinion.'
        : mode === 'cloud'
          ? 'Cloud only mode is active — answered by cloud Gemini via Firebase AI Logic.'
          : mode === 'on-device'
            ? 'On-device only mode is active — answered by Gemini Nano via Firebase AI Logic, nothing leaves this device.'
            : local.hybridRoutingReason;

      void requestAiOpinion(text, local, mode, note);
    },
    [applyLocalOpinion, requestAiOpinion],
  );

  const runFullInspection = useCallback(
    (rawText: string, modeOverride?: InferenceMode) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      const effectiveMode = modeOverride ?? inferenceMode;
      const local = runLocalRules(trimmed);

      setCheckedText(trimmed);
      setLocalResult(local);
      setAiOpinion(null);
      setAiError(null);

      evaluateAiForMode(trimmed, local, effectiveMode, false);
    },
    [evaluateAiForMode, inferenceMode],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runFullInspection(inputText);
  };

  const handleSampleClick = (sample: SampleCase) => {
    setInputText(sample.content);
    setActiveSampleId(sample.id);
    runFullInspection(sample.content);
  };

  const handleModeChange = (nextMode: InferenceMode) => {
    setInferenceMode(nextMode);
    if (localResult && checkedText) {
      evaluateAiForMode(checkedText, localResult, nextMode, false);
    }
  };

  const handleRequestCloudOverride = () => {
    if (localResult && checkedText) {
      evaluateAiForMode(checkedText, localResult, inferenceMode, true);
    }
  };

  const handleRetryCloud = () => {
    if (localResult && checkedText) {
      evaluateAiForMode(checkedText, localResult, inferenceMode, true);
    }
  };

  const handleClearOrNewCheck = () => {
    requestTokenRef.current += 1;
    setInputText('');
    setCheckedText('');
    setActiveSampleId(null);
    setLocalResult(null);
    setAiOpinion(null);
    setAiLoading(false);
    setAiError(null);
    setActiveSource(null);
    setCanEscalateToCloud(false);
    setDownloadProgress(null);
    textareaRef.current?.focus();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const overallVerdict = localResult
    ? combineVerdicts(localResult.verdict, aiOpinion?.verdict)
    : null;

  const isInputModifiedSinceCheck =
    Boolean(localResult) && inputText.trim() !== checkedText;

  return (
    <div className="min-h-screen bg-[#0B0D11] text-[#F1F3F5] flex flex-col">
      <Header onNewCheck={handleClearOrNewCheck} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-16 sm:px-6 sm:pt-12 lg:px-8">
        {/* Hero + Input Workspace */}
        <section id="inspector" aria-labelledby="inspector-heading">
          <div className="max-w-3xl">
            <h1
              id="inspector-heading"
              className="text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight text-[#F8FAFC] leading-[1.15]"
              style={{ textWrap: 'balance' }}
            >
              Check any payment link or message before you pay
            </h1>
            <p className="mt-3 text-base sm:text-[17px] leading-relaxed text-[#9CA3AF]">
              Paste a payment URL, invoice email, text message, or wallet prompt. Instant scam
              checks run privately in your browser first, backed by a Gemini AI second opinion
              through Firebase AI Logic hybrid inference.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-7 rounded-2xl border border-[#232936] bg-[#12161E] p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
              <label
                htmlFor="payment-input"
                className="text-sm font-semibold text-[#E2E8F0]"
              >
                Payment link or payment-request message
              </label>
              <span className="text-xs text-[#94A3B8] tabular-nums">
                {inputText.length.toLocaleString()} / 5,000 characters
              </span>
            </div>

            <textarea
              ref={textareaRef}
              id="payment-input"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (activeSampleId) setActiveSampleId(null);
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && inputText.trim()) {
                  e.preventDefault();
                  runFullInspection(inputText);
                }
              }}
              maxLength={5000}
              rows={5}
              placeholder="Paste a payment link (e.g. https://www.paypal.com/...) or the full payment message you received..."
              className="w-full resize-y rounded-xl border border-[#2A3142] bg-[#0C0F14] px-4 py-3.5 text-[15px] leading-relaxed text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#D99B26] focus:outline-none focus:ring-2 focus:ring-[#D99B26]/30 transition-colors"
            />

            {/* Sample Buttons + Primary Check Action */}
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="text-xs font-medium text-[#94A3B8] mr-1">
                  Try a sample:
                </span>
                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  {SAMPLE_CASES.map((sample) => {
                    const isSelected = activeSampleId === sample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => handleSampleClick(sample)}
                        className={`min-h-[42px] rounded-lg border px-3.5 py-2 text-left sm:text-center text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308] cursor-pointer ${
                          isSelected
                            ? 'border-[#D99B26] bg-[#D99B26]/15 text-[#FDE68A]'
                            : 'border-[#272E3D] bg-[#161B25] text-[#CBD5E1] hover:border-[#3E485E] hover:text-[#F8FAFC]'
                        }`}
                      >
                        <span>{sample.label}</span>
                        <span className="ml-1.5 font-normal text-[#94A3B8]">
                          · {sample.shortHint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 shrink-0">
                {inputText.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearOrNewCheck}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[#272E3D] bg-[#161B25] px-4 py-2 text-sm font-medium text-[#CBD5E1] whitespace-nowrap shrink-0 transition-colors hover:border-[#475569] hover:text-[#F8FAFC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308] cursor-pointer"
                  >
                    <Eraser className="h-4 w-4" aria-hidden="true" />
                    <span>Clear</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="inline-flex min-h-[44px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-lg bg-[#D99B26] px-6 py-2.5 text-sm font-bold text-[#0B0D11] whitespace-nowrap shrink-0 transition-colors duration-150 hover:bg-[#EAB308] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FDE68A] cursor-pointer"
                >
                  <span>{isInputModifiedSinceCheck ? 'Re-check Payment' : 'Check Payment'}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Results Section or Clean Empty State */}
        {localResult && overallVerdict ? (
          <motion.div
            key={checkedText}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 space-y-6"
          >
            {/* Overall Verdict Banner */}
            <VerdictBanner
              overallVerdict={overallVerdict}
              localVerdict={localResult.verdict}
              aiVerdict={aiOpinion?.verdict ?? null}
              aiLoading={aiLoading}
              aiSource={activeSource}
              findingsCount={localResult.findings.length}
            />

            {/* Two-Column Analysis Results: Instant Local Rules + Gemini AI Second Opinion */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
              <LocalFindingsPanel analysis={localResult} />
              <AiOpinionPanel
                mode={inferenceMode}
                onModeChange={handleModeChange}
                opinion={aiOpinion}
                loading={aiLoading}
                error={aiError}
                activeSource={activeSource}
                canEscalateToCloud={canEscalateToCloud}
                onRequestCloudOpinion={handleRequestCloudOverride}
                onRetryCloud={handleRetryCloud}
                downloadProgress={downloadProgress}
              />
            </div>
          </motion.div>
        ) : (
          <section
            id="local-checks"
            aria-label="What PayShield checks"
            className="mt-8 rounded-2xl border border-[#1E2430] bg-[#10141C] p-6 sm:p-7"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-md">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#EAB308]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Ready to inspect</span>
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-[#F8FAFC]">
                  Local scam checks run before anything leaves your browser
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
                  Paste a link or message above, or click one of the three sample buttons to test
                  a real PayPal link, a suspicious shortened link, and an obvious wallet scam.
                </p>
              </div>

              <ul className="grid flex-1 grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:max-w-xl border-t border-[#1E2430] pt-4 lg:border-t-0 lg:pt-0">
                {CHECKED_RULE_OVERVIEW.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-[#CBD5E1]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D99B26]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* How It Works */}
        <div className="mt-14">
          <HowItWorks />
        </div>
      </main>

      <footer className="border-t border-[#1A1F2B] bg-[#0B0D11]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>PayShield Hybrid · Local-first payment scam inspection</span>
          <span>Always confirm payment recipients directly before transferring money.</span>
        </div>
      </footer>
    </div>
  );
}
