/**
 * Adapter: ElementDoc → engine ElementSolveInput → SolveResult. Pure (no React/DOM/three) so it
 * is exercised headlessly (store_resolve / perf_budget / beam tests) and reused by the store.
 *
 * The engine is consumed UNCHANGED: this adapter marshals each element's conventions (column tie
 * inset; beam span/chapeau/stirrup; chapeau curtailment extension §7.7), injects the BAEL pack +
 * referenced archetypes, and dispatches the generic `solveElement` (which picks the validation
 * profile from the input). Supplements (§5.5) are resolved against the first-pass base bars and
 * folded back in. No geometry/validation math lives here — that all stays in @rebarconfig/core.
 */
import {
  solveElement,
  solveCircular,
  solveSlab,
  solveStair,
  solveJoist,
  computeCurtailment,
  resolveSupplement,
  type SolveResult,
  type ElementSolveInput,
  type SeismicElementInput,
  type ElementSupplementInput,
  type ValidationItem,
  type BarPosition,
  type CircularSolveInput,
  type SlabSolveInput,
  type StairSolveInput,
  type JoistSolveInput,
} from "@rebarconfig/core";
import { makeBaelPack, makeRpsOverlay, type BaelPack } from "@rebarconfig/codepacks";
import {
  type ElementDoc,
  type ColumnDoc,
  type BeamDoc,
  type GenericDoc,
  type ZoneEdit,
  type SeismicEdit,
  isColumnDoc,
  isGenericDoc,
} from "./document";
import { loadShape, supplementManifest } from "./manifests";

/** The active code pack. v1.0 = BAEL-FR only (EC2 is P4); built once, it is pure data+fns. */
export const baelPack: BaelPack = makeBaelPack();

// ---------------------------------------------------------------------------
// seismic overlay (§7.10) — composed on top of the base profile when a regime is set
// ---------------------------------------------------------------------------
function seismicBlock(
  edit: SeismicEdit | undefined,
  member: SeismicElementInput["member"],
  longBarsTotal: number,
  longBarsEngaged: number,
): { seismic?: SeismicElementInput } {
  if (!edit) return {};
  const overlay = makeRpsOverlay({ code: edit.code, zone: edit.zone, ductility: edit.ductility });
  return { seismic: { overlay, member, longBarsTotal, longBarsEngaged } };
}

// ---------------------------------------------------------------------------
// element-specific conventions → generic ElementSolveInput
// ---------------------------------------------------------------------------
function columnInput(
  doc: ColumnDoc,
  supplements: ElementSupplementInput[],
  code: BaelPack,
): ElementSolveInput {
  const phiL = doc.longitudinal.diameter;
  const phiT = doc.tie.diameter;
  const wTie = doc.geometry.b - 2 * doc.cover - phiT;
  const hTie = doc.geometry.h - 2 * doc.cover - phiT;
  return {
    element: "E-COL-01",
    profile: "BAEL_COLUMN",
    section: "RECT",
    geometry: { b: doc.geometry.b, h: doc.geometry.h, H: doc.geometry.H },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    layout: {
      principle: doc.longitudinal.principle,
      nTop: doc.longitudinal.nTop,
      nBottom: doc.longitudinal.nBottom,
      nLeft: doc.longitudinal.nLeft,
      nRight: doc.longitudinal.nRight,
    },
    phiT,
    phiLInset: phiL,
    longitudinal: [
      {
        zone: "As_total",
        groupId: doc.longitudinal.groupId,
        role: "PRIMARY_LONGITUDINAL",
        shape: loadShape(doc.longitudinal.shapeId),
        params: { L: doc.geometry.H },
        diameter: phiL,
        faces: ["TOP", "BOTTOM", "LEFT", "RIGHT"],
        asReq: doc.longitudinal.asReq,
        tensionFace: "BOTTOM",
      },
    ],
    transverse: [
      {
        zone: "Asw_confinement",
        groupId: doc.tie.groupId,
        shape: loadShape(doc.tie.shapeId),
        params: { w: wTie, h: hTie },
        diameter: phiT,
        spacing: doc.tie.spacing,
        nLegs: doc.tie.nLegs,
        aswReqPerM: doc.tie.aswReqPerM,
      },
    ],
    ...seismicBlock(
      doc.seismic,
      { kind: "COLUMN", length: doc.geometry.H, bMin: Math.min(doc.geometry.b, doc.geometry.h), hSectionMax: Math.max(doc.geometry.b, doc.geometry.h) },
      doc.longitudinal.nTop + doc.longitudinal.nBottom + doc.longitudinal.nLeft + doc.longitudinal.nRight,
      4,
    ),
    supplements,
    code,
  };
}

