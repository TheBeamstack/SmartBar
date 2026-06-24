/**
 * P3 store: the element/scheme catalog (§5.3) and user-added supplements (§5.5). Switching the
 * element or scheme re-solves through the generic engine; adding a supplement binds it to base
 * bars and a broken binding surfaces a WARN.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";

const rules = () => useStore.getState().result.validation.map((v) => v.rule);

describe("element + scheme catalog", () => {
  beforeEach(() => useStore.getState().reset());

  it("starts on the reference column", () => {
    expect(useStore.getState().doc.element).toBe("E-COL-01");
    expect(rules()).toContain("provided_area");
  });

  it("selecting the beam re-solves through the BAEL_BEAM profile", () => {
    useStore.getState().selectElement("E-BEM-01");
    const st = useStore.getState();
    expect(st.doc.element).toBe("E-BEM-01");
    expect(st.result.status).not.toBe("FAIL");
    expect(rules()).toContain("provided_area:As_span_bottom");
    expect(rules()).toContain("provided_area:As_top_support");
    expect(rules()).toContain("stirrup_spacing:Asw_shear");
    expect(rules()).toContain("end_support_anchorage");
  });

  it("switching to the simple-span scheme drops the chapeau zone but keeps geometry", () => {
    useStore.getState().selectElement("E-BEM-01");
    useStore.getState().setBeamGeometry({ b: 350 });
    useStore.getState().selectScheme("BEAM_SPAN_SIMPLE");
    const st = useStore.getState();
    expect(st.doc.geometry.b).toBe(350); // project edits preserved across the remap
    expect(rules()).not.toContain("provided_area:As_top_support");
    expect(rules()).toContain("provided_area:As_span_bottom");
  });

  it("returning to the column re-solves the column profile", () => {
    useStore.getState().selectElement("E-BEM-01");
    useStore.getState().selectElement("E-COL-01");
    expect(useStore.getState().doc.element).toBe("E-COL-01");
    expect(rules()).toContain("provided_area");
  });
});

describe("supplements (§5.5)", () => {
  beforeEach(() => useStore.getState().reset());

  it("adding an épingle bound to valid bars renders it and stays PASS", () => {
    useStore.getState().addSupplement({
      instanceId: "e1",
      supplementId: "SUPP_EPINGLE_CROSSTIE",
      group: "L1",
      barIndices: [0, 2],
      diameter: 8,
    });
    const st = useStore.getState();
    expect(st.result.groups.some((g) => g.groupId === "e1")).toBe(true);
    expect(st.result.validation.some((v) => v.rule === "supplement:e1")).toBe(false);
  });

  it("a broken binding (deleted base bar) surfaces a WARN row to rebind", () => {
    useStore.getState().addSupplement({
      instanceId: "e2",
      supplementId: "SUPP_EPINGLE_CROSSTIE",
      group: "L1",
      barIndices: [0, 99], // index 99 does not exist
      diameter: 8,
    });
    const warn = useStore.getState().result.validation.find((v) => v.rule === "supplement:e2");
    expect(warn?.status).toBe("WARN");
    // rebinding to existing bars clears the warning
    useStore.getState().rebindSupplement("e2", [0, 2]);
    expect(useStore.getState().result.validation.find((v) => v.rule === "supplement:e2")).toBeUndefined();
  });

  it("removeSupplement drops the add-on", () => {
    useStore.getState().addSupplement({
      instanceId: "e3",
      supplementId: "SUPP_EPINGLE_CROSSTIE",
      group: "L1",
      barIndices: [0, 2],
      diameter: 8,
    });
    useStore.getState().removeSupplement("e3");
    expect(useStore.getState().result.groups.some((g) => g.groupId === "e3")).toBe(false);
  });
});
