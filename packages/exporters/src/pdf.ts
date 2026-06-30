/**
 * PDF sheet export (spec §9.3), plan P5 step 4. Produces the on-site drawing sheet:
 *   - title block (cartouche): project / element / date / drawn-by;
 *   - vector drawing views: the longitudinal elevation + the default coupe view box (drawn from the
 *     SAME core projection that feeds DXF — `placeBars` + `sectionAt`);
 *   - the bar-bending schedule table + steel-quantity summary (§9.1);
 *   - the global status stamp (🟢 Conforme / 🟠 À vérifier).
 *
 * 🔴 FAIL hard-locks export (§7.9): `buildPdf` throws `ExportLockedError`. Uses pdf-lib (pure JS,
 * no DOM) so it runs headless (tests) and in the browser. Deterministic when `date` is supplied.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  sectionAt,
  defaultCoupeFor,
  type SolveResult,
  type SectionCut,
  type CoupeView,
} from "@rebarconfig/core";
import { computeBBS, type BarBendingSchedule } from "./bbs";
import { assertExportable, statusStamp } from "./export-lock";
import { buildElevationFiche } from "./fiche";

export interface PdfMetadata {
  projectName?: string;
  drawnBy?: string;
  /** ISO date string for the cartouche + PDF metadata (omit → today; pass for deterministic output). */
  date?: string;
  /** extra coupes to include beyond the default (each gets a view box). */
  coupes?: SectionCut[];
}

const A4 = { w: 595.28, h: 841.89 }; // points, portrait
const MARGIN = 36;
const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** A fit transform from model mm (bbox) into a PDF point rectangle, aspect-preserving + centred. */
function fitBox(
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
  rect: { x: number; y: number; w: number; h: number },
  pad = 6,
) {
  const mw = Math.max(1e-6, bbox.maxX - bbox.minX);
  const mh = Math.max(1e-6, bbox.maxY - bbox.minY);
  const aw = rect.w - 2 * pad, ah = rect.h - 2 * pad;
  const s = Math.min(aw / mw, ah / mh);
  const ox = rect.x + pad + (aw - s * mw) / 2;
  const oy = rect.y + pad + (ah - s * mh) / 2;
  return {
    scale: s,
    px: (mx: number) => ox + s * (mx - bbox.minX),
    py: (my: number) => oy + s * (my - bbox.minY),
  };
}

/** Draw the longitudinal elevation *fiche* (oriented + annotated, §9.2) into a PDF rectangle. */
function drawElevation(page: PDFPage, result: SolveResult, font: PDFFont, rect: { x: number; y: number; w: number; h: number }) {
  const fiche = buildElevationFiche(result);
  const T = fitBox(fiche.bbox, rect);
  const steel = rgb(0.8, 0.1, 0.1);
  const concrete = rgb(0.4, 0.4, 0.4);
  const dim = rgb(0.1, 0.45, 0.1);
  // concrete outline (closed)
  const c = fiche.concrete;
  for (let i = 0; i < c.length; i++) {
    const a = c[i]!, b = c[(i + 1) % c.length]!;
    page.drawLine({ start: { x: T.px(a.x), y: T.py(a.y) }, end: { x: T.px(b.x), y: T.py(b.y) }, thickness: 0.7, color: concrete });
  }
  // bars
  for (const bar of fiche.bars) {
    const p = bar.points;
    for (let i = 0; i + 1 < p.length; i++) {
      page.drawLine({ start: { x: T.px(p[i]!.x), y: T.py(p[i]!.y) }, end: { x: T.px(p[i + 1]!.x), y: T.py(p[i + 1]!.y) }, thickness: 0.5, color: steel });
    }
  }
  // dimensions (line + label)
  for (const d of fiche.dims) {
    page.drawLine({ start: { x: T.px(d.from.x), y: T.py(d.from.y) }, end: { x: T.px(d.to.x), y: T.py(d.to.y) }, thickness: 0.4, color: dim });
    page.drawText(d.label, { x: (T.px(d.from.x) + T.px(d.to.x)) / 2, y: (T.py(d.from.y) + T.py(d.to.y)) / 2 + 1, size: 6, font, color: dim });
  }
  // bar marks (n Ø d) + tie-spacing callouts (Ø d e=s)
  for (const m of fiche.marks) page.drawText(m.text, { x: T.px(m.at.x) + 2, y: T.py(m.at.y) + 2, size: 6, font, color: rgb(0, 0, 0) });
  for (const cl of fiche.tieCallouts) page.drawText(cl.text, { x: T.px(cl.at.x) + 2, y: T.py(cl.at.y) - 7, size: 6, font, color: rgb(0, 0, 0) });
}

