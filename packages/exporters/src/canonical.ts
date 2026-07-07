/**
 * v1.0.4 E1 ([REF-SYS], spec §E1) — map a SOLVED element onto the canonical §10 `reinforcement[]`
 * (`ReinforcingElement[]`). Element-agnostic: it reads the pipeline's resolved `groups[]` (+ the
 * transverse spacing/regions from `member`), so column / beam / circular / slab / stair all map the
 * same way. The per-bar addressable detail (overrides / extras / splices) rides `meta.app_document`
 * losslessly; the canonical model is group-based per §10 — faithful for interchange / a future IFC or
 * server. Pure + deterministic. Pre-E1 the SPA emitted EMPTY arrays here (D-P5-7); this fills them.
 */
import type {
  SolveResult,
  ReinforcingElement,
  BarGroup,
  Distribution,
  DistributionSegment,
} from "@rebarconfig/core";

const SUPPLEMENTAL_ROLES = new Set(["SKIN", "SUPPLEMENTAL"]);

/** Split the solved groups into the canonical base + supplemental `ReinforcingElement[]`. */
export function reinforcementFromResult(result: SolveResult): {
  baseGroups: ReinforcingElement[];
  supplementalGroups: ReinforcingElement[];
} {
  const transByGroup = new Map(result.member.transverse.map((t) => [t.groupId, t]));
  const base: ReinforcingElement[] = [];
  const supp: ReinforcingElement[] = [];

  for (const g of result.groups) {
    const isTransverse = g.role === "TRANSVERSE";
    const isSupplemental = SUPPLEMENTAL_ROLES.has(g.role);

    let distribution: Distribution;
    if (isTransverse) {
      const t = transByGroup.get(g.groupId);
      const regions = t?.regions;
      if (regions && regions.length > 1) {
        const segments: DistributionSegment[] = regions.map((r, i) => ({
          region: i === 0 ? "END_BOTTOM" : i === regions.length - 1 ? "END_TOP" : "MIDDLE",
          extent: i === 0 || i === regions.length - 1 ? "l_c" : "remainder",
          spacing: r.spacing,
        }));
        distribution = { mode: "SPACING_ALONG_PATH", path: "placement.path", segments };
      } else {
        distribution = { mode: "SPACING_ALONG_PATH", spacing: t?.spacing ?? 0 };
      }
    } else {
      distribution = { mode: "FIXED_COUNT", count: g.count };
    }

    const el: BarGroup = {
      id: g.groupId,
      kind: "REBAR_GROUP",
      role: g.role,
      ...(!isSupplemental && g.zone !== undefined ? { zone: g.zone } : {}),
      ...(g.supplementId !== undefined ? { supplementId: g.supplementId } : {}),
      shapeArchetypeId: g.shape.archetypeId,
      params: g.params ?? {},
      diameter: g.diameter,
      distribution,
      placement: isTransverse
        ? { rule: "ALONG_PATH" }
        : isSupplemental
        ? { rule: "SUPPLEMENTAL", ...(g.anchor ? { coordinate: { u: g.anchor.u, v: g.anchor.v } } : {}) }
        : { rule: "SECTION_PERIMETER" },
    };
    (isSupplemental ? supp : base).push(el);
  }

  return { baseGroups: base, supplementalGroups: supp };
}
