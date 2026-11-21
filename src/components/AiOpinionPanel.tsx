import {
  AlertTriangle,
  Cloud,
  Cpu,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type {
  AiOpinionResult,
  EffectiveInferenceSource,
  InferenceMode,
} from '../types';
import { verdictLabel } from '../lib/verdict';

interface AiOpinionPanelProps {
  mode: InferenceMode;
  onModeChange: (mode: InferenceMode) => void;
  opinion: AiOpinionResult | null;
  loading: boolean;
  error: string | null;
  activeSource: EffectiveInferenceSource | null;
  canEscalateToCloud: boolean;
  onRequestCloudOpinion: () => void;
  onRetryCloud: () => void;
  /** Gemini Nano download progress (0..1) while the on-device model is fetched, else null. */
  downloadProgress?: number | null;
}

const MODE_OPTIONS: { value: InferenceMode; label: string }[] = [
  { value: 'hybrid', label: 'Hybrid (auto)' },
  { value: 'on-device', label: 'On-device only' },
  { value: 'cloud', label: 'Cloud only' },
];

export function AiOpinionPanel({
  mode,
  onModeChange,
  opinion,
  loading,
  error,
  activeSource,
  canEscalateToCloud,
  onRequestCloudOpinion,
  onRetryCloud,
  downloadProgress,
}: AiOpinionPanelProps) {
  const badgeSource: EffectiveInferenceSource =
    activeSource ?? (mode === 'on-device' ? 'on-device' : 'cloud');

  const isCloudBadge = badgeSource === 'cloud';

  return (
    <section
      id="ai-opinion"
      aria-labelledby="ai-opinion-heading"
      className="flex flex-col rounded-2xl border border-[#232936] bg-[#12161E] p-5 sm:p-6"
    >
      {/* Header + Inference-mode badge */}
      <div className="flex flex-col gap-3 border-b border-[#1E2430] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="ai-opinion-heading"
            className="text-lg font-bold tracking-tight text-[#F8FAFC]"
          >
            Gemini AI Second Opinion
          </h2>

          {/* Requested inference-mode badge showing which mode produced the answer */}
          <div
            data-testid="inference-mode-badge"
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
              isCloudBadge
                ? 'border-[#D99B26]/50 bg-[#D99B26]/12 text-[#FDE68A]'
                : 'border-[#334155] bg-[#1A2130] text-[#CBD5E1]'
            }`}
          >
            {isCloudBadge ? (
              <Cloud className="h-3.5 w-3.5 text-[#EAB308]" aria-hidden="true" />
            ) : (
              <Cpu className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
            )}
            <span>
              {loading
                ? 'Checking…'
                : isCloudBadge
                  ? 'Cloud'
                  : 'On-device'}
            </span>
          </div>
        </div>

        {/* 3-way segmented mode toggle */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[#94A3B8]">Inference mode</span>
          <div
            role="group"
            aria-label="Inference mode"
            className="inline-flex w-full sm:w-auto items-center gap-1 rounded-lg border border-[#232936] bg-[#0C0F14] p-1"
          >
            {MODE_OPTIONS.map((option) => {
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onModeChange(option.value)}
                  className={`flex-1 sm:flex-initial min-h-[36px] rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308] cursor-pointer ${
                    selected
                      ? 'bg-[#D99B26] text-[#0B0D11]'
                      : 'text-[#9CA3AF] hover:text-[#F8FAFC]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel body: Loading, Error, or Populated */}
      <div className="mt-5 flex-1">
        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <div className="flex items-center gap-2.5 text-sm font-medium text-[#FDE68A]">
              <RefreshCw className="h-4 w-4 animate-spin text-[#EAB308]" aria-hidden="true" />
              <span>
                {downloadProgress !== null &&
                downloadProgress !== undefined &&
                downloadProgress < 1
                  ? `Downloading the on-device Gemini Nano model… ${Math.round(downloadProgress * 100)}% (first run only)`
                  : 'Consulting Gemini AI via Firebase AI Logic for a second opinion…'}
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="h-5 w-2/3 rounded bg-[#1C2230]" />
              <div className="h-4 w-full rounded bg-[#1A202C]" />
              <div className="h-4 w-5/6 rounded bg-[#1A202C]" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-10 w-full rounded-lg bg-[#161B26]" />
              <div className="h-10 w-full rounded-lg bg-[#161B26]" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#7F1D2B] bg-[#1C1014] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-[#F87171]"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[#FCA5A5]">
                  AI second opinion unavailable
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[#CBD5E1]">{error}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onRetryCloud}
                    className="min-h-[40px] rounded-lg bg-[#D99B26] px-4 py-2 text-xs font-semibold text-[#0B0D11] whitespace-nowrap shrink-0 transition-colors hover:bg-[#EAB308] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308] cursor-pointer"
                  >
                    Retry AI check
                  </button>
                  <button
                    type="button"
                    onClick={() => onModeChange('on-device')}
                    className="min-h-[40px] rounded-lg border border-[#2D3545] bg-[#141820] px-4 py-2 text-xs font-semibold text-[#E2E8F0] whitespace-nowrap shrink-0 transition-colors hover:border-[#475569] cursor-pointer"
                  >
                    Use On-device only
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : opinion ? (
          <div className="space-y-5">
            {/* AI Verdict Line */}
            <div className="rounded-xl border border-[#232936] bg-[#0D1016] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold">
                {opinion.verdict === 'safe' ? (
                  <ShieldCheck className="h-4 w-4 text-[#4ADE80]" aria-hidden="true" />
                ) : opinion.verdict === 'caution' ? (
                  <AlertTriangle className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-[#F87171]" aria-hidden="true" />
                )}
                <span
                  className={
                    opinion.verdict === 'safe'
                      ? 'text-[#4ADE80]'
                      : opinion.verdict === 'caution'
                        ? 'text-[#FBBF24]'
                        : 'text-[#F87171]'
                  }
                >
                  {verdictLabel(opinion.verdict)}
                </span>
                <span aria-hidden="true" className="text-[#475569]">
                  ·
                </span>
                <span className="text-[#94A3B8] font-medium">
                  {opinion.source === 'cloud'
                    ? 'Gemini Cloud assessment'
                    : opinion.inferenceSourceRaw
                      ? 'Gemini Nano on-device assessment'
                      : 'Private on-device assessment'}
                </span>
              </div>

              <h3 className="mt-2 text-base font-semibold text-[#F8FAFC] leading-snug">
                {opinion.headline}
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                {opinion.explanation}
              </p>
            </div>

            {/* Biggest risks / signals */}
            {opinion.keyRisks.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[#94A3B8]">
                  {opinion.verdict === 'safe' ? 'Key checks noted' : 'Biggest risks spotted'}
                </h4>
                <ul className="mt-2.5 divide-y divide-[#1E2430] border-t border-b border-[#1E2430]">
                  {opinion.keyRisks.map((risk, index) => (
                    <li
                      key={`${risk}-${index}`}
                      className="py-2.5 text-sm leading-relaxed text-[#D1D5DB]"
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended action */}
            <div className="rounded-xl border border-[#3B2E14] bg-[#16130C] p-4">
              <p className="text-xs font-semibold text-[#EAB308]">What to do next</p>
              <p className="mt-1 text-sm leading-relaxed text-[#F1F5F9]">
                {opinion.recommendedAction}
              </p>
            </div>

            {/* Routing explanation + optional Cloud escalation when Hybrid resolved locally */}
            {opinion.routingNote && (
              <div className="flex flex-col gap-3 border-t border-[#1E2430] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-[#94A3B8]">
                  {opinion.routingNote}
                </p>
                {canEscalateToCloud && (
                  <button
                    type="button"
                    onClick={onRequestCloudOpinion}
                    className="min-h-[38px] rounded-lg border border-[#D99B26]/50 bg-[#D99B26]/10 px-3.5 py-2 text-xs font-semibold text-[#FDE68A] whitespace-nowrap shrink-0 transition-colors hover:border-[#EAB308] hover:bg-[#D99B26]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308] cursor-pointer"
                  >
                    Ask AI anyway
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
