/**
 * PDF sheet smoke (spec §9.3 + §7.9, plan P5). The sheet generates for 🟢 PASS and 🟠 WARN (with
 * the coupe view boxes + status stamp); a 🔴 FAIL hard-locks export (assert the lock).
 */
import { describe, it, expect } from "vitest";
import { buildPdf, computeBBS, ExportLockedError, statusStamp, canExport } from "@rebarconfig/exporters";
import type { SolveResult } from "@rebarconfig/core";
import { referenceBeam } from "./bbs-helpers";

const withStatus = (s: SolveResult["status"]): SolveResult => ({ ...referenceBeam(), status: s });
const header = (bytes: Uint8Array) => String.fromCharCode(...bytes.subarray(0, 5));

describe("pdf_smoke (§9.3, §7.9)", () => {
  it("generates a PDF for a 🟢 PASS element", async () => {
    const bytes = await buildPdf(withStatus("PASS"), { projectName: "Test", date: "2026-06-24" });
    expect(header(bytes)).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(800);
  });

  it("generates a PDF for a 🟠 WARN element and stamps 'À vérifier'", async () => {
    expect(canExport(withStatus("WARN"))).toBe(true);
    const bytes = await buildPdf(withStatus("WARN"), { date: "2026-06-24" });
    expect(header(bytes)).toBe("%PDF-");
    expect(statusStamp("WARN").fr).toBe("À vérifier");
  });

  it("the BBS record carries the review flag for WARN (stamped on the fiche)", () => {
    expect(computeBBS(withStatus("WARN")).reviewRequired).toBe(true);
    expect(computeBBS(withStatus("PASS")).reviewRequired).toBe(false);
    expect(computeBBS(withStatus("WARN")).status).toBe("WARN");
  });

  it("🔴 FAIL hard-locks export (§7.9)", async () => {
    expect(canExport(withStatus("FAIL"))).toBe(false);
    await expect(buildPdf(withStatus("FAIL"))).rejects.toBeInstanceOf(ExportLockedError);
  });

  it("is deterministic when a fixed date is supplied", async () => {
    const a = await buildPdf(withStatus("PASS"), { date: "2026-06-24", projectName: "X" });
    const b = await buildPdf(withStatus("PASS"), { date: "2026-06-24", projectName: "X" });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