function beamInput(
  doc: BeamDoc,
  supplements: ElementSupplementInput[],
  code: BaelPack,
): ElementSolveInput {
  const phiSpan = doc.span.diameter;
  const phiTop = doc.chapeau.enabled ? doc.chapeau.diameter : phiSpan;
  const phiLInset = Math.max(phiSpan, phiTop, doc.topBars.enabled ? doc.topBars.diameter : 0);
  const phiT = doc.stirrup.diameter;
  const wStir = doc.geometry.b - 2 * doc.cover - phiT;
  const hStir = doc.geometry.h - 2 * doc.cover - phiT;
  // single bottom layer ⇒ d = h − (cover + φ_t + φ_ℓ/2) exactly (§6.1)
  const dApprox = doc.geometry.h - (doc.cover + phiT + phiLInset / 2);

  const longitudinal: ElementSolveInput["longitudinal"] = [
    {
      zone: "As_span_bottom",
      groupId: doc.span.groupId,
      role: "PRIMARY_LONGITUDINAL",
      shape: loadShape(doc.span.shapeId),
      params: { L: doc.geometry.L },
      diameter: phiSpan,
      faces: ["BOTTOM"],
      asReq: doc.span.asReq,
      tensionFace: "BOTTOM",
      continuedToSupport: doc.span.continuedToSupport,
    },
  ];

  // Top face physically carries (8b, D-P6-1): full-length montage bars + over-support chapeaux.
  // Each top zone declares an EXPLICIT providedCount so the two never double-count on the TOP face.
  const nMontage = doc.topBars.enabled ? doc.topBars.nTop : 0;
  const nChapeau = doc.chapeau.enabled ? doc.chapeau.nTop : 0;
  const nTop = Math.max(2, nMontage + nChapeau);

  if (doc.topBars.enabled) {
    longitudinal.push({
      zone: "As_top_montage",
      groupId: doc.topBars.groupId,
      role: "PRIMARY_LONGITUDINAL",
      shape: loadShape("DROITE"),
      params: { L: doc.geometry.L },
      diameter: doc.topBars.diameter,
      faces: ["TOP"],
      asReq: 0, // montage / compression steel — no flexural As,req of its own
      tensionFace: "TOP",
      providedCount: nMontage,
    });
  }
  if (doc.chapeau.enabled) {
    const cur = computeCurtailment(code, {
      diameter: phiTop,
      material: doc.material,
      supportZone: doc.chapeau.supportZone,
      d: dApprox,
      goodBond: false, // top bars over a support cast poor-bond (§7.7)
    });
    longitudinal.push({
      zone: "As_top_support",
      groupId: doc.chapeau.groupId,
      role: "PRIMARY_LONGITUDINAL",
      shape: loadShape(doc.chapeau.shapeId),
      params: { L: cur.extension },
      diameter: phiTop,
      faces: ["TOP"],
      asReq: doc.chapeau.asReq,
      tensionFace: "TOP",
      providedCount: nChapeau, // explicit — does NOT absorb the montage bars on the same face
    });
  }

  return {
    element: "E-BEM-01",
    profile: "BAEL_BEAM",
    section: "RECT",
    geometry: { b: doc.geometry.b, h: doc.geometry.h, L: doc.geometry.L },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    layout: { principle: "FREE", nTop, nBottom: doc.span.nBottom, nLeft: 2, nRight: 2 },
    phiT,
    phiLInset,
    longitudinal,
    transverse: [
      {
        zone: "Asw_shear",
        groupId: doc.stirrup.groupId,
        shape: loadShape(doc.stirrup.shapeId),
        params: { w: wStir, h: hStir },
        diameter: phiT,
        spacing: doc.stirrup.spacing,
        nLegs: doc.stirrup.nLegs,
        aswReqPerM: doc.stirrup.aswReqPerM,
      },
    ],
    ...seismicBlock(
      doc.seismic,
      { kind: "BEAM", length: doc.geometry.L, bMin: doc.geometry.b, hSectionMax: doc.geometry.h },
      doc.span.nBottom + nTop,
      2,
    ),
    supplements,
    code,
  };
}

