/**
 * Combined project PDF (spec §9.3 / v1.0.1 Feature C.1). `buildProjectPdf` renders one sheet per
 * element TYPE (namespaced BBS marks) followed by a project SUMMARY sheet (takeoff + grand totals),
 * and is hard-locked when ANY type is 🔴 FAIL (per-project export-lock). Deterministic with a date.
 */
import { describe, it, expect } from "vitest";
import { buildProjectPdf, ExportLockedError, type ProjectPdfType } from "@rebarconfig/exporters";
import { PDFDocument } from "pdf-lib";
import type { SolveResult } from "@rebarconfig/core";
import { referenceBeam } from "./bbs-helpers";

const withStatus = (s: SolveResult["status"]): SolveResult => ({ ...referenceBeam(), status: s });
const header = (b: Uint8Array) => String.fromCharCode(...b.subarray(0, 5));

describe("buildProjectPdf — combined multi-element export (§9.3 / Feature C.1)", () => {
  const types: ProjectPdfType[] = [
    { result: referenceBeam(), mark: "B1", quantity: 2 },
    { result: referenceBeam(), mark: "B2", quantity: 3 },
  ];

  it("emits one sheet per type + a project summary sheet", async () => {
    const bytes = await buildProjectPdf(types, { date: "2026-06-25", projectName: "Projet" });
    expect(header(bytes)).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(types.length + 1); // sheet per type + summary
  });

  it("per-project lock: ANY 🔴 FAIL type blocks the WHOLE set before any page is drawn", async () => {
    const withFail: ProjectPdfType[] = [...types, { result: withStatus("FAIL"), mark: "B3", quantity: 1 }];
    await expect(buildProjectPdf(withFail)).rejects.toBeInstanceOf(ExportLockedError);
  });

  it("is deterministic when a fixed date is supplied", async () => {
    const a = await buildProjectPdf(types, { date: "2026-06-25", projectName: "X" });
    const b = await buildProjectPdf(types, { date: "2026-06-25", projectName: "X" });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
