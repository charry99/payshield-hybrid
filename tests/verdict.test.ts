// Unit tests for the stricter-verdict-wins combination rule
// (src/lib/verdict.ts). Run with: npm test

import { describe, expect, it } from "vitest";
import { combineVerdicts, verdictLabel } from "../src/lib/verdict";

describe("combineVerdicts", () => {
  it("returns the local verdict when there is no AI verdict", () => {
    expect(combineVerdicts("safe")).toBe("safe");
    expect(combineVerdicts("caution", null)).toBe("caution");
    expect(combineVerdicts("danger", undefined)).toBe("danger");
  });

  it("lets the stricter verdict win in both directions", () => {
    expect(combineVerdicts("safe", "caution")).toBe("caution");
    expect(combineVerdicts("caution", "safe")).toBe("caution");
    expect(combineVerdicts("safe", "danger")).toBe("danger");
    expect(combineVerdicts("danger", "safe")).toBe("danger");
    expect(combineVerdicts("caution", "danger")).toBe("danger");
    expect(combineVerdicts("danger", "caution")).toBe("danger");
  });

  it("keeps equal verdicts unchanged", () => {
    expect(combineVerdicts("safe", "safe")).toBe("safe");
    expect(combineVerdicts("caution", "caution")).toBe("caution");
    expect(combineVerdicts("danger", "danger")).toBe("danger");
  });
});

describe("verdictLabel", () => {
  it("labels every verdict", () => {
    expect(verdictLabel("safe")).toBe("Safe");
    expect(verdictLabel("caution")).toBe("Caution");
    expect(verdictLabel("danger")).toBe("Danger");
  });
});
