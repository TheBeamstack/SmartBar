/**
 * v1.0.5 P1b (audit A2) — placement is decoupled from addressable *validation* activation.
 *
 * Forcing the per-bar `longBars` path for a default two-chapeau beam (D1/D2) must NOT silently switch
 * on the addressable As/`d` reconciliation, the `placedCount`/`face_min_bars` path, the
 * `validateAddressableBars` predicates, or the station-aware default coupe. Those stay gated on REAL
 * user content (`hasUserAddressableContent`), so a plain default beam's validation list + default coupe
 * are byte-identical to the pre-v1.0.5 grouped solve — only the drawing changed (both chapeaux appear).
 */
import { describe, it, expect } from "vitest";
import { solveDoc } from "../apps/web/src/engine/solveDoc";
import { defaultBeamDoc, type BeamDoc } from "../apps/web/src/engine/document";
import { defaultCoupeFor } from "@rebarconfig/core";

const L = 6000;
const ADDRESSABLE_RULES = ["addressable_axial_extent", "addressable_section_bounds", "addressable_clear_spacing"];

describe("P1b — a default multi-zone beam gains NO addressable validation", () => {
  it("emits longBars for placement but carries no addressable-validity items", () => {
    const r = solveDoc(defaultBeamDoc());
    expect(r.longBars).toBeDefined();
    const rules = r.validation.map((v) => v.rule);
    for (const a of ADDRESSABLE_RULES) {
      expect(rules.some((x) => x.startsWith(a))).toBe(false);
    }
  });

  it("keeps its default coupe at mid-length (station-aware is gated on user content, not longBars)", () => {
    const r = solveDoc(defaultBeamDoc());
    expect(defaultCoupeFor(r).origin.y).toBe(L / 2);
  });

  it("end-support anchorage stays PASS on the full-length default span (real runs-through geometry)", () => {
    const r = solveDoc(defaultBeamDoc());
    const es = r.validation.find((v) => v.rule === "end_support_anchorage")!;
    expect(es.status).toBe("PASS");
  });

  it("a REAL user override DOES turn the addressable channel on (contrast)", () => {
    const doc: BeamDoc = {
      ...defaultBeamDoc(),
      extraBars: [{ id: "X1", u: 0, v: 240, shapeId: "DROITE", diameter: 16, length: 1000, axialPos: 5000 }],
    };
    const r = solveDoc(doc);
    expect(r.hasUserAddressableContent).toBe(true);
    // the station-aware default coupe now shifts off mid-length to reveal the offset extra
    expect(defaultCoupeFor(r).origin.y).not.toBe(L / 2);
  });
});
