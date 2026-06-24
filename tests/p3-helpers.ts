import fs from "node:fs";
import path from "node:path";
import type {
  ShapeArchetype,
  ElementManifestView,
  SchemeManifestView,
  SupplementManifestView,
} from "@rebarconfig/core";
import { MANIFESTS_DIR } from "./helpers";

const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

export function loadShape(stem: string): ShapeArchetype {
  return read(path.join(MANIFESTS_DIR, "shapes", `${stem}.json`)) as ShapeArchetype;
}
export function loadElement(id: string): ElementManifestView {
  return read(path.join(MANIFESTS_DIR, "elements", `${id}.json`)) as ElementManifestView;
}
export function loadScheme(elementId: string, stem: string): SchemeManifestView {
  return read(path.join(MANIFESTS_DIR, "schemes", elementId, `${stem}.json`)) as SchemeManifestView;
}
export function loadSupplement(id: string): SupplementManifestView {
  return read(path.join(MANIFESTS_DIR, "supplements", `${id}.json`)) as SupplementManifestView;
}
