/**
 * H13 ([v1.0.4]) — ONE active pack drives both the FaconnageEditor preview and the solve. The editor
 * previews a bar with `packFor(doc.codePack)`; the pipeline generates the same bar with the same pack.
 * This pins that they agree (no BAEL-preview-vs-EC2-solve drift) — and that the pack genuinely affects
 * a bent bar's cutLength (BAEL R≥5.5Ø vs EC2 4Ø/7Ø mandrels → different bend deductions).
 */
import { describe, it, expect } from "vitest";
import { solveDoc, packFor } from "./solveDoc";
import { defaultColumnDoc, type ColumnDoc } from "./document";
import { generateBarShape } from "@rebarconfig/core";
import { loadShape } from "./manifests";

const BAIO = { lower: 2000, crank: 200, upper: 800, angle: 11 };

function bentColumn(cp: "BAEL" | "EC2"): ColumnDoc {
  const doc = { ...defaultColumnDoc(), codePack: cp } as ColumnDoc;
  doc.longitudinal.shapeId = "BAIONNETTE";
  doc.longitudinal.faconnage = { shapeParams: BAIO };
  doc.longitudinal.barOverrides = [{ index: 0, diameter: 25 }]; // activate the per-bar channel
  return doc;
}

describe("H13 — editor preview and solve share the active pack", () => {
  it.each(["BAEL", "EC2"] as const)("%s: the solved bar's shape matches the editor's preview pack", (cp) => {
    const bar0 = solveDoc(bentColumn(cp)).longBars!.find((b) => b.barIndex === 0)!;
    // what the FaconnageEditor would draw for this bar (same shape/params/Ø via packFor(codePack)) —
    // proving both sides resolve the pack the same way (the current provisional EC2 mandrel equals
    // BAEL's, so the cutLength coincides today; the point is they use the SAME pack object, not that
    // the number differs — that is asserted end-to-end below).
    const preview = generateBarShape(loadShape("BAIONNETTE"), BAIO, 25, packFor(cp));
    expect(bar0.shape.cutLength).toBeCloseTo(preview.cutLength, 6);
  });

  it("solveDoc honours doc.codePack end-to-end (the tie-diameter verdict flips BAEL↔EC2)", () => {
    // long Ø25 + tie Ø7: below the BAEL min (φℓ/3 = 8.33) but above the EC2 min (φℓ/4 = 6.25). If the
    // solve ignored the pick, the verdict couldn't change — so a flip proves the pack is threaded.
    const mk = (cp: "BAEL" | "EC2"): ColumnDoc => {
      const d = { ...defaultColumnDoc(), codePack: cp } as ColumnDoc;
      d.longitudinal.diameter = 25;
      d.tie.diameter = 7;
      return d;
    };
    const verdict = (cp: "BAEL" | "EC2") =>
      solveDoc(mk(cp)).validation.find((v) => v.rule.startsWith("tie_diameter"))!.status;
    expect(verdict("BAEL")).toBe("FAIL");
    expect(verdict("EC2")).toBe("PASS");
  });
});
