import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { EffectiveInferenceSource, Verdict } from '../types';
import { verdictLabel } from '../lib/verdict';

interface VerdictBannerProps {
  overallVerdict: Verdict;
  localVerdict: Verdict;
  aiVerdict: Verdict | null;
  aiLoading: boolean;
  aiSource: EffectiveInferenceSource | null;
  findingsCount: number;
}

const BANNER_STYLES: Record<
  Verdict,
  {
    container: string;
    iconWrap: string;
    verdictText: string;
    headline: string;
    guidance: string;
  }
> = {
  safe: {
    container: 'border-[#1F5C3A] bg-[#0D1E16]',
    iconWrap: 'bg-[#16A34A]/15 text-[#4ADE80] border-[#16A34A]/35',
    verdictText: 'text-[#4ADE80]',
    headline: 'Looks safe to review',
    guidance:
      'No scam indicators were detected by the checks. Still confirm the recipient name and exact amount before confirming payment.',
  },
  caution: {
    container: 'border-[#785113] bg-[#1D160A]',
    iconWrap: 'bg-[#D97706]/15 text-[#FBBF24] border-[#D97706]/35',
    verdictText: 'text-[#FBBF24]',
    headline: 'Proceed with caution',
    guidance:
      'Hidden destinations, missing encryption, or pressure tactics were detected. Verify this request through a separate trusted channel before paying.',
  },
  danger: {
    container: 'border-[#7F1D2B] bg-[#210F13]',
    iconWrap: 'bg-[#DC2626]/15 text-[#F87171] border-[#DC2626]/35',
    verdictText: 'text-[#F87171]',
    headline: 'High risk — likely a payment scam',
    guidance:
      'Do not click links, send funds, or share recovery phrases or keys. Close this message and contact the organization directly if unsure.',
  },
};

export function VerdictBanner({
  overallVerdict,
  localVerdict,
  aiVerdict,
  aiLoading,
  aiSource,
  findingsCount,
}: VerdictBannerProps) {
  const style = BANNER_STYLES[overallVerdict];
  const Icon =
    overallVerdict === 'safe'
      ? ShieldCheck
      : overallVerdict === 'caution'
        ? AlertTriangle
        : ShieldAlert;

  const aiStatusText = aiLoading
    ? 'Checking second opinion…'
    : aiVerdict
      ? `${verdictLabel(aiVerdict)} (${aiSource === 'cloud' ? 'Cloud' : 'On-device'})`
      : 'Unavailable';

  return (
    <section
      aria-live="polite"
      aria-label="Overall safety verdict"
      className={`rounded-2xl border p-5 sm:p-6 transition-colors duration-200 ${style.container}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${style.iconWrap}`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                className={`text-2xl sm:text-3xl font-bold tracking-tight ${style.verdictText}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {verdictLabel(overallVerdict)}
              </span>
              <span className="text-base sm:text-lg font-semibold text-[#F8FAFC]">
                {style.headline}
              </span>
            </div>
            <p className="mt-1.5 max-w-3xl text-sm sm:text-[15px] leading-relaxed text-[#CBD5E1]">
              {style.guidance}
            </p>
          </div>
        </div>
      </div>

      {/* Unboxed reconciliation metadata row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/10 pt-3.5 text-xs sm:text-[13px] text-[#94A3B8] tabular-nums">
        <span>
          Local rules:{' '}
          <strong className="font-semibold text-[#E2E8F0]">
            {verdictLabel(localVerdict)}
          </strong>{' '}
          ({findingsCount === 0 ? '0 flags' : `${findingsCount} ${findingsCount === 1 ? 'flag' : 'flags'}`})
        </span>
        <span aria-hidden="true" className="text-[#475569]">
          ·
        </span>
        <span>
          AI opinion:{' '}
          <strong className="font-semibold text-[#E2E8F0]">{aiStatusText}</strong>
        </span>
        <span aria-hidden="true" className="text-[#475569]">
          ·
        </span>
        <span>Combined rule: stricter verdict wins</span>
      </div>
    </section>
  );
}
