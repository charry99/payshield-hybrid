import { AlertTriangle, CheckCircle2, Link2, Lock, LockOpen, ShieldAlert } from 'lucide-react';
import type { LocalAnalysisResult } from '../types';

interface LocalFindingsPanelProps {
  analysis: LocalAnalysisResult;
}

export function LocalFindingsPanel({ analysis }: LocalFindingsPanelProps) {
  const hasFindings = analysis.findings.length > 0;

  return (
    <section
      id="local-checks"
      aria-labelledby="local-checks-heading"
      className="flex flex-col rounded-2xl border border-[#232936] bg-[#12161E] p-5 sm:p-6"
    >
      <div className="flex flex-col gap-1 border-b border-[#1E2430] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="local-checks-heading"
            className="text-lg font-bold tracking-tight text-[#F8FAFC]"
          >
            Instant On-Device Checks
          </h2>
          <span className="text-xs font-medium text-[#94A3B8] tabular-nums">
            {analysis.checkedRuleCount} rules checked · {analysis.durationMs} ms · Runs in browser
          </span>
        </div>
        <p className="text-sm text-[#9CA3AF]">
          {hasFindings
            ? `Found ${analysis.findings.length} ${analysis.findings.length === 1 ? 'risk signal' : 'risk signals'} locally before contacting any external service.`
            : `All ${analysis.checkedRuleCount} local safety rules passed with zero scam patterns detected.`}
        </p>
      </div>

      {/* Findings or Verified Safe Checks */}
      <div className="mt-5 space-y-3.5">
        {hasFindings ? (
          analysis.findings.map((finding) => {
            const isDanger = finding.severity === 'danger';
            return (
              <article
                key={finding.id}
                className={`rounded-xl border p-4 ${
                  isDanger
                    ? 'border-[#6E1F2A] bg-[#1A1115]'
                    : 'border-[#684915] bg-[#191610]'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {isDanger ? (
                    <ShieldAlert
                      className="h-4 w-4 shrink-0 text-[#F87171]"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertTriangle
                      className="h-4 w-4 shrink-0 text-[#FBBF24]"
                      aria-hidden="true"
                    />
                  )}
                  <span className={isDanger ? 'text-[#F87171]' : 'text-[#FBBF24]'}>
                    {isDanger ? 'Danger' : 'Caution'}
                  </span>
                  <span aria-hidden="true" className="text-[#4B5563]">
                    ·
                  </span>
                  <span className="text-[#CBD5E1] font-medium">{finding.category}</span>
                </div>

                <h3 className="mt-2 text-[15px] font-semibold text-[#F8FAFC] leading-snug">
                  {finding.title}
                </h3>

                <p className="mt-1.5 text-sm leading-relaxed text-[#B8C0CC]">
                  {finding.explanation}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#232936] bg-[#0C0F14] px-3 py-2 text-xs">
                  <span className="text-[#94A3B8] shrink-0">Matched:</span>
                  <code className="font-mono text-[#FDE68A] break-all">
                    {finding.matchedSnippet}
                  </code>
                </div>
              </article>
            );
          })
        ) : (
          analysis.passedChecks.map((check) => (
            <article
              key={check.id}
              className="rounded-xl border border-[#1E3B2B] bg-[#0F1B15] p-4"
            >
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#4ADE80]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#F1F5F9]">
                    {check.label}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#A7B4C4]">
                    {check.detail}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Detected Links Breakdown */}
      {analysis.urls.length > 0 && (
        <div className="mt-5 border-t border-[#1E2430] pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
            <Link2 className="h-3.5 w-3.5 text-[#D99B26]" aria-hidden="true" />
            <span>Detected links inspected safely (not opened)</span>
          </div>
          <ul className="mt-2.5 space-y-2">
            {analysis.urls.map((url) => (
              <li
                key={url.raw}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1F2532] bg-[#0D1016] px-3 py-2 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {url.protocol === 'http:' ? (
                    <LockOpen
                      className="h-3.5 w-3.5 shrink-0 text-[#FBBF24]"
                      aria-label="Unencrypted HTTP"
                    />
                  ) : (
                    <Lock
                      className="h-3.5 w-3.5 shrink-0 text-[#4ADE80]"
                      aria-label="HTTPS"
                    />
                  )}
                  <span className="font-mono text-[#E2E8F0] break-all">
                    {url.hostname}
                  </span>
                </div>
                <span className="text-[#94A3B8] whitespace-nowrap shrink-0">
                  {url.isTrustedBrand
                    ? `Official ${url.trustedBrandName}`
                    : url.isShortener
                      ? 'Shortened link'
                      : url.protocol === 'http:'
                        ? 'Unencrypted HTTP'
                        : `Ending: ${url.tld}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
