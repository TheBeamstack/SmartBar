/**
 * Contract #3 — ReinforcingElement supertype + BarGroup.
 * Spec: v1.0-Spec.md §0.2.1 ([REF-DATA-060]), §5.1, §10 ([REF-DATA-1000]).
 *
 * The persisted/solved unit is a ReinforcingElement discriminated by `kind`. v1.0 ships
 * ONLY kind="REBAR_GROUP". Horizontal scaling (v1.0.x) adds kind="TENDON" etc. WITHOUT
 * changing the solver/store/viewport/exporter contracts. A v1.0 reader MUST preserve
 * unknown kinds on round-trip (so a future tendon-bearing .rcfg survives a v1.0.0 load).
 */
import type { Distribution } from "./distribution";
import type { PlacementRule } from "./placement";

export type BarRole =
  | "PRIMARY_LONGITUDINAL"
  | "TRANSVERSE"
  | "SUPPLEMENTAL"
  | "SKIN"
  | "DOWEL"
  | "STARTER"
  | "DISTRIBUTION";

/**
 * The only concrete v1.0 ReinforcingElement.kind. Serialized contract (§10): for
 * kind="REBAR_GROUP" the required fields are EXACTLY id, kind, role, (zone | supplementId),
 * shapeArchetypeId, params, diameter, distribution, placement.
 */
export interface BarGroup {
  id: string;
  kind: "REBAR_GROUP";
  role: BarRole;
  /** which As_zone this base group satisfies (base groups). */
  zone?: string;
  /** the supplemental catalog entry this group instantiates (supplements). */
  supplementId?: string;
  shapeArchetypeId: string;
  /** archetype param values (keys per the shape manifest). */
  params: Record<string, number>;
  diameter: number;
  distribution: Distribution;
  placement: PlacementRule;
}

/**
 * Forward-compat carrier for kinds a v1.0 reader does not understand (e.g. a future
 * "TENDON"). The loader keeps these verbatim; it never drops a kind it cannot parse (§10).
 */
export interface UnknownReinforcingElement {
  id: string;
  kind: string;
  [extra: string]: unknown;
}

export type ReinforcingElement = BarGroup | UnknownReinforcingElement;

/** Type guard the engine/loader uses to operate on the v1.0 concrete kind. */
export function isBarGroup(el: ReinforcingElement): el is BarGroup {
  return el.kind === "REBAR_GROUP";
}
