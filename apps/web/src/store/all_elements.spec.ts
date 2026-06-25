/**
 * B (P6 UI): the SPA now exposes all eight §3.1 elements (not just column + beam). Selecting any
 * element re-solves through the right core orchestrator and yields a renderable result with a sane
 * default that is not a hard FAIL. Covers the generic doc → solveDoc marshalling (circular / slab /
 * joist / stair) + the seismic overlay wiring on the column/beam.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { ElementId } from "../engine/document";

const ELEMENTS: ElementId[] = [
  "E-COL-01", "E-BEM-01", "E-COL-02", "E-FND-01", "E-SLB-01", "E-SLB-02", "E-SLB-03", "E-STR-01",
];

describe("full element catalog (all 8 §3.1 elements)", () => {
  beforeEach(() => useStore.getState().reset());

  for (const el of ELEMENTS) {
    it(`${el}: selects, solves, renders bars, and is not a hard FAIL by default`, () => {
      useStore.getState().selectElement(el);
      const st = useStore.getState();
      expect(st.doc.element).toBe(el);
      expect(st.result.element).toBe(el);
      expect(st.result.groups.length).toBeGreaterThan(0);
      expect(st.result.bars.length).toBeGreaterThan(0);
      expect(st.result.member).toBeDefined();
      expect(st.result.status).not.toBe("FAIL");
      // the auto-managed default coupe is re-seeded against the new member
      expect(st.cuts.length).toBeGreaterThan(0);
    });
  }

  it("circular column uses a CIRCULAR envelope; slab uses a RECT envelope", () => {
    useStore.getState().selectElement("E-COL-02");
    expect(useStore.getState().result.member.envelope).toBe("CIRCULAR");
    useStore.getState().selectElement("E-SLB-01");
    expect(useStore.getState().result.member.envelope).toBe("RECT");
  });

  it("editing a generic zone's spacing re-solves (more steel at tighter spacing)", () => {
    useStore.getState().selectElement("E-SLB-01");
    const grpId = (useStore.getState().doc as { zones: { groupId: string }[] }).zones[0]!.groupId;
    const before = asProvOf("As_main_bottom");
    useStore.getState().setZone(grpId, { spacing: 100 });
    const after = asProvOf("As_main_bottom");
    expect(after).toBeGreaterThan(before);
  });

  it("turning on the seismic regime adds RPS overlay checks to the column", () => {
    useStore.getState().reset();
    const ruleCountBefore = useStore.getState().result.validation.length;
    useStore.getState().setSeismic({ code: "RPS-2011", zone: 2, ductility: "ND2" });
    const st = useStore.getState();
    expect(st.result.seismic).toBeDefined();
    expect(st.result.validation.length).toBeGreaterThan(ruleCountBefore);
  });
});

function asProvOf(zone: string): number {
  const v = useStore.getState().result.validation.find((x) => x.rule === `provided_area:${zone}`);
  return typeof v?.value === "number" ? v.value : 0;
}
