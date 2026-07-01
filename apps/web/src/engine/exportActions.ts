/**
 * Browser download glue for the P5 export engines (plan P5 steps 2–5). The actual artefacts are
 * produced by the pure `@rebarconfig/exporters` package (BBS/DXF/PDF/.rcfg); this module only adds
 * filenames + the Blob/anchor download, guarded so it no-ops headlessly (jsdom/SSR).
 *
 * Drawing exports (PDF/DXF) hard-lock on a 🔴 FAIL — `buildPdf` throws `ExportLockedError`, and the
 * Navbar disables the menu items; `.rcfg` always saves (a failing project must still be persistable).
 */
import {
  buildDxf1,
  buildDxfCoupes,
  computeBBS,
  serializeRcfg,
  type RcfgProject,
  type PdfMetadata,
  type ProjectPdfType,
} from "@rebarconfig/exporters";
import type { SolveResult, SectionCut } from "@rebarconfig/core";
import { isBeamDoc, type ElementDoc } from "./document";

/** The G7 shop-drawing support annotations (bearing width + bottom-bar anchorage) per beam support. */
export type SupportsMeta = { side: "left" | "right"; width?: number; anchorage?: number }[];

/**
 * Extract the beam's V1/V2 bearing width + bottom-bar anchorage for the G7 shop-drawing support
 * labels (these live on the doc, not the pure SolveResult, so the app must thread them into the
 * exporters). Non-beam elements have no supports → `undefined` (the labels simply omit the extras).
 */
export function beamSupportsMeta(doc: ElementDoc): SupportsMeta | undefined {
  if (!isBeamDoc(doc)) return undefined;
  return (["left", "right"] as const).map((side) => ({
    side,
    width: doc.supports[side].width,
    anchorage: doc.supports[side].anchorage,
  }));
}

/** Slug an element id + suffix into a stable filename, e.g. `E-COL-01.pdf`. */
function filename(result: SolveResult, ext: string): string {
  return `${result.element}.${ext}`;
}

/**
 * Trigger a browser download of `data`. Returns `true` if a download was initiated, `false` in a
 * non-DOM / unsupported context (so callers + tests can branch without throwing).
 */
export function downloadBlob(name: string, data: Uint8Array | string, mime: string): boolean {
  if (typeof document === "undefined") return false;
  const urlApi = (globalThis as { URL?: { createObjectURL?: (b: Blob) => string; revokeObjectURL?: (u: string) => void } }).URL;
  if (!urlApi?.createObjectURL) return false;
  try {
    // cast: lib.dom's BlobPart over-narrows Uint8Array's backing buffer (ArrayBufferLike vs ArrayBuffer).
    const blob = new Blob([data as BlobPart], { type: mime });
    const url = urlApi.createObjectURL(blob); // jsdom stubs this to throw → caught, returns false
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    urlApi.revokeObjectURL?.(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build + download the PDF sheet. Throws `ExportLockedError` on 🔴 FAIL (§7.9). `buildPdf` (and its
 * pdf-lib dependency, ~0.5 MB) is **dynamically imported** so it lands in a lazy chunk loaded only
 * when the user actually exports a PDF — it stays out of the initial bundle (P6 code-split).
 */
export async function exportPdf(
  result: SolveResult,
  cuts: SectionCut[],
  meta: PdfMetadata = {},
): Promise<Uint8Array> {
  const { buildPdf } = await import("@rebarconfig/exporters");
  // The first cut is the default coupe (buildPdf already prepends `defaultCoupeFor`); pass the rest.
  const extra = cuts.filter((c) => !c.isDefault);
  const bytes = await buildPdf(result, { ...meta, coupes: extra });
  downloadBlob(filename(result, "pdf"), bytes, "application/pdf");
  return bytes;
}

/** Build + download the DXF drawing (DXF-2 with the user coupes, or DXF-1 if only the default). */
export function exportDxf(result: SolveResult, cuts: SectionCut[], supports?: SupportsMeta): string {
  const dxf =
    cuts.length > 1 ? buildDxfCoupes(result, cuts, supports) : buildDxf1(result, supports ? { supports } : {});
  downloadBlob(filename(result, "dxf"), dxf, "application/dxf");
  return dxf;
}

/** Build + download the bar-bending schedule as a canonical JSON record (§9.1). */
export function exportBbsJson(result: SolveResult): string {
  const json = JSON.stringify(computeBBS(result), null, 2);
  downloadBlob(filename(result, "bbs.json"), json, "application/json");
  return json;
}

/** Serialise + download the `.rcfg` project (always allowed, even on FAIL). */
export function exportRcfg(project: RcfgProject, name = "projet.rcfg"): string {
  const text = serializeRcfg(project);
  downloadBlob(name, text, "application/json");
  return text;
}

// --- combined project exports (v1.0.1 Feature C) ---

/** One element type in a combined export: its solved result + mark + quantity + its coupes. */
export interface ProjectExportType {
  result: SolveResult;
  mark: string;
  quantity: number;
  cuts: SectionCut[];
  /** G7 per-type beam bearing width + anchorage (from the type's doc); absent for non-beams. */
  supports?: SupportsMeta;
}

/**
 * Build + download the COMBINED project PDF (sheet per type + a project summary sheet, §C.1).
 * Throws `ExportLockedError` if ANY type is 🔴 FAIL (per-project lock). `buildProjectPdf` (+ pdf-lib)
 * is dynamically imported so it stays out of the initial bundle (P6 code-split).
 */
export async function exportProjectPdf(types: ProjectExportType[], meta: PdfMetadata = {}): Promise<Uint8Array> {
  const { buildProjectPdf } = await import("@rebarconfig/exporters");
  const pdfTypes: ProjectPdfType[] = types.map((t) => ({
    result: t.result,
    mark: t.mark,
    quantity: t.quantity,
    coupes: t.cuts.filter((c) => !c.isDefault),
    ...(t.supports ? { supports: t.supports } : {}),
  }));
  const bytes = await buildProjectPdf(pdfTypes, meta);
  downloadBlob("projet.pdf", bytes, "application/pdf");
  return bytes;
}

/**
 * Build + download one DXF file per type (the DXF model is per-element, §C.1). v1.0.1 packages them
 * as SEQUENTIAL downloads named by mark (no zip dependency — owner convention §14 item 19, flagged).
 * Returns the number of files downloaded.
 */
export function exportProjectDxf(types: ProjectExportType[]): number {
  let n = 0;
  for (const t of types) {
    const dxf =
      t.cuts.length > 1
        ? buildDxfCoupes(t.result, t.cuts, t.supports)
        : buildDxf1(t.result, t.supports ? { supports: t.supports } : {});
    if (downloadBlob(`${t.mark}.dxf`, dxf, "application/dxf")) n += 1;
  }
  return n;
}

/** Build + download the project bar-bending schedule as JSON — every type, marks namespaced (§C.2). */
export function exportProjectBbsJson(types: ProjectExportType[]): string {
  const schedules = types.map((t) => computeBBS(t.result, { markPrefix: t.mark }));
  const json = JSON.stringify(schedules, null, 2);
  downloadBlob("projet.bbs.json", json, "application/json");
  return json;
}
