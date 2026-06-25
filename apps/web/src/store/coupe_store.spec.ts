/**
 * P5 store: coupe management (§9.5) + project I/O (§10). The store seeds the default representative
 * coupe, lets the user add/remove/place additional cuts, and round-trips the whole editable state
 * through a `.rcfg` project (docToRcfg → parseRcfg/serializeRcfg → loadProject) losslessly.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { serializeRcfg, parseRcfg } from "@rebarconfig/exporters";
import { useStore } from "./useStore";
import { docToRcfg } from "../engine/rcfgDoc";
import type { SectionCut } from "@rebarconfig/core";

const newCut = (id: string, y: number): SectionCut => ({
  id,
  label_fr: `Coupe ${id}-${id}`,
  origin: { x: 0, y, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
  isDefault: false,
});

describe("coupe manager store (§9.5)", () => {
  beforeEach(() => useStore.getState().reset());

  it("seeds exactly one default representative coupe and selects it", () => {
    const st = useStore.getState();
    expect(st.cuts).toHaveLength(1);
    expect(st.cuts[0]!.isDefault).toBe(true);
    expect(st.activeCutId).toBe(st.cuts[0]!.id);
  });

  it("adds, selects, edits and removes a user coupe", () => {
    useStore.getState().addCut(newCut("B", 500));
    expect(useStore.getState().cuts).toHaveLength(2);
    expect(useStore.getState().activeCutId).toBe("B");

    useStore.getState().updateCut("B", { origin: { x: 0, y: 1200, z: 0 } });
    const cut = useStore.getState().cuts.find((c) => c.id === "B")!;
    expect((cut.origin as { y: number }).y).toBe(1200);

    useStore.getState().removeCut("B");
    expect(useStore.getState().cuts).toHaveLength(1);
    expect(useStore.getState().activeCutId).toBe(useStore.getState().cuts[0]!.id);
  });

  it("never removes the auto-managed default coupe", () => {
    const defId = useStore.getState().cuts[0]!.id;
    useStore.getState().removeCut(defId);
    expect(useStore.getState().cuts).toHaveLength(1);
    expect(useStore.getState().cuts[0]!.isDefault).toBe(true);
  });

  it("preserves user cuts across geometry edits but drops them on element switch", () => {
    useStore.getState().addCut(newCut("B", 500));
    useStore.getState().setGeometry({ b: 350 });
    expect(useStore.getState().cuts.some((c) => c.id === "B")).toBe(true); // geometry edit keeps cuts

    useStore.getState().selectElement("E-BEM-01");
    expect(useStore.getState().cuts).toHaveLength(1); // element switch re-seeds, drops user cuts
    expect(useStore.getState().cuts[0]!.isDefault).toBe(true);
  });
});

describe("project I/O round-trip (§10)", () => {
  beforeEach(() => useStore.getState().reset());

  it("docToRcfg → serialize → parse → loadProject restores the doc + user cuts", () => {
    useStore.getState().setGeometry({ b: 350, h: 700 });
    useStore.getState().addCut(newCut("B", 800));
    const before = useStore.getState();

    const project = docToRcfg(before.doc, before.cuts, { projectName: "Tour A" });
    const text = serializeRcfg(project);

    // simulate a fresh session
    useStore.getState().reset();
    useStore.getState().loadProject(parseRcfg(text));

    const after = useStore.getState();
    expect(after.doc.element).toBe("E-COL-01");
    expect(after.doc.geometry).toMatchObject({ b: 350, h: 700 });
    expect(after.cuts.some((c) => c.id === "B")).toBe(true);
  });

  it("preserves unknown top-level fields + unknown cut fields on round-trip (forward-compat)", () => {
    const st = useStore.getState();
    const project = docToRcfg(st.doc, [
      ...st.cuts,
      { ...newCut("B", 400), futureField: "keep-me" },
    ]);
    (project as Record<string, unknown>)["x_future"] = { hello: 1 };

    const back = parseRcfg(serializeRcfg(project));
    expect((back as Record<string, unknown>)["x_future"]).toEqual({ hello: 1 });
    const cutB = back.section_cuts!.find((c) => c.id === "B")!;
    expect(cutB["futureField"]).toBe("keep-me");
  });

  it("ignores a project with no recoverable app_document (other-tool file)", () => {
    const st = useStore.getState();
    const project = docToRcfg(st.doc, st.cuts);
    delete (project.meta as Record<string, unknown>)["app_document"];
    const before = useStore.getState().doc;
    useStore.getState().loadProject(project);
    expect(useStore.getState().doc).toBe(before); // unchanged
  });
});