function buildInput(
  doc: ColumnDoc | BeamDoc,
  supplements: ElementSupplementInput[],
  code: BaelPack,
): ElementSolveInput {
  return isColumnDoc(doc) ? columnInput(doc, supplements, code) : beamInput(doc, supplements, code);
}

// ---------------------------------------------------------------------------
// generic (non-rect) elements — circular / slab / joist / stair
// The editable doc (document.ts GenericDoc) is marshalled into the right section orchestrator's
// input. Shape params are computed from the geometry (UI-edge convention; the engine stays generic).
// ---------------------------------------------------------------------------
function num(geo: Record<string, number>, key: string, fallback: number): number {
  const v = geo[key];
  return typeof v === "number" ? v : fallback;
}

/** Member length (along the bars' run) for a generic element. */
function memberLength(doc: GenericDoc): number {
  const geo = doc.geometry;
  switch (doc.section) {
    case "CIRCULAR": return num(geo, "H", num(geo, "L", 3000));
    case "JOIST": return num(geo, "L", 4500);
    case "STAIR": return num(geo, "n_steps", 14) * num(geo, "g", 280);
    default: return num(geo, "Lx", 5000); // SLAB
  }
}

/** Compute the shape params for one zone of a generic element from its geometry. */
function genericShapeParams(doc: GenericDoc, z: ZoneEdit): Record<string, number> {
  const geo = doc.geometry;
  const len = memberLength(doc);
  switch (z.shapeId) {
    case "DROITE":
      // circular long bars → member length; slab distribution runs across the width.
      return { L: doc.section === "CIRCULAR" ? len : (z.slabRole === "SECONDARY" ? num(geo, "Ly", num(geo, "flight_width", num(geo, "joist_spacing", len))) : len) };
    case "CHAPEAU":
      return { L: Math.max(300, len * 0.25) };
    case "ATTENTE":
      return { foot: 300, h: Math.max(300, len * 0.05) };
    case "SPIRALE_HELICE": {
      const D = num(geo, "D", 600);
      const pitch = z.spacing ?? 100;
      const helix_diameter = Math.max(50, D - 2 * doc.cover - z.diameter);
      const turns = Math.max(1, Math.ceil(len / Math.max(1, pitch)));
      return { pitch, helix_diameter, turns, height: len };
    }
    case "TREILLIS_MESH": {
      const pitch = z.spacing ?? 150;
      const Lx = doc.section === "JOIST" ? num(geo, "L", 4500) : num(geo, "Lx", 5000);
      const Ly = doc.section === "JOIST" ? num(geo, "joist_spacing", 600) : num(geo, "Ly", 5000);
      return { pitch_x: pitch, pitch_y: pitch, Lx, Ly, overhang_x: 0, overhang_y: 0 };
    }
    case "MARCHE_PALIER":
      return { flight: num(geo, "n_steps", 14) * num(geo, "g", 280), landing: num(geo, "landing_L", 0), bend: 30 };
    default:
      return {};
  }
}

