/**
 * P0 contract test — every shipped manifest + valid fixture validates against its JSON Schema.
 * Spec §11 (manifest-integrity gate), §12 M0.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateManifest, type ManifestKind } from "@rebarconfig/core";
import { MANIFESTS_DIR, FIXTURES_DIR } from "./helpers";

function jsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonFiles(full));
    else if (e.name.endsWith(".json")) out.push(full);
  }
  return out;
}

const SUBDIRS: { kind: ManifestKind; sub: string }[] = [
  { kind: "shape", sub: "shapes" },
  { kind: "element", sub: "elements" },
  { kind: "scheme", sub: "schemes" },
  { kind: "supplement", sub: "supplements" },
];

describe("manifests validate against schema", () => {
  for (const { kind, sub } of SUBDIRS) {
    const files = jsonFiles(path.join(MANIFESTS_DIR, sub));
    it(`${sub}/ has at least one manifest`, () => expect(files.length).toBeGreaterThan(0));
    for (const file of files) {
      it(`${kind}: ${path.basename(file)} is valid`, () => {
        const obj = JSON.parse(fs.readFileSync(file, "utf8"));
        const res = validateManifest(kind, obj);
        expect(res.errors).toEqual([]);
        expect(res.valid).toBe(true);
      });
    }
  }
});

describe("valid .rcfg fixtures validate", () => {
  for (const file of jsonFiles(path.join(FIXTURES_DIR, "valid"))) {
    it(`rcfg: ${path.basename(file)} is valid`, () => {
      const obj = JSON.parse(fs.readFileSync(file, "utf8"));
      const res = validateManifest("rcfg", obj);
      expect(res.errors).toEqual([]);
      expect(res.valid).toBe(true);
    });
  }
});
