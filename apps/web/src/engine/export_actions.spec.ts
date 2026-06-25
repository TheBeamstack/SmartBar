/**
 * P5 export actions: the SPA glue produces the SAME artefacts as the pure exporters and triggers a
 * download. We assert on the returned bytes/text (the DOM download no-ops headlessly). The drawing
 * deliverables hard-lock on a 🔴 FAIL (§7.9); BBS + `.rcfg` always serialise.
 */
import { describe, it, expect } from "vitest";
import { parseRcfg, DXF_LAYER_NAMES, ExportLockedError } from "@rebarconfig/exporters";
import { exportBbsJson, exportDxf, exportPdf, exportRcfg, downloadBlob } from "./exportActions";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";
import { defaultColumnDoc } from "./document";
import { solveDoc } from "./solveDoc";
import { defaultCoupeFor } from "@rebarconfig/core";

const solved = () => {
  const doc = defaultColumnDoc();
  const result = solveDoc(doc);
  return { doc, result, cuts: [defaultCoupeFor(result)] };
};

describe("export actions (§9)", () => {
  it("exportBbsJson returns the parseable §9.1 schedule", () => {
    const { result } = solved();
    const bbs = JSON.parse(exportBbsJson(result));
    expect(bbs.element).toBe("E-COL-01");
    expect(Array.isArray(bbs.lines)).toBe(true);
    expect(bbs.lines.length).toBeGreaterThan(0);
    expect(bbs.summary.totalWeight_kg).toBeGreaterThan(0);
  });

  it("exportDxf writes the four strict layers + entities", () => {
    const { result, cuts } = solved();
    const dxf = exportDxf(result, cuts);
    for (const layer of DXF_LAYER_NAMES) expect(dxf).toContain(layer);
    expect(dxf).toContain("LINE");
    expect(dxf).toContain("AC1009"); // R12
    expect(dxf).toContain("SECTION");
  });

  it("exportPdf produces a PDF for a PASS/WARN element", async () => {
    const { result, cuts } = solved();
    const bytes = await exportPdf(result, cuts, { date: "2026-06-25" });
    expect(bytes.length).toBeGreaterThan(0);
    // "%PDF" magic
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe("%PDF");
  });

  it("exportPdf hard-locks on a FAIL element (§7.9)", async () => {
    const doc = defaultColumnDoc();
    // force a FAIL: collapse the section so spacing/ratio rules fail
    doc.geometry = { b: 120, h: 120, H: 3000 };
    doc.longitudinal = { ...doc.longitudinal, nTop: 6, nBottom: 6, nLeft: 6, nRight: 6, diameter: 32 };
    const result = solveDoc(doc);
    expect(result.status).toBe("FAIL");
    await expect(exportPdf(result, [defaultCoupeFor(result)])).rejects.toBeInstanceOf(ExportLockedError);
  });

  it("exportRcfg round-trips back to the same editable doc", () => {
    const { doc, cuts } = solved();
    const text = exportRcfg(docToRcfg(doc, cuts));
    const back = rcfgToDoc(parseRcfg(text));
    expect(back).toEqual(doc);
  });

  it("downloadBlob no-ops gracefully when the URL API is unavailable (headless)", () => {
    // jsdom stubs URL.createObjectURL to throw; the helper must swallow it and report false.
    expect(downloadBlob("x.txt", "hello", "text/plain")).toBe(false);
  });
});