function circularInput(doc: GenericDoc, code: BaelPack): CircularSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: { D: num(geo, "D", 600), ...(geo["H"] !== undefined ? { H: geo["H"] } : {}), ...(geo["L"] !== undefined ? { L: geo["L"] } : {}) },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    longitudinal: doc.zones
      .filter((z) => z.kind === "longitudinal")
      .map((z) => ({
        zone: z.zone,
        groupId: z.groupId,
        role: z.role,
        shape: loadShape(z.shapeId),
        params: genericShapeParams(doc, z),
        diameter: z.diameter,
        count: z.count ?? 0,
        asReq: z.asReq ?? 0,
        ...(z.primary ? { primary: true } : {}),
      })),
    transverse: doc.zones
      .filter((z) => z.kind === "transverse")
      .map((z) => ({
        zone: z.zone,
        groupId: z.groupId,
        shape: loadShape(z.shapeId),
        params: genericShapeParams(doc, z),
        diameter: z.diameter,
        spacing: z.spacing ?? 100,
        nLegs: z.nLegs ?? 2,
        aswReqPerM: z.asReqPerM ?? 0,
      })),
    code,
  };
}

function slabZoneV(doc: GenericDoc, z: ZoneEdit): number {
  const t = num(doc.geometry, "t", num(doc.geometry, "t_total", num(doc.geometry, "waist_t", 200)));
  const inset = t / 2 - doc.cover;
  return z.slabRole === "TOP" ? inset : -inset;
}

function slabInput(doc: GenericDoc, code: BaelPack): SlabSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: { Lx: num(geo, "Lx", 5000), Ly: num(geo, "Ly", 5000), t: num(geo, "t", 200) },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    zones: doc.zones.map((z) => ({
      zone: z.zone,
      groupId: z.groupId,
      role: z.role,
      slabRole: z.slabRole ?? "MAIN",
      shape: loadShape(z.shapeId),
      params: genericShapeParams(doc, z),
      diameter: z.diameter,
      spacing: z.spacing ?? 150,
      asReqPerM: z.asReqPerM ?? 0,
      v: slabZoneV(doc, z),
    })),
    ...(doc.restrainedCorner !== undefined ? { restrainedCorner: doc.restrainedCorner } : {}),
    ...(doc.cornerTorsionProvided !== undefined ? { cornerTorsionProvided: doc.cornerTorsionProvided } : {}),
    code,
  };
}

function joistInput(doc: GenericDoc, code: BaelPack): JoistSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: {
      L: num(geo, "L", 4500),
      t_total: num(geo, "t_total", 250),
      t_topping: num(geo, "t_topping", 50),
      b_joist: num(geo, "b_joist", 100),
      block_w: num(geo, "block_w", 500),
      block_h: num(geo, "block_h", 200),
      joist_spacing: num(geo, "joist_spacing", 600),
    },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    zones: doc.zones.map((z) => ({
      zone: z.zone,
      groupId: z.groupId,
      role: z.role,
      slabRole: z.slabRole ?? "MAIN",
      shape: loadShape(z.shapeId),
      params: genericShapeParams(doc, z),
      diameter: z.diameter,
      spacing: z.spacing ?? 600,
      asReqPerM: z.asReqPerM ?? 0,
      v: slabZoneV(doc, z),
    })),
    code,
  };
}

function stairInput(doc: GenericDoc, code: BaelPack): StairSolveInput {
  const geo = doc.geometry;
  return {
    element: doc.element,
    profile: doc.profile,
    geometry: {
      g: num(geo, "g", 280),
      r: num(geo, "r", 170),
      n_steps: num(geo, "n_steps", 14),
      waist_t: num(geo, "waist_t", 180),
      flight_width: num(geo, "flight_width", 1200),
      landing_L: num(geo, "landing_L", 1000),
    },
    material: doc.material,
    cover: doc.cover,
    exposure: doc.exposure,
    ...(doc.fire !== undefined ? { fire: doc.fire } : {}),
    dg: doc.dg,
    ...(doc.mainBarWrapsCorner !== undefined ? { mainBarWrapsCorner: doc.mainBarWrapsCorner } : {}),
    zones: doc.zones.map((z) => ({
      zone: z.zone,
      groupId: z.groupId,
      role: z.role,
      slabRole: z.slabRole ?? "MAIN",
      shape: loadShape(z.shapeId),
      params: genericShapeParams(doc, z),
      diameter: z.diameter,
      spacing: z.spacing ?? 150,
      asReqPerM: z.asReqPerM ?? 0,
      v: slabZoneV(doc, z),
    })),
    code,
  };
}

