/**
 * P0 contract test — deliberately-broken fixtures FAIL validation at the expected path.
 * Spec §11, §12 M0.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateManifest, type ManifestKind } from "@rebarconfig/core/integrity";
import { FIXTURES_DIR } from "./helpers";

const CASES: { file: string; kind: ManifestKind; expect: RegExp }[] = [
  { file: "shape-missing-segments.json", kind: "shape", expect: /segments/ },
  { file: "shape-bad-hook-angle.json", kind: "shape", expect: /angle|oneOf|hookSpec|allowed/i },
  { file: "rcfg-missing-version.json", kind: "rcfg", expect: /rcfg_version/ },
  { file: "rcfg-rebar-missing-fields.json", kind: "rcfg", expect: /shapeArchetypeId|distribution|placement|params/ },
];

describe("invalid fixtures are rejected", () => {
  for (const c of CASES) {
    it(`${c.file} fails validation`, () => {
      const obj = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, "invalid", c.file), "utf8"));
      const res = validateManifest(c.kind, obj);
      expect(res.valid).toBe(false);
      expect(res.errors.join(" | ")).toMatch(c.expect);
    });
  }
});
