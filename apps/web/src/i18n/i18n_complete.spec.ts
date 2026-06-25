/**
 * P6 i18n completeness (spec §8/§11). Two guarantees:
 *  1. The FR and EN UI bundles have the EXACT same key tree and no empty strings — a missing
 *     translation is caught here, not rendered as a runtime blank.
 *  2. Every UI-exposed manifest (shapes/elements/schemes/supplements) carries both `label_fr` and
 *     `label_en`, so the catalog dropdowns + lists are fully bilingual.
 */
import { describe, it, expect } from "vitest";
import { BUNDLES } from "./strings";
import { SHAPES, ELEMENTS, SCHEMES, SUPPLEMENTS } from "../engine/manifests";

/** Recursively collect dotted key paths + flag any non-string / empty leaf. */
function leaves(obj: unknown, prefix = ""): { keys: string[]; empties: string[] } {
  const keys: string[] = [];
  const empties: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      const sub = leaves(v, path);
      keys.push(...sub.keys);
      empties.push(...sub.empties);
    } else {
      keys.push(path);
      if (typeof v !== "string" || v.trim() === "") empties.push(path);
    }
  }
  return { keys, empties };
}

describe("i18n bundle completeness (§8)", () => {
  const fr = leaves(BUNDLES.fr);
  const en = leaves(BUNDLES.en);

  it("FR and EN have identical key trees", () => {
    expect(new Set(en.keys)).toEqual(new Set(fr.keys));
  });

  it("no key is empty in either language", () => {
    expect(fr.empties).toEqual([]);
    expect(en.empties).toEqual([]);
  });
});

describe("manifest label bilingualism (§5.3)", () => {
  const registries = { ...SHAPES, ...ELEMENTS, ...SCHEMES, ...SUPPLEMENTS } as Record<
    string,
    { id?: string; label_fr?: string; label_en?: string }
  >;

  it("every UI-exposed manifest carries non-empty label_fr + label_en", () => {
    const missing: string[] = [];
    for (const [key, m] of Object.entries(registries)) {
      if (!m.label_fr?.trim()) missing.push(`${key}.label_fr`);
      if (!m.label_en?.trim()) missing.push(`${key}.label_en`);
    }
    expect(missing).toEqual([]);
  });
});
