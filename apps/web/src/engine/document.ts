/**
 * The active-element *document* — the editable state the UI mutates and the engine solves.
 * For P2 this is the rectangular tied column E-COL-01 (the one element the P1 engine solves).
 * It mirrors the engine's ColumnSolveInput minus the injected shapes + code pack (those are
 * supplied by the adapter, solveDoc.ts) so the document stays pure data, round-trippable to
 * `.rcfg` later (P5). Units are SI internally (mm, mm², mm²/m) — the UI converts at the edge.
 */
import type { LayoutPrinciple } from "@rebarconfig/core";

export interface ColumnDoc {
  element: "E-COL-01";
  geometry: { b: number; h: number; H: number };
  material: { f_c28: number; f_e: number };
  cover: number;
  exposure: string;
  fire?: string;
  dg: number;
  longitudinal: {
    groupId: string;
    shapeId: string;
    diameter: number;
    principle: LayoutPrinciple;
    nTop: number;
    nBottom: number;
    nLeft: number;
    nRight: number;
    asReq: number;
  };
  tie: {
    groupId: string;
    shapeId: string;
    diameter: number;
    spacing: number;
    nLegs: number;
    aswReqPerM: number;
  };
}

/**
 * Default = the P1 worked reference column (current_state.md §9, bael_reference.spec):
 * b300×h600×H3000, FeE500 / C25, 6Ø20 (3/3/2/2) + Ø8 ties @200 — a known-good GREEN start.
 */
export function defaultColumnDoc(): ColumnDoc {
  return {
    element: "E-COL-01",
    geometry: { b: 300, h: 600, H: 3000 },
    material: { f_c28: 25, f_e: 500 },
    cover: 30,
    exposure: "EXTERIOR",
    dg: 20,
    longitudinal: {
      groupId: "L1",
      shapeId: "DROITE",
      diameter: 20,
      principle: "SYMMETRIC",
      nTop: 3,
      nBottom: 3,
      nLeft: 2,
      nRight: 2,
      asReq: 1800,
    },
    tie: {
      groupId: "T1",
      shapeId: "CADRE_RECT",
      diameter: 8,
      spacing: 200,
      nLegs: 2,
      aswReqPerM: 300,
    },
  };
}
