/**
 * Export lock (spec §7.9, §0.1) — a 🔴 FAIL state hard-locks export compilation. The PDF (the
 * compiled deliverable) refuses to build on FAIL; WARN compiles but is stamped "À vérifier".
 */
import type { SolveResult } from "@rebarconfig/core";

/** Thrown when an export is attempted on a 🔴 FAIL element (§7.9). */
export class ExportLockedError extends Error {
  constructor(public readonly element: string) {
    super(
      `Export locked: "${element}" has a FAIL (🔴) status — fix the blocking rules before exporting (spec §7.9).`,
    );
    this.name = "ExportLockedError";
  }
}

/** True when the element may be exported (PASS or WARN); FAIL is locked (§7.9). */
export function canExport(result: Pick<SolveResult, "status">): boolean {
  return result.status !== "FAIL";
}

/** Throw `ExportLockedError` if the element is in a FAIL state (§7.9). */
export function assertExportable(result: Pick<SolveResult, "status" | "element">): void {
  if (!canExport(result)) throw new ExportLockedError(result.element);
}

/** The review banner text per status (spec §7.9/§7.12) — FR + EN. */
export interface StatusStamp {
  status: "PASS" | "WARN";
  fr: string;
  en: string;
  /** advisory hex colour for the stamp (green/orange). */
  color: string;
}

export function statusStamp(status: SolveResult["status"]): StatusStamp {
  if (status === "WARN") {
    return { status: "WARN", fr: "À vérifier", en: "Review required", color: "#E8A23D" };
  }
  return { status: "PASS", fr: "Conforme", en: "Compliant", color: "#3DA35D" };
}
