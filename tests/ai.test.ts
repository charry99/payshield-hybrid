// Unit tests for the tolerant AI-response parser (src/lib/ai.ts).
// Small on-device models do not always emit perfect JSON, so the parser
// must degrade gracefully. Run with: npm test

import { describe, expect, it } from "vitest";
import { parseOpinion } from "../src/lib/ai";

describe("parseOpinion", () => {
  it("parses a well-formed JSON opinion", () => {
    const parsed = parseOpinion(
      JSON.stringify({
        verdict: "danger",
        headline: "Clear impersonation attempt",
        explanation: "The link imitates PayPal on a fake domain.",
        keyRisks: ["Lookalike domain", "Seed phrase request"],
        recommendedAction: "Delete the message.",
      }),
      "safe",
    );
    expect(parsed.verdict).toBe("danger");
    expect(parsed.headline).toBe("Clear impersonation attempt");
    expect(parsed.keyRisks).toEqual(["Lookalike domain", "Seed phrase request"]);
    expect(parsed.recommendedAction).toBe("Delete the message.");
  });

  it("accepts a 'reasons' array in place of 'keyRisks' and caps it at 4", () => {
    const parsed = parseOpinion(
      JSON.stringify({
        verdict: "caution",
        explanation: "Some signals are off.",
        reasons: ["a", "b", "c", "d", "e"],
      }),
      "safe",
    );
    expect(parsed.verdict).toBe("caution");
    expect(parsed.keyRisks).toEqual(["a", "b", "c", "d"]);
    expect(parsed.headline.length).toBeGreaterThan(0);
    expect(parsed.recommendedAction.length).toBeGreaterThan(0);
  });

  it("finds the JSON object inside surrounding prose", () => {
    const parsed = parseOpinion(
      'Here is my review: {"verdict": "safe", "explanation": "Looks normal."} Hope that helps!',
      "danger",
    );
    expect(parsed.verdict).toBe("safe");
    expect(parsed.explanation).toBe("Looks normal.");
  });

  it("falls back to the rule verdict for an invalid verdict value", () => {
    const parsed = parseOpinion('{"verdict": "maybe"}', "caution");
    expect(parsed.verdict).toBe("caution");
    expect(parsed.explanation).toContain("maybe");
  });

  it("falls back to the rule verdict for plain-text answers", () => {
    const parsed = parseOpinion(
      "This looks like a phishing attempt because the domain is fake.",
      "danger",
    );
    expect(parsed.verdict).toBe("danger");
    expect(parsed.explanation).toContain("phishing attempt");
    expect(parsed.keyRisks).toEqual([]);
  });
});
