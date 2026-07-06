/**
 * A3 ([v1.0.4]) — the BAEL↔EC2 code pick is stored on the doc and round-trips through `.rcfg`
 * (canonical `codePack` field + the lossless `meta.app_document` carry). A prior file with no
 * `codePack` loads as BAEL (additive, forward-compatible).
 */
import { describe, it, expect } from "vitest";
import { defaultColumnDoc, type ColumnDoc } from "./document";
import { docToRcfg, rcfgToDoc } from "./rcfgDoc";

const roundTrip = (doc: ColumnDoc): ColumnDoc =>
  rcfgToDoc(JSON.parse(JSON.stringify(docToRcfg(doc, [])))) as ColumnDoc;

describe("A3 — code picker persists + round-trips", () => {
  it("EC2 survives a .rcfg round-trip (canonical field + app_document)", () => {
    const doc: ColumnDoc = { ...defaultColumnDoc(), codePack: "EC2" };
    const project = docToRcfg(doc, []);
    expect(project.codePack).toBe("EC2"); // canonical §10 field follows the picker
    expect(roundTrip(doc).codePack).toBe("EC2"); // lossless doc reload
  });

  it("BAEL round-trips as BAEL-FR canonically", () => {
    const doc: ColumnDoc = { ...defaultColumnDoc(), codePack: "BAEL" };
    expect(docToRcfg(doc, []).codePack).toBe("BAEL-FR");
    expect(roundTrip(doc).codePack).toBe("BAEL");
  });

  it("a legacy doc with no codePack loads as BAEL (forward-compat, additive)", () => {
    const doc = defaultColumnDoc(); // no codePack authored
    expect(doc.codePack).toBeUndefined();
    expect(docToRcfg(doc, []).codePack).toBe("BAEL-FR"); // defaults to BAEL
  });
});
