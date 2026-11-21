import { ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onNewCheck: () => void;
}

export function Header({ onNewCheck }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#1E2430] bg-[#0B0D11]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#inspector"
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#F8FAFC] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#EAB308] rounded-md"
        >
          <ShieldCheck className="h-5 w-5 text-[#EAB308]" aria-hidden="true" />
          <span style={{ fontFamily: 'var(--font-display)' }}>PayShield Hybrid</span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9CA3AF]"
        >
          <a
            href="#inspector"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F8FAFC] hover:underline underline-offset-4 decoration-[#D99B26]"
          >
            Inspector
          </a>
          <a
            href="#local-checks"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F8FAFC] hover:underline underline-offset-4 decoration-[#D99B26]"
          >
            Local Checks
          </a>
          <a
            href="#ai-opinion"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F8FAFC] hover:underline underline-offset-4 decoration-[#D99B26]"
          >
            AI Opinion
          </a>
          <a
            href="#how-it-works"
            className="whitespace-nowrap shrink-0 transition-colors duration-150 hover:text-[#F8FAFC] hover:underline underline-offset-4 decoration-[#D99B26]"
          >
            How It Works
          </a>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewCheck}
            className="min-h-[40px] rounded-lg border border-[#D99B26]/50 bg-[#D99B26]/10 px-4 py-2 text-sm font-semibold text-[#FDE68A] whitespace-nowrap shrink-0 transition-colors duration-150 hover:border-[#EAB308] hover:bg-[#D99B26]/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EAB308] cursor-pointer"
          >
            New Check
          </button>
        </div>
      </div>
    </header>
  );
}
