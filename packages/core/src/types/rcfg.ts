/**
 * Contract #6 (envelope) — the .rcfg project document.
 * Spec: v1.0-Spec.md §10 ([REF-DATA-1000]).
 *
 * A single JSON document = the entire element state. Forward-compat (NORMATIVE):
 * unknown fields AND unknown ReinforcingElement.kind`s are preserved on round-trip;
 * `rcfg_version` gates migrations. A reader must never drop a kind it doesn't understand.
 */
import type { ReinforcingElement } from "./reinforcing-element";

export interface RcfgMaterial {
  f_c28?: number;
  f_e?: number;
  f_ck?: number;
  f_yk?: number;
  exposure: string;
  d_g: number;
  fire?: string;
}

export interface RcfgElement {
  type: string;
  geometry: Record<string, number>;
  material: RcfgMaterial;
  cover_mm: number;
  As_req: Record<string, number>;
}

export interface RcfgSeismic {
  code: string;
  zone: number;
  ductility: string;
}

export interface RcfgReinforcement {
  schemeId: string;
  mode: "guided" | "advanced";
  baseGroups: ReinforcingElement[];
  supplementalGroups: ReinforcingElement[];
  /**
   * v1.0.5 M7 (Track E): the user's freely-detailed steel as canonical `PLACED_BAR` elements — the
   * per-bar as-built truth (bundles / rows / layers / curtailed bars) that a `BarGroup` cannot express.
   * Additive + optional: an older reader ignores it (forward-compat, §10); absent → no free bars.
   */
  placedBars?: ReinforcingElement[];
}

export interface RcfgDocument {
  rcfg_version: string;
  region: string;
  /** "BAEL-FR" | "EC2". */
  codePack: string;
  /** null = gravity (no seismic overlay). */
  seismic: RcfgSeismic | null;
  units: { length: string; area: string };
  element: RcfgElement;
  reinforcement: RcfgReinforcement;
  meta?: Record<string, unknown>;
  /** unknown top-level fields are preserved on round-trip (§10). */
  [extra: string]: unknown;
}
