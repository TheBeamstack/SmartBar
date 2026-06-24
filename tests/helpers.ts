import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const MANIFESTS_DIR = path.join(REPO_ROOT, "apps/web/manifests");
export const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures");
