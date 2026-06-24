import fs from "node:fs";
import path from "node:path";
import type { ShapeArchetype } from "@rebarconfig/core";
import { MANIFESTS_DIR } from "./helpers";

/** Load a shape manifest by file stem (e.g. "cadre_rect") as a typed ShapeArchetype. */
export function loadShape(stem: string): ShapeArchetype {
  const file = path.join(MANIFESTS_DIR, "shapes", `${stem}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as ShapeArchetype;
}
