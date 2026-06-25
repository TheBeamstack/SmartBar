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
} from "@rebarconfig/exporters";
import type { SolveResult, SectionCut } from "@rebarconfig/core";

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
export function exportDxf(result: SolveResult, cuts: SectionCut[]): string {
  const dxf = cuts.length > 1 ? buildDxfCoupes(result, cuts) : buildDxf1(result);
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
