export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="border-t border-[#1E2430] pt-12 pb-6"
    >
      <div className="max-w-2xl">
        <h2
          id="how-it-works-heading"
          className="text-2xl font-bold tracking-tight text-[#F8FAFC]"
          style={{ textWrap: 'balance' }}
        >
          How PayShield Hybrid protects your privacy
        </h2>
        <p className="mt-2 text-sm sm:text-[15px] leading-relaxed text-[#9CA3AF]">
          Every link and payment message is checked privately on your device first. Cloud AI acts
          strictly as a second opinion—and you stay in control of whether anything ever leaves your
          browser.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-[#232936] bg-[#12161E] p-5">
          <p className="font-mono text-xs font-medium text-[#EAB308]">01. On-device first</p>
          <h3 className="mt-2 text-base font-semibold text-[#F8FAFC]">
            Instant browser rule checks
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
            Deterministic rules immediately inspect lookalike brand domains, unencrypted
            links, URL shorteners, risky domain endings, seed-phrase traps, urgency pressure,
            raw-IP and @-hidden destinations, and unverifiable crypto addresses
            without sending data over the network.
          </p>
        </div>

        <div className="rounded-xl border border-[#232936] bg-[#12161E] p-5">
          <p className="font-mono text-xs font-medium text-[#EAB308]">02. Second opinion</p>
          <h3 className="mt-2 text-base font-semibold text-[#F8FAFC]">
            Firebase AI Logic hybrid inference
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
            The second opinion runs through Firebase AI Logic: Gemini Nano answers on your
            device when Chrome supports it, and a cloud Gemini model steps in automatically
            when it can&apos;t — the panel always shows which one answered. In Hybrid mode,
            obvious scams already caught locally never leave your device at all.
          </p>
        </div>

        <div className="rounded-xl border border-[#232936] bg-[#12161E] p-5">
          <p className="font-mono text-xs font-medium text-[#EAB308]">03. Stricter wins</p>
          <h3 className="mt-2 text-base font-semibold text-[#F8FAFC]">
            Conservative final verdict
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">
            Your top banner combines both checks using a strict-first rule: Danger overrides
            Caution, and Caution overrides Safe. Switch to On-device only anytime for zero cloud
            requests.
          </p>
        </div>
      </div>
    </section>
  );
}
