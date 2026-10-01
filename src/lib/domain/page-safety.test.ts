import { describe, expect, it } from "vitest";
import { contrastRatio, enforceAccessibleTheme } from "./page-safety";
import { pageSpecSchema } from "./schemas";

describe("generated page safety", () => {
  it("repairs model themes that would make text or buttons unreadable", () => {
    const page = pageSpecSchema.parse({
      version: 1,
      brandName: "Contrast Test",
      theme: { accent: "#ffff00", surface: "#ffffff", ink: "#eeeeee" },
      hero: { eyebrow: "Test", headline: "Readable solution", subheadline: "Accessible output", primaryAction: "Start" },
      sections: [{ id: "why", type: "narrative", heading: "Why", body: "Readable content" }],
      approvedWorkerIds: ["content-executive"],
      media: [],
    });
    const safe = enforceAccessibleTheme(page);
    expect(contrastRatio(safe.theme.ink, safe.theme.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(safe.theme.accent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
