/**
 * P0 invariant test — @rebarconfig/core must stay framework-agnostic (spec §2.1).
 * No source file under packages/core/src may import React, three, react-dom, or touch
 * the DOM (window/document). This is what makes the engine testable and reusable in the
 * 1.1 server. The same scan runs as a standalone CI gate (scripts/check-engine-purity.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers";

const CORE_SRC = path.join(REPO_ROOT, "packages/core/src");
const FORBIDDEN = [
  /\bfrom\s+["']react["']/,
  /\bfrom\s+["']react-dom["']/,
  /\bfrom\s+["']three["']/,
  /\bfrom\s+["']@react-three\//,
  /\bdocument\s*\./,
  /\bwindow\s*\./,
];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(full));
    else if (e.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

// scan code only — strip comments so prose ("JSON document.") is not a false positive.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("engine purity", () => {
  it("no core source imports React/three or touches the DOM", () => {
    const offenders: string[] = [];
    for (const file of tsFiles(CORE_SRC)) {
      const src = stripComments(fs.readFileSync(file, "utf8"));
      for (const rx of FORBIDDEN) {
        if (rx.test(src)) offenders.push(`${path.relative(REPO_ROOT, file)} matches ${rx}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