/** Draw one coupe view box into a PDF rectangle (concrete + circles + lines + annotations). */
function drawCoupe(page: PDFPage, view: CoupeView, font: PDFFont, rect: { x: number; y: number; w: number; h: number }) {
  const ss = view.concrete.outline.map((p) => p.s);
  const ts = view.concrete.outline.map((p) => p.t);
  const bbox = { minX: Math.min(...ss), minY: Math.min(...ts), maxX: Math.max(...ss), maxY: Math.max(...ts) };
  const T = fitBox(bbox, rect);
  const steel = rgb(0.8, 0.1, 0.1);
  const concrete = rgb(0.4, 0.4, 0.4);
  const out = view.concrete.outline;
  for (let i = 0; i < out.length; i++) {
    const a = out[i]!, b = out[(i + 1) % out.length]!;
    page.drawLine({ start: { x: T.px(a.s), y: T.py(a.t) }, end: { x: T.px(b.s), y: T.py(b.t) }, thickness: 0.7, color: concrete });
  }
  for (const c of view.circles) {
    page.drawCircle({ x: T.px(c.center.s), y: T.py(c.center.t), size: Math.max(0.6, (c.diameter / 2) * T.scale), borderWidth: 0.6, borderColor: steel });
  }
  for (const l of view.lines) {
    page.drawLine({ start: { x: T.px(l.a.s), y: T.py(l.a.t) }, end: { x: T.px(l.b.s), y: T.py(l.b.t) }, thickness: 0.5, color: steel });
  }
  for (const a of view.annotations) {
    page.drawText(`${a.count} Ø ${a.diameter}`, { x: T.px(a.at.s) + 2, y: T.py(a.at.t) + 2, size: 6, font, color: rgb(0, 0, 0) });
  }
  // dimensions: section width/height + enrobage (cover) on each face (G6 §6.4) — mirrors dxf.coupeToDxf
  const dim = rgb(0.1, 0.45, 0.1);
  for (const d of view.dimensions) {
    page.drawLine({ start: { x: T.px(d.from.s), y: T.py(d.from.t) }, end: { x: T.px(d.to.s), y: T.py(d.to.t) }, thickness: 0.4, color: dim });
    page.drawText(d.label, { x: (T.px(d.from.s) + T.px(d.to.s)) / 2 + 1, y: (T.py(d.from.t) + T.py(d.to.t)) / 2 + 1, size: 5.5, font, color: dim });
  }
  page.drawText(view.label, { x: rect.x + 4, y: rect.y + 2, size: 7, font, color: rgb(0, 0, 0) });
}

/** Draw the BBS table; returns the y of the last row drawn. */
function drawBbsTable(page: PDFPage, bbs: BarBendingSchedule, font: PDFFont, fontB: PDFFont, top: number): number {
  const x = MARGIN;
  const cols = [0, 36, 78, 150, 200, 270, 340]; // mark, Ø, shape, count, cut(mm), length(m), weight(kg)
  const headers = ["Rep.", "Ø", "Forme", "Nb", "Long.(mm)", "Total(m)", "Poids(kg)"];
  let y = top;
  page.drawText("Nomenclature des aciers (BBS)", { x, y, size: 9, font: fontB, color: rgb(0, 0, 0) });
  y -= 12;
  headers.forEach((h, i) => page.drawText(h, { x: x + cols[i]!, y, size: 7, font: fontB, color: rgb(0, 0, 0) }));
  y -= 10;
  for (const l of bbs.lines) {
    const row = [l.mark, `${l.diameter}`, l.shapeArchetypeId, `${l.count}`, l.cutLength_mm.toFixed(0), l.totalLength_m.toFixed(2), l.weight_kg.toFixed(2)];
    row.forEach((c, i) => page.drawText(c, { x: x + cols[i]!, y, size: 7, font, color: rgb(0, 0, 0) }));
    y -= 10;
    if (y < MARGIN + 30) break;
  }
  y -= 4;
  const s = bbs.summary;
  page.drawText(
    `Total acier: ${s.totalWeight_kg.toFixed(1)} kg   •   Ratio: ${s.steelRatio_kg_m3.toFixed(1)} kg/m³   •   Béton: ${s.concreteVolume_m3.toFixed(3)} m³`,
    { x, y, size: 7.5, font: fontB, color: rgb(0, 0, 0) },
  );
  return y;
}

