// Unit tests for the merged PayShield Hybrid rule engine
// (src/lib/localRules.ts — Source A's engine plus the stronger checks
// ported from Source B's src/rules.ts).
// Run with: npm test

import { describe, expect, it } from "vitest";
import {
  buildOnDeviceOpinion,
  detectAddresses,
  runLocalRules,
} from "../src/lib/localRules";
import { SAMPLE_CASES } from "../src/lib/samples";

const keys = (input: string) =>
  runLocalRules(input).findings.map((f) => f.ruleKey);
const sample = (id: string) =>
  SAMPLE_CASES.find((s) => s.id === id)!.content;

describe("official domains", () => {
  it("treats a link on the real PayPal domain as safe", () => {
    const r = runLocalRules(sample("safe"));
    expect(r.verdict).toBe("safe");
    expect(r.findings).toHaveLength(0);
    expect(
      r.passedChecks.some((c) => c.detail.includes("official PayPal")),
    ).toBe(true);
  });

  it("treats a subdomain of the official Stripe domain as safe", () => {
    const r = runLocalRules("Pay here: https://checkout.stripe.com/c/pay/abc123");
    expect(r.verdict).toBe("safe");
    expect(r.urls[0]?.isTrustedBrand).toBe(true);
    expect(r.urls[0]?.trustedBrandName).toBe("Stripe");
  });
});

describe("lookalike and link tricks", () => {
  it("flags a leetspeak lookalike of PayPal as danger", () => {
    const r = runLocalRules("https://paypa1.com/login");
    expect(r.verdict).toBe("danger");
    expect(keys("https://paypa1.com/login")).toContain("lookalike-domain");
  });

  it("flags the exact brand name on the wrong TLD as danger", () => {
    const r = runLocalRules("https://paypal.xyz/pay");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "lookalike-domain")).toBe(true);
  });

  it("flags a near-miss spelling of a brand as danger", () => {
    const r = runLocalRules("https://paypai.com/pay");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "lookalike-domain")).toBe(true);
  });

  it("flags a brand name used as a subdomain decoration as danger", () => {
    const r = runLocalRules("https://paypal.com.evil-example.com/login");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "lookalike-domain")).toBe(true);
  });

  it("flags plain http payment links as a caution", () => {
    const r = runLocalRules("http://example-pay.com/checkout");
    expect(r.findings.some((f) => f.ruleKey === "unencrypted-http")).toBe(true);
    expect(r.verdict).toBe("caution");
  });

  it("flags raw IP address links as danger (ported from Source B)", () => {
    const r = runLocalRules("https://192.168.10.55/pay");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "ip-literal")).toBe(true);
  });

  it("flags @-sign destination hiding as danger (ported from Source B)", () => {
    const r = runLocalRules("https://paypal.com@evil-example.com/pay");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "hidden-destination")).toBe(
      true,
    );
  });

  it("flags shortened links as a caution", () => {
    const r = runLocalRules("Open this: https://bit.ly/3abcXYZ");
    expect(r.findings.some((f) => f.ruleKey === "url-shortener")).toBe(true);
    expect(r.verdict).toBe("caution");
  });

  it("flags punycode domains as lookalikes", () => {
    const r = runLocalRules("https://xn--pypl-5qa.com/pay");
    expect(r.findings.some((f) => f.ruleKey === "lookalike-domain")).toBe(true);
    expect(r.verdict).toBe("danger");
  });
});