function solveGeneric(doc: GenericDoc, code: BaelPack): SolveResult {
  switch (doc.section) {
    case "CIRCULAR": return solveCircular(circularInput(doc, code));
    case "SLAB": return solveSlab(slabInput(doc, code));
    case "JOIST": return solveJoist(joistInput(doc, code));
    case "STAIR": return solveStair(stairInput(doc, code));
  }
}

// ---------------------------------------------------------------------------
// supplement shape params (UI-edge convention — the engine stays generic)
// ---------------------------------------------------------------------------
function supplementShapeParams(
  shapeId: string,
  doc: ColumnDoc | BeamDoc,
  span: number | undefined,
): Record<string, number> {
  const memberLen = isColumnDoc(doc) ? doc.geometry.H : doc.geometry.L;
  const innerW = Math.max(40, doc.geometry.b - 2 * doc.cover - 40);
  const innerH = Math.max(40, doc.geometry.h - 2 * doc.cover - 40);
  switch (shapeId) {
    case "EPINGLE":
      return { span: span ?? innerW };
    case "DROITE":
      return { L: memberLen };
    case "CROCHET_L":
      return { a: innerH, b: 200 };
    case "RELEVE":
      return { bottom: memberLen * 0.3, incline: innerH * 1.4, top: memberLen * 0.3, angle: 45 };
    case "CADRE_RECT":
      return { w: innerW * 0.6, h: innerH * 0.6 };
    case "ETRIER":
      return { w: innerW, h: innerH };
    default:
      return {};
  }
}

function warnItem(instanceId: string, message_fr: string, message_en: string): ValidationItem {
  return {
    rule: `supplement:${instanceId}`,
    status: "WARN",
    value: null,
    limit: null,
    codeRef: "§5.5",
    message_fr,
    message_en,
    affectedGroupIds: [instanceId],
    tier: 2,
    symbol: "🟠",
  };
}

/** Resolve the doc's supplements against the base bars → engine inputs + rebind warnings (§5.5). */
function resolveDocSupplements(
  doc: ColumnDoc | BeamDoc,
  baseBars: BarPosition[],
): { inputs: ElementSupplementInput[]; warnings: ValidationItem[] } {
  const inputs: ElementSupplementInput[] = [];
  const warnings: ValidationItem[] = [];
  const baseGroupId = isColumnDoc(doc) ? doc.longitudinal.groupId : doc.span.groupId;

  for (const ed of doc.supplements) {
    const man = supplementManifest(ed.supplementId);
    const r = resolveSupplement(
      man,
      {
        supplementId: ed.supplementId,
        instanceId: ed.instanceId,
        group: ed.group,
        barIndices: ed.barIndices,
        params: { diameter: ed.diameter, ...(ed.params ?? {}) },
      },
      baseBars,
      baseGroupId,
    );
    if (r.status === "WARN") {
      warnings.push(warnItem(ed.instanceId, r.message_fr ?? "", r.message_en ?? ""));
      continue; // don't render a broken supplement
    }
    inputs.push({
      groupId: ed.instanceId,
      role: man.role,
      shape: loadShape(man.shape),
      params: supplementShapeParams(man.shape, doc, r.params.span),
      diameter: r.diameter,
      count: 1,
    });
  }
  return { inputs, warnings };
}

export function solveDoc(doc: ElementDoc, code: BaelPack = baelPack): SolveResult {
  if (isGenericDoc(doc)) return solveGeneric(doc, code);
  const pass1 = solveElement(buildInput(doc, [], code));
  if (doc.supplements.length === 0) return pass1;
  const { inputs, warnings } = resolveDocSupplements(doc, pass1.bars);
  const pass2 = solveElement(buildInput(doc, inputs, code));
  return { ...pass2, validation: [...pass2.validation, ...warnings] };
}

export type { SolveResult };
