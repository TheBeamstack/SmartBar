/**
 * CI gate (spec §2.1): @rebarconfig/core stays framework-agnostic — no React/three/DOM.
 * Run: `npm run check:purity`. Mirrors tests/engine-purity.spec.ts as a standalone check
 * (so it runs even if the test runner is unavailable).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE_SRC = path.join(REPO_ROOT, "packages/core/src");

const FORBIDDEN = [
  /\bfrom\s+["']react["']/,
  /\bfrom\s+["']react-dom["']/,
  /\bfrom\s+["']three["']/,
  /\bfrom\s+["']@react-three\//,
  /\bdocument\s*\./,
  /\bwindow\s*\./,
];

function tsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(full));
    else if (e.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

// scan code only — strip block/line comments so prose like "JSON document." is ignored.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const offenders = [];
for (const file of tsFiles(CORE_SRC)) {
  const src = stripComments(fs.readFileSync(file, "utf8"));
  for (const rx of FORBIDDEN) {
    if (rx.test(src)) offenders.push(`${path.relative(REPO_ROOT, file)} matches ${rx}`);
  }
}

if (offenders.length > 0) {
  console.error(`✗ engine purity FAILED:`);
  for (const o of offenders) console.error(`  - ${o}`);
  process.exit(1);
}
console.log("✓ engine purity OK — core is framework-agnostic");