describe("message patterns", () => {
  it("flags a seed phrase request as danger", () => {
    const r = runLocalRules("Please send me your seed phrase to verify the wallet.");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "seed-phrase")).toBe(true);
  });

  it("flags send-money-first as danger (crosses the decimal in 0.05)", () => {
    const r = runLocalRules("Send 0.05 BNB first to unlock your reward.");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "advance-fee")).toBe(true);
  });

  it("flags guaranteed returns as danger", () => {
    const r = runLocalRules("Invest with us for guaranteed returns every week.");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "guaranteed-return")).toBe(true);
  });

  it("flags money-doubling offers as danger", () => {
    const r = runLocalRules("We will double your crypto in 24 hours.");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "guaranteed-return")).toBe(true);
  });

  it("flags scan-a-QR-to-receive-money as danger (ported from Source B)", () => {
    const r = runLocalRules("Scan the QR code to receive your refund now.");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "qr-receive")).toBe(true);
  });

  it("flags identity-document requests as danger (ported from Source B)", () => {
    const r = runLocalRules("Please upload your passport to complete verification.");
    expect(r.verdict).toBe("danger");
    expect(r.findings.some((f) => f.ruleKey === "id-documents")).toBe(true);
  });

  it("flags urgency pressure as a caution", () => {
    const r = runLocalRules("This is urgent, please pay right now.");
    expect(r.verdict).toBe("caution");
    expect(r.findings.some((f) => f.ruleKey === "urgency-pressure")).toBe(true);
  });

  it("flags suspension threats as a caution", () => {
    const r = runLocalRules("Your account will be suspended unless you act.");
    expect(
      r.findings.some((f) => f.ruleKey === "urgency-pressure"),
    ).toBe(true);
  });

  it("flags wallet-verification lures as a caution (ported from Source B)", () => {
    const r = runLocalRules("Validate your wallet to keep it active.");
    expect(r.verdict).toBe("caution");
    expect(r.findings.some((f) => f.ruleKey === "wallet-verify-lure")).toBe(true);
  });

  it("flags unsolicited airdrop claims as a caution (ported from Source B)", () => {
    const r = runLocalRules("Claim your airdrop reward now.");
    expect(r.findings.some((f) => f.ruleKey === "airdrop-lure")).toBe(true);
  });

  it("flags fake-support routing as a caution (ported from Source B)", () => {
    const r = runLocalRules("Our support team will message you shortly.");
    expect(
      r.findings.some((f) => f.ruleKey === "support-impersonation"),
    ).toBe(true);
  });

  it("flags gift-card payment demands as a caution (ported from Source B)", () => {
    const r = runLocalRules("Pay the fine with gift cards.");
    expect(r.findings.some((f) => f.ruleKey === "gift-card-wire")).toBe(true);
  });

  it("flags secrecy coaching as a caution (ported from Source B)", () => {
    const r = runLocalRules("Do not tell anyone about this payment.");
    expect(r.findings.some((f) => f.ruleKey === "secrecy-demand")).toBe(true);
  });

  it("leaves a plain, harmless message safe", () => {
    const r = runLocalRules("Lunch tomorrow at 1? I will bring the invoices.");
    expect(r.verdict).toBe("safe");
    expect(r.findings).toHaveLength(0);
    expect(r.passedChecks.length).toBeGreaterThanOrEqual(4);
  });
});

describe("crypto addresses (ported from Source B)", () => {
  const EVM = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const BTC = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
  const SOL = "7Yowk46VwwH1bRqR23y5KtoEvf3Qnzp9yp1t6a5nVb";

  it("detects an EVM address", () => {
    expect(detectAddresses(`pay to ${EVM} please`)).toEqual([
      { raw: EVM, kind: "evm" },
    ]);
  });

  it("detects a Bitcoin address", () => {
    expect(detectAddresses(BTC)).toEqual([{ raw: BTC, kind: "bitcoin" }]);
  });

  it("detects a Solana-style address", () => {
    expect(detectAddresses(SOL)).toEqual([{ raw: SOL, kind: "solana" }]);
  });

  it("never calls a bare address safe — caution with honest guidance", () => {
    const r = runLocalRules(EVM);
    expect(r.verdict).toBe("caution");
    expect(r.addresses).toEqual([{ raw: EVM, kind: "evm" }]);
    expect(r.findings.some((f) => f.ruleKey === "crypto-address")).toBe(true);
  });

  it("does not double-report an address that is part of a URL", () => {
    const r = runLocalRules(`https://example.com/pay/${EVM}`);
    expect(r.addresses).toHaveLength(0);
    expect(r.findings.some((f) => f.ruleKey === "crypto-address")).toBe(false);
  });

  it("still catches scam wording wrapped around an address", () => {
    const r = runLocalRules(
      `Send 0.1 ETH first to verify, address ${EVM}, guaranteed returns!`,
    );
    expect(r.verdict).toBe("danger");
    expect(r.addresses).toHaveLength(1);
  });
});

describe("bundled samples", () => {
  it("scores every sample at its expected verdict", () => {
    for (const s of SAMPLE_CASES) {
      expect(runLocalRules(s.content).verdict).toBe(s.expectedVerdict);
    }
  });

  it("scores the suspicious sample as caution with shortener + urgency flags", () => {
    const r = runLocalRules(sample("suspicious"));
    expect(r.verdict).toBe("caution");
    expect(r.findings.some((f) => f.ruleKey === "url-shortener")).toBe(true);
    expect(r.findings.some((f) => f.ruleKey === "urgency-pressure")).toBe(true);
  });

  it("scores the obvious scam sample as danger with at least 3 danger findings", () => {
    const r = runLocalRules(sample("scam"));
    expect(r.verdict).toBe("danger");
    expect(
      r.findings.filter((f) => f.severity === "danger").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("reports the full merged rule count", () => {
    expect(runLocalRules("anything").checkedRuleCount).toBe(18);
  });
});

describe("buildOnDeviceOpinion", () => {
  it("mirrors a danger local verdict", () => {
    const opinion = buildOnDeviceOpinion(runLocalRules(sample("scam")), "note");
    expect(opinion.verdict).toBe("danger");
    expect(opinion.source).toBe("on-device");
  });

  it("mirrors a safe local verdict", () => {
    const opinion = buildOnDeviceOpinion(runLocalRules(sample("safe")), "note");
    expect(opinion.verdict).toBe("safe");
    expect(opinion.source).toBe("on-device");
  });
});
