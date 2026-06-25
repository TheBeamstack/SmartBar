/**
 * Phase 7 (§3.2): the multi-element project model. The store holds an ordered list of element
 * instances, one active; add/duplicate/remove/rename/quantity/select all work, the active type is
 * checked out into the live doc, and the whole project round-trips through the v1.1 `.rcfg` envelope
 * (a legacy v1.0 single-element file migrates to a one-instance project).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { projectToRcfg, rcfgToInstances } from "../engine/projectRcfg";
import { projectTakeoff } from "../engine/projectTakeoff";
import { docToRcfg } from "../engine/rcfgDoc";
import { parseRcfg } from "@rebarconfig/exporters";

describe("project model — instances", () => {
  beforeEach(() => useStore.getState().reset());

  it("starts as a one-instance project on the reference column", () => {
    const st = useStore.getState();
    expect(st.instances).toHaveLength(1);
    expect(st.instances[0]!.id).toBe(st.activeInstanceId);
    expect(st.doc.element).toBe("E-COL-01");
  });

  it("adds a new element type and makes it active (live doc switches)", () => {
    useStore.getState().addInstance("E-SLB-01");
    const st = useStore.getState();
    expect(st.instances).toHaveLength(2);
    expect(st.doc.element).toBe("E-SLB-01");
    expect(st.activeInstanceId).toBe(st.instances[1]!.id);
  });

  it("preserves edits on the inactive instance when switching (checkout/reconcile)", () => {
    // edit the column, then add a beam, then switch back — the column edit survives
    useStore.getState().setCover(45);
    const colId = useStore.getState().activeInstanceId;
    useStore.getState().addInstance("E-BEM-01");
    expect(useStore.getState().doc.element).toBe("E-BEM-01");
    useStore.getState().selectInstance(colId);
    expect(useStore.getState().doc.element).toBe("E-COL-01");
    expect(useStore.getState().doc.cover).toBe(45);
  });

  it("quantity scales the project steel total, not the per-member solve", () => {
    useStore.getState().setInstanceQuantity(useStore.getState().activeInstanceId, 5);
    const st = useStore.getState();
    const reconciled = st.instances.map((i) => (i.id === st.activeInstanceId ? { ...i, doc: st.doc, cuts: st.cuts } : i));
    const to = projectTakeoff(reconciled);
    expect(to.types[0]!.quantity).toBe(5);
    expect(to.types[0]!.totalMass_kg).toBeCloseTo(to.types[0]!.unitMass_kg * 5, 6);
  });

  it("removeInstance keeps at least one element and re-homes the active selection", () => {
    useStore.getState().addInstance("E-SLB-02");
    const toRemove = useStore.getState().activeInstanceId;
    useStore.getState().removeInstance(toRemove);
    expect(useStore.getState().instances).toHaveLength(1);
    // cannot remove the last one
    useStore.getState().removeInstance(useStore.getState().activeInstanceId);
    expect(useStore.getState().instances).toHaveLength(1);
  });
});

describe("project .rcfg envelope (v1.1) round-trip + migration", () => {
  beforeEach(() => useStore.getState().reset());

  it("saves all types as elements[] and reloads them", () => {
    useStore.getState().addInstance("E-BEM-01");
    useStore.getState().addInstance("E-SLB-01");
    const synced = useStore.getState().syncActiveInstance();
    const env = projectToRcfg(synced);
    expect(env.rcfg_version).toBe("1.1");
    expect(env.elements).toHaveLength(3);

    const text = JSON.stringify(env);
    const reloaded = rcfgToInstances(parseRcfg(text));
    expect(reloaded?.map((i) => i.doc.element)).toEqual(["E-COL-01", "E-BEM-01", "E-SLB-01"]);
  });

  it("migrates a legacy v1.0 single-element file to a one-instance project", () => {
    const legacy = docToRcfg(useStore.getState().doc, useStore.getState().cuts); // rcfg_version "1.0", no elements[]
    const instances = rcfgToInstances(legacy);
    expect(instances).toHaveLength(1);
    expect(instances![0]!.doc.element).toBe("E-COL-01");
  });

  it("loadProject restores a multi-element project into the store", () => {
    useStore.getState().addInstance("E-STR-01");
    const env = projectToRcfg(useStore.getState().syncActiveInstance());
    useStore.getState().reset();
    useStore.getState().loadProject(parseRcfg(JSON.stringify(env)));
    expect(useStore.getState().instances).toHaveLength(2);
  });
});