/** Render ONE element sheet (cartouche + elevation fiche + coupes + BBS) onto a fresh page. */
function drawElementSheet(
  doc: PDFDocument,
  font: PDFFont,
  fontB: PDFFont,
  result: SolveResult,
  bbs: BarBendingSchedule,
  opts: { projectName?: string; drawnBy?: string; date: string; coupes: SectionCut[]; mark?: string },
): void {
  const stamp = statusStamp(result.status);
  const coupes = [defaultCoupeFor(result), ...opts.coupes];
  const page = doc.addPage([A4.w, A4.h]);

  // --- cartouche (title block) ---
  const topY = A4.h - MARGIN;
  page.drawRectangle({ x: MARGIN, y: topY - 50, width: A4.w - 2 * MARGIN, height: 50, borderWidth: 0.8, borderColor: rgb(0, 0, 0) });
  page.drawText(opts.projectName ?? "RebarConfig", { x: MARGIN + 8, y: topY - 18, size: 12, font: fontB, color: rgb(0, 0, 0) });
  const elementLabel = opts.mark ? `${opts.mark} — ${result.element}` : result.element;
  page.drawText(`Élément: ${elementLabel}`, { x: MARGIN + 8, y: topY - 34, size: 8, font, color: rgb(0, 0, 0) });
  page.drawText(`Date: ${opts.date}    Par: ${opts.drawnBy ?? "—"}`, { x: MARGIN + 8, y: topY - 44, size: 8, font, color: rgb(0, 0, 0) });
  // status stamp (top-right)
  page.drawRectangle({ x: A4.w - MARGIN - 120, y: topY - 44, width: 112, height: 36, borderWidth: 1.2, borderColor: hex(stamp.color), color: hex(stamp.color), opacity: 0.12 });
  page.drawText(stamp.fr.toUpperCase(), { x: A4.w - MARGIN - 112, y: topY - 26, size: 11, font: fontB, color: hex(stamp.color) });
  page.drawText(stamp.en, { x: A4.w - MARGIN - 112, y: topY - 38, size: 7, font, color: hex(stamp.color) });

  // --- drawing views ---
  const drawTop = topY - 60;
  const elevRect = { x: MARGIN, y: drawTop - 200, w: A4.w - 2 * MARGIN, h: 200 };
  page.drawRectangle({ x: elevRect.x, y: elevRect.y, width: elevRect.w, height: elevRect.h, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });
  page.drawText("Élévation", { x: elevRect.x + 4, y: elevRect.y + elevRect.h - 12, size: 8, font: fontB, color: rgb(0, 0, 0) });
  drawElevation(page, result, font, elevRect);

  // coupe boxes in a row beneath the elevation
  const coupeTop = elevRect.y - 10;
  const boxW = (A4.w - 2 * MARGIN - 10 * (coupes.length - 1)) / Math.max(1, coupes.length);
  coupes.forEach((cut, i) => {
    const view = sectionAt(result, cut);
    const r = { x: MARGIN + i * (boxW + 10), y: coupeTop - 170, w: Math.min(boxW, 180), h: 170 };
    page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });
    drawCoupe(page, view, font, r);
  });

  // --- BBS table ---
  const tableBottom = drawBbsTable(page, bbs, font, fontB, coupeTop - 190);
  // review stamp on the fiche itself when WARN (§7.9/§7.12), in addition to the global cartouche stamp
  if (bbs.reviewRequired) {
    page.drawText(`(!) ${stamp.fr} — ${stamp.en}`, {
      x: MARGIN,
      y: tableBottom - 14,
      size: 8,
      font: fontB,
      color: hex(stamp.color),
    });
  }
}

function setDocDate(doc: PDFDocument, date?: string): void {
  if (!date) return;
  const d = new Date(`${date}T00:00:00Z`);
  doc.setCreationDate(d);
  doc.setModificationDate(d);
}

/**
 * Build the PDF sheet for a solved element. Throws `ExportLockedError` on a 🔴 FAIL (§7.9).
 * Returns the PDF bytes (Uint8Array). Async (pdf-lib).
 */
export async function buildPdf(result: SolveResult, meta: PdfMetadata = {}): Promise<Uint8Array> {
  assertExportable(result); // 🔴 hard-locks export (§7.9)

  const bbs = computeBBS(result);
  const date = meta.date ?? new Date().toISOString().slice(0, 10);
  const doc = await PDFDocument.create();
  setDocDate(doc, meta.date);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);
  drawElementSheet(doc, font, fontB, result, bbs, {
    projectName: meta.projectName,
    drawnBy: meta.drawnBy,
    date,
    coupes: meta.coupes ?? [],
  });
  doc.setTitle(`${meta.projectName ?? "RebarConfig"} — ${result.element}`);
  return doc.save();
}

