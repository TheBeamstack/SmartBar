/**
 * P0 contract test — the manifest-integrity cross-reference gate (spec §11).
 * Happy path: the shipped manifests cross-reference cleanly.
 * Negative: a scheme referencing a missing zone / shape / supplement is flagged;
 * an out-of-scope archetype expression symbol is flagged (§5.2.1f).
 */
import { describe, expect, it } from "vitest";
import { checkManifestDir, crossReferenceCheck } from "@rebarconfig/core";
import { MANIFESTS_DIR } from "./helpers";

describe("integrity gate — happy path", () => {
  it("ships clean: no schema or cross-reference errors", () => {
    const { errors, counts } = checkManifestDir(MANIFESTS_DIR);
    expect(errors).toEqual([]);
    expect(counts.shapes).toBeGreaterThan(0);
    expect(counts.elements).toBeGreaterThan(0);
    expect(counts.schemes).toBeGreaterThan(0);
  });
});

describe("cross-reference checks catch dangling references", () => {
  const shapes = [
    { id: "DROITE", params: [{ key: "L" }], totalLengthExpr: "L", segments: [], endHooks: {} },
  ];
  const elements = [{ id: "E-COL-01", As_zones: [{ key: "As_total" }] }];
  const supplements = [{ id: "SUPP_EPINGLE_CROSSTIE", shape: "DROITE" }];

  it("flags a baseGroup zone that the element does not declare", () => {
    const errors = crossReferenceCheck({
      shapes,
      elements,
      supplements,
      schemes: [
        { id: "S1", elementType: "E-COL-01", baseGroups: [{ role: "PRIMARY_LONGITUDINAL", shape: "DROITE", zone: "As_nonexistent" }] },
      ],
    });
    expect(errors.join(" | ")).toMatch(/missing zone "As_nonexistent"/);
  });

  it("flags a baseGroup referencing a shape that does not exist", () => {
    const errors = crossReferenceCheck({
      shapes,
      elements,
      supplements,
      schemes: [
        { id: "S2", elementType: "E-COL-01", baseGroups: [{ role: "TRANSVERSE", shape: "NOT_A_SHAPE", zone: "As_total" }] },
      ],
    });
    expect(errors.join(" | ")).toMatch(/missing shape "NOT_A_SHAPE"/);
  });

  it("flags a supplementalCatalog entry with no matching supplement", () => {
    const errors = crossReferenceCheck({
      shapes,
      elements,
      supplements,
      schemes: [
        { id: "S3", elementType: "E-COL-01", baseGroups: [{ role: "TRANSVERSE", shape: "DROITE", zone: "As_total" }], supplementalCatalog: ["SUPP_GHOST"] },
      ],
    });
    expect(errors.join(" | ")).toMatch(/missing supplement "SUPP_GHOST"/);
  });

  it("flags an out-of-scope expression symbol in an archetype (§5.2.1f)", () => {
    const errors = crossReferenceCheck({
      elements,
      supplements: [],
      schemes: [],
      shapes: [
        { id: "BAD_EXPR", params: [{ key: "a" }], totalLengthExpr: "a + bogusSymbol", segments: [], endHooks: {} },
      ],
    });
    expect(errors.join(" | ")).toMatch(/out-of-scope symbol "bogusSymbol"/);
  });
});
