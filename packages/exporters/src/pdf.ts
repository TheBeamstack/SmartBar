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
  placeBars,
  sectionAt,
  defaultCoupeFor,
  type SolveResult,
  type SectionCut,
  type CoupeView,
} from "@rebarconfig/core";
import { computeBBS, type BarBendingSchedule } from "./bbs";
import { assertExportable, statusStamp } from "./export-lock";

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

/** Draw the longitudinal elevation into a PDF rectangle. */
function drawElevation(page: PDFPage, result: SolveResult, rect: { x: number; y: number; w: number; h: number }) {
  const { member } = result;
  const L = member.length;
  const halfH = member.envelope === "CIRCULAR" ? (member.D ?? 0) / 2 : (member.h ?? 0) / 2;
  const T = fitBox({ minX: 0, minY: -halfH, maxX: L, maxY: halfH }, rect);
  const steel = rgb(0.8, 0.1, 0.1);
  const concrete = rgb(0.4, 0.4, 0.4);
  // concrete outline
  const corners = [
    { x: 0, y: -halfH }, { x: L, y: -halfH }, { x: L, y: halfH }, { x: 0, y: halfH },
  ];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i]!, b = corners[(i + 1) % corners.length]!;
    page.drawLine({ start: { x: T.px(a.x), y: T.py(a.y) }, end: { x: T.px(b.x), y: T.py(b.y) }, thickness: 0.7, color: concrete });
  }
  // bars projected to (axis, height)
  for (const bar of placeBars(result)) {
    const p = bar.points;
    for (let i = 0; i + 5 < p.length; i += 3) {
      page.drawLine({
        start: { x: T.px(p[i + 1]!), y: T.py(p[i + 2]!) },
        end: { x: T.px(p[i + 4]!), y: T.py(p[i + 5]!) },
        thickness: 0.5,
        color: steel,
      });
    }
  }
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

/**
 * Build the PDF sheet for a solved element. Throws `ExportLockedError` on a 🔴 FAIL (§7.9).
 * Returns the PDF bytes (Uint8Array). Async (pdf-lib).
 */
export async function buildPdf(result: SolveResult, meta: PdfMetadata = {}): Promise<Uint8Array> {
  assertExportable(result); // 🔴 hard-locks export (§7.9)

  const bbs = computeBBS(result);
  const stamp = statusStamp(result.status);
  const coupes = [defaultCoupeFor(result), ...(meta.coupes ?? [])];
  const date = meta.date ?? new Date().toISOString().slice(0, 10);

  const doc = await PDFDocument.create();
  if (meta.date) {
    const d = new Date(`${meta.date}T00:00:00Z`);
    doc.setCreationDate(d);
    doc.setModificationDate(d);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.w, A4.h]);

  // --- cartouche (title block) ---
  const topY = A4.h - MARGIN;
  page.drawRectangle({ x: MARGIN, y: topY - 50, width: A4.w - 2 * MARGIN, height: 50, borderWidth: 0.8, borderColor: rgb(0, 0, 0) });
  page.drawText(meta.projectName ?? "RebarConfig", { x: MARGIN + 8, y: topY - 18, size: 12, font: fontB, color: rgb(0, 0, 0) });
  page.drawText(`Élément: ${result.element}`, { x: MARGIN + 8, y: topY - 34, size: 8, font, color: rgb(0, 0, 0) });
  page.drawText(`Date: ${date}    Par: ${meta.drawnBy ?? "—"}`, { x: MARGIN + 8, y: topY - 44, size: 8, font, color: rgb(0, 0, 0) });
  // status stamp (top-right)
  page.drawRectangle({ x: A4.w - MARGIN - 120, y: topY - 44, width: 112, height: 36, borderWidth: 1.2, borderColor: hex(stamp.color), color: hex(stamp.color), opacity: 0.12 });
  page.drawText(stamp.fr.toUpperCase(), { x: A4.w - MARGIN - 112, y: topY - 26, size: 11, font: fontB, color: hex(stamp.color) });
  page.drawText(stamp.en, { x: A4.w - MARGIN - 112, y: topY - 38, size: 7, font, color: hex(stamp.color) });

  // --- drawing views ---
  const drawTop = topY - 60;
  const elevRect = { x: MARGIN, y: drawTop - 200, w: A4.w - 2 * MARGIN, h: 200 };
  page.drawRectangle({ x: elevRect.x, y: elevRect.y, width: elevRect.w, height: elevRect.h, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.7) });
  page.drawText("Élévation", { x: elevRect.x + 4, y: elevRect.y + elevRect.h - 12, size: 8, font: fontB, color: rgb(0, 0, 0) });
  drawElevation(page, result, elevRect);

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

  doc.setTitle(`${meta.projectName ?? "RebarConfig"} — ${result.element}`);
  return doc.save();
}
