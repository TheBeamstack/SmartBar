/**
 * CI gate (spec §11): validate every manifest under apps/web/manifests against its JSON
 * Schema + cross-reference checks. Exit non-zero on any error so broken manifests fail
 * CI, not users. Run: `npm run check:manifests`.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkManifestDir } from "@rebarconfig/core/integrity";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFESTS_DIR = path.join(REPO_ROOT, "apps/web/manifests");

const { errors, counts } = checkManifestDir(MANIFESTS_DIR);

if (errors.length > 0) {
  console.error(`✗ manifest integrity FAILED (${errors.length} error(s)):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ manifest integrity OK —`, counts);