/** One element TYPE in a combined project PDF (a solved result + its mark + fabrication quantity). */
export interface ProjectPdfType {
  result: SolveResult;
  mark: string;
  quantity: number;
  /** user coupes beyond the default for this type's sheet. */
  coupes?: SectionCut[];
}

/**
 * Build the COMBINED project PDF (spec §9.3 / v1.0.1 Feature C.1): one sheet per element TYPE (with
 * namespaced BBS marks, §C.2) followed by a project SUMMARY sheet (the takeoff table + grand totals).
 *
 * Per-project export-lock (§C.1): if ANY type is 🔴 FAIL the WHOLE set is locked — `assertExportable`
 * throws `ExportLockedError` before a single page is drawn, so a failing project never produces a
 * partial combined PDF. Deterministic when `date` is supplied.
 */
export async function buildProjectPdf(types: ProjectPdfType[], meta: PdfMetadata = {}): Promise<Uint8Array> {
  for (const t of types) assertExportable(t.result); // per-project lock: any FAIL blocks the set

  const date = meta.date ?? new Date().toISOString().slice(0, 10);
  const doc = await PDFDocument.create();
  setDocDate(doc, meta.date);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const t of types) {
    const bbs = computeBBS(t.result, { markPrefix: t.mark });
    drawElementSheet(doc, font, fontB, t.result, bbs, {
      projectName: meta.projectName,
      drawnBy: meta.drawnBy,
      date,
      coupes: t.coupes ?? [],
      mark: t.mark,
    });
  }
  drawSummarySheet(doc, font, fontB, types, { projectName: meta.projectName, date });

  doc.setTitle(`${meta.projectName ?? "RebarConfig"} — projet (${types.length} éléments)`);
  return doc.save();
}

/** Draw the project summary sheet: the takeoff table (per type) + project grand totals. */
function drawSummarySheet(
  doc: PDFDocument,
  font: PDFFont,
  fontB: PDFFont,
  types: ProjectPdfType[],
  meta: { projectName?: string; date: string },
): void {
  const page = doc.addPage([A4.w, A4.h]);
  const topY = A4.h - MARGIN;
  page.drawText(`${meta.projectName ?? "RebarConfig"} — Récapitulatif du projet`, { x: MARGIN, y: topY - 14, size: 13, font: fontB, color: rgb(0, 0, 0) });
  page.drawText(`Date: ${meta.date}    Project summary`, { x: MARGIN, y: topY - 28, size: 8, font, color: rgb(0, 0, 0) });

  const x = MARGIN;
  const cols = [0, 50, 200, 250, 320, 400, 470]; // mark, type, qty, unit(kg), total(kg), density, status
  const headers = ["Rep.", "Type", "Nb", "Unit.(kg)", "Total(kg)", "kg/m³", "État"];
  let y = topY - 52;
  headers.forEach((h, i) => page.drawText(h, { x: x + cols[i]!, y, size: 8, font: fontB, color: rgb(0, 0, 0) }));
  y -= 12;

  let totalSteel = 0;
  let totalConcrete = 0;
  for (const t of types) {
    const bbs = computeBBS(t.result);
    const unit = bbs.summary.totalWeight_kg;
    const conc = bbs.summary.concreteVolume_m3;
    const total = unit * t.quantity;
    const density = conc > 0 ? unit / conc : 0;
    totalSteel += total;
    totalConcrete += conc * t.quantity;
    const stamp = statusStamp(t.result.status);
    const row = [t.mark, t.result.element, `${t.quantity}`, unit.toFixed(1), total.toFixed(1), density.toFixed(0), stamp.fr];
    row.forEach((c, i) => page.drawText(c, { x: x + cols[i]!, y, size: 7.5, font, color: i === 6 ? hex(stamp.color) : rgb(0, 0, 0) }));
    y -= 11;
    if (y < MARGIN + 40) break;
  }

  y -= 6;
  const ratio = totalConcrete > 0 ? totalSteel / totalConcrete : 0;
  page.drawText(
    `TOTAUX PROJET — Acier: ${totalSteel.toFixed(1)} kg   •   Béton: ${totalConcrete.toFixed(2)} m³   •   Ratio: ${ratio.toFixed(0)} kg/m³`,
    { x, y, size: 9, font: fontB, color: rgb(0, 0, 0) },
  );
}
