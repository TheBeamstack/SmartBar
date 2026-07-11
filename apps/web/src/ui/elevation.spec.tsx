/**
 * v1.0.6 N6 / Track U5 ([REF-UI-811]) — the EDITABLE elevation. Per spec §0.4 the pure hit-test / coord
 * / snap helpers + the store station-model actions + the inspector's numeric twins are the HEADLESS gate
 * (the on-canvas pointer drag is owner-GPU-verified — `getScreenCTM` is null under jsdom). This suite
 * covers: (1) the pure transform ⇄ station ⇄ snap helpers; (2) the doc readers; (3) the store actions
 * that a drag AND its numeric twin both commit through (curtailment / anchorage / splices / zone
 * boundaries / relevé bend); (4) the inspector twin round-trips to the store == the drawing gesture.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, within, fireEvent } from "@testing-library/react";
import type { ElevationFiche } from "@rebarconfig/exporters";
import {
  fitElevation,
  stationFromDrawing,
  snapStation,
  screenToStation,
  selectedBarStations,
  memberRunLength,
} from "../engine/elevation";
import { defaultColumnDoc, defaultBeamDoc } from "../engine/document";
import { effectiveRegions } from "../engine/regions";
import { useStore } from "../store/useStore";
import { Sidebar } from "./Sidebar";
import { SectionDock } from "./SectionDock";
import { ElevationDock } from "./ElevationDock";

const fiche = (attitude: ElevationFiche["attitude"], maxX = 6000, maxY = 600): ElevationFiche => ({
  attitude,
  bbox: { minX: 0, minY: 0, maxX, maxY },
  concrete: [],
  bars: [],
  marks: [],
  tieCallouts: [],
  dims: [],
});

describe("v1.0.6 U5 — pure elevation coord/snap helpers", () => {
  it("fitElevation.toDrawing is the exact inverse of (px,py)", () => {
    const tr = fitElevation(fiche("HORIZONTAL"), { W: 640, H: 240, pad: 26 });
    for (const [x, y] of [[0, 0], [3000, 300], [6000, 600]] as const) {
      const back = tr.toDrawing(tr.px(x), tr.py(y));
      expect(back.x).toBeCloseTo(x, 3);
      expect(back.y).toBeCloseTo(y, 3);
    }
  });

  it("stationFromDrawing reads the member axis per attitude (x for beam, y for column)", () => {
    expect(stationFromDrawing("HORIZONTAL", 1200, 40)).toBe(1200);
    expect(stationFromDrawing("FLAT", 1200, 40)).toBe(1200);
    expect(stationFromDrawing("VERTICAL", 40, 1500)).toBe(1500); // a column runs up drawing-y
  });

  it("snapStation clamps into [0,L] and snaps to the grid", () => {
    expect(snapStation(1234, 6000, 10)).toBe(1230);
    expect(snapStation(-50, 6000, 10)).toBe(0);
    expect(snapStation(9999, 6000, 10)).toBe(6000);
    expect(snapStation(1237, 6000, 50)).toBe(1250);
  });

  it("screenToStation maps a pointer at the member mid to ~mid station", () => {
    const f = fiche("HORIZONTAL");
    const tr = fitElevation(f, { W: 640, H: 240, pad: 26 });
    const midScreenX = tr.px(3000);
    const midScreenY = tr.py(300);
    expect(screenToStation(f, tr, midScreenX, midScreenY, 6000, 10)).toBe(3000);
    // past the far end clamps to L
    expect(screenToStation(f, tr, tr.px(9000), midScreenY, 6000, 10)).toBe(6000);
  });
});

describe("v1.0.6 U5 — selectedBarStations doc reader", () => {
  it("an uncurtailed selected group bar reads the full run [0, L]", () => {
    const doc = defaultColumnDoc();
    const st = selectedBarStations(doc, { kind: "bar", index: 0 });
    expect(st).not.toBeNull();
    expect(st!.start).toBe(0);
    expect(st!.end).toBe(doc.geometry.H);
    expect(st!.memberLen).toBe(doc.geometry.H);
    expect(st!.curtailed).toBe(false);
    expect(st!.splices).toEqual([]);
  });

  it("reads an override's explicit curtailment + an extra's stations", () => {
    const doc = defaultBeamDoc();
    doc.span.barOverrides = [{ index: 1, endStation: 4000, splices: [{ at: 2000, kind: "lap" }] }];
    const st = selectedBarStations(doc, { kind: "bar", index: 1 });
    expect(st!.end).toBe(4000);
    expect(st!.curtailed).toBe(true);
    expect(st!.splices).toHaveLength(1);

    doc.extraBars = [{ id: "x1", u: 0, v: 0, shapeId: "DROITE", diameter: 12, startStation: 500 }];
    const se = selectedBarStations(doc, { kind: "extra", id: "x1" });
    expect(se!.start).toBe(500);
    expect(se!.curtailed).toBe(true);
  });

  it("returns null for a non-bar selection", () => {
    expect(selectedBarStations(defaultColumnDoc(), { kind: "alert" })).toBeNull();
    expect(selectedBarStations(defaultColumnDoc(), null)).toBeNull();
  });

  it("memberRunLength = column height / beam span", () => {
    expect(memberRunLength(defaultColumnDoc())).toBe(3000);
    expect(memberRunLength(defaultBeamDoc())).toBe(6000);
  });
});

describe("v1.0.6 U5 — store station-model actions (drag + numeric twin share these)", () => {
  beforeEach(() => useStore.getState().reset());

  it("curtailSelectedBar sets & clears the selected group bar's stations, re-solving clean", () => {
    useStore.getState().select({ kind: "bar", index: 0 });
    useStore.getState().curtailSelectedBar("end", 2000);
    let ov = (useStore.getState().doc as ReturnType<typeof defaultColumnDoc>).longitudinal.barOverrides;
    expect(ov).toEqual([{ index: 0, endStation: 2000 }]);
    expect(useStore.getState().solveError).toBeNull(); // the curtailed bar solves (renders + schedules)

    // undefined clears the field (byte-identical to an uncurtailed bar)
    useStore.getState().curtailSelectedBar("end", undefined);
    ov = (useStore.getState().doc as ReturnType<typeof defaultColumnDoc>).longitudinal.barOverrides;
    expect(ov![0]!.endStation).toBeUndefined();
  });

  it("anchorage + splices commit onto the selected bar", () => {
    useStore.getState().select({ kind: "bar", index: 0 });
    useStore.getState().setSelectedBarAnchorage("hook");
    useStore.getState().addSelectedBarSplice(1500, "lap");
    useStore.getState().addSelectedBarSplice(1500, "coupler"); // same station replaces (dedup)
    const ov = (useStore.getState().doc as ReturnType<typeof defaultColumnDoc>).longitudinal.barOverrides![0]!;
    expect(ov.anchorage).toBe("hook");
    expect(ov.splices).toEqual([{ at: 1500, kind: "coupler" }]);

    useStore.getState().removeSelectedBarSplice(1500);
    const ov2 = (useStore.getState().doc as ReturnType<typeof defaultColumnDoc>).longitudinal.barOverrides![0]!;
    expect(ov2.splices).toBeUndefined(); // empty → field cleared
  });

  it("moveStirrupRegionBoundary edits regions == the RegionEditor normalize path", () => {
    useStore.getState().selectElement("E-BEM-01");
    useStore.getState().seedStirrupRegions();
    const doc0 = useStore.getState().doc as ReturnType<typeof defaultBeamDoc>;
    const before = effectiveRegions(doc0.stirrup.regions, doc0.geometry.L, doc0.stirrup.spacing);
    expect(before.length).toBeGreaterThan(1);

    useStore.getState().moveStirrupRegionBoundary(0, 800);
    const doc1 = useStore.getState().doc as ReturnType<typeof defaultBeamDoc>;
    const after = effectiveRegions(doc1.stirrup.regions, doc1.geometry.L, doc1.stirrup.spacing);
    expect(after[0]!.to).toBe(800);
    expect(after[after.length - 1]!.to).toBe(doc1.geometry.L); // still contiguous over 0..L
  });

  it("setReleveBend writes an editable bend station on a beam relevé", () => {
    useStore.getState().selectElement("E-BEM-01");
    useStore.getState().setReleves([{ id: "R1", support: "left", count: 2, diameter: 12 }]);
    useStore.getState().setReleveBend("R1", 1500);
    const doc = useStore.getState().doc as ReturnType<typeof defaultBeamDoc>;
    expect(doc.releves![0]!.bendStation).toBe(1500);
    expect(useStore.getState().solveError).toBeNull();
  });
});

describe("v1.0.6 U5 — the inspector numeric twin round-trips to the store (== the drag)", () => {
  beforeEach(() => useStore.getState().reset());

  it("editing the curtailment field in the inspector sets the selected bar's station", () => {
    useStore.getState().select({ kind: "bar", index: 0 }); // select before render so the inspector mounts it
    const { container } = render(<><Sidebar /><SectionDock /></>);
    const stations = container.querySelector(".inspector-stations") as HTMLElement;
    expect(stations).toBeTruthy();
    // the end-cut-off numeric twin is present; typing a value curtails the bar (== the elevation drag)
    const endInput = within(stations).getByLabelText(/Arrêt fin/) as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: "2100" } });
    const ov = (useStore.getState().doc as ReturnType<typeof defaultColumnDoc>).longitudinal.barOverrides;
    expect(ov).toEqual([{ index: 0, endStation: 2100 }]);
  });

  it("the elevation dock now renders an EDITABLE canvas (N6), not the read-only view", () => {
    const { container } = render(<ElevationDock />);
    // a bar is present on the default column → the editable svg mounts (was `.elevation-svg` read-only)
    expect(container.querySelector(".elevation-svg-edit")).toBeInTheDocument();
  });
});
