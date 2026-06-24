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
  computeCurtailment,
  resolveSupplement,
  type SolveResult,
  type ElementSolveInput,
  type ElementSupplementInput,
  type ValidationItem,
  type BarPosition,
} from "@rebarconfig/core";
import { makeBaelPack, type BaelPack } from "@rebarconfig/codepacks";
import {
  type ElementDoc,
  type ColumnDoc,
  type BeamDoc,
  isColumnDoc,
} from "./document";
import { loadShape, supplementManifest } from "./manifests";

/** The active code pack. v1.0 = BAEL-FR only (EC2 is P4); built once, it is pure data+fns. */
export const baelPack: BaelPack = makeBaelPack();

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
  const phiLInset = Math.max(phiSpan, phiTop);
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

  let nTop = 2;
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
    });
    nTop = doc.chapeau.nTop;
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
    supplements,
    code,
  };
}

function buildInput(
  doc: ElementDoc,
  supplements: ElementSupplementInput[],
  code: BaelPack,
): ElementSolveInput {
  return isColumnDoc(doc) ? columnInput(doc, supplements, code) : beamInput(doc, supplements, code);
}

// ---------------------------------------------------------------------------
// supplement shape params (UI-edge convention — the engine stays generic)
// ---------------------------------------------------------------------------
function supplementShapeParams(
  shapeId: string,
  doc: ElementDoc,
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
  doc: ElementDoc,
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
  const pass1 = solveElement(buildInput(doc, [], code));
  if (doc.supplements.length === 0) return pass1;
  const { inputs, warnings } = resolveDocSupplements(doc, pass1.bars);
  const pass2 = solveElement(buildInput(doc, inputs, code));
  return { ...pass2, validation: [...pass2.validation, ...warnings] };
}

export type { SolveResult };
