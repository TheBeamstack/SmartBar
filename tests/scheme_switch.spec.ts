/**
 * Scheme → zone mapping (spec §5.3). Selecting a scheme maps its base groups onto the
 * element's declared zones; switching schemes remaps wholesale (no stale groups).
 */
import { describe, it, expect } from "vitest";
import { resolveScheme, type SchemeManifestView } from "@rebarconfig/core";
import { loadElement, loadScheme } from "./p3-helpers";

describe("scheme switch / zone mapping (§5.3)", () => {
  it("maps a column scheme's base groups onto its declared zones", () => {
    const el = loadElement("E-COL-01");
    const r = resolveScheme(loadScheme("E-COL-01", "col-ties-crosstie"), el);
    expect(r.errors).toEqual([]);
    expect([...r.coveredZones].sort()).toEqual(["As_total", "Asw_confinement"]);
    expect(r.uncoveredZones).toEqual([]);
    expect(r.groups.map((g) => g.zone)).toEqual(["As_total", "Asw_confinement"]);
    expect(r.groups[0]!.zoneKind).toBe("longitudinal");
    expect(r.groups[1]!.zoneKind).toBe("transverse");
  });

  it("switching schemes replaces the mapping cleanly (no leftover groups)", () => {
    const el = loadElement("E-COL-01");
    const a = resolveScheme(loadScheme("E-COL-01", "col-ties-crosstie"), el);
    const b = resolveScheme(loadScheme("E-COL-01", "col-ties"), el);
    expect(a.supplementalCatalog).toContain("SUPP_EPINGLE_CROSSTIE");
    expect(b.groups.length).toBe(2);
    expect([...b.coveredZones].sort()).toEqual(["As_total", "Asw_confinement"]);
    // group ids are scheme-scoped, so they never collide across a switch
    expect(b.groups[0]!.groupId.startsWith("COL_TIES:")).toBe(true);
  });

  it("maps the beam scheme onto its three zones and carries its profile", () => {
    const el = loadElement("E-BEM-01");
    const r = resolveScheme(loadScheme("E-BEM-01", "beam-span-chapeaux-releves"), el);
    expect(r.errors).toEqual([]);
    expect([...r.coveredZones].sort()).toEqual([
      "As_span_bottom",
      "As_top_support",
      "Asw_shear",
    ]);
    expect(r.validationProfile).toBe("BAEL_BEAM");
  });

  it("flags a base group bound to an undeclared zone (and leaves the zone uncovered)", () => {
    const el = loadElement("E-COL-01");
    const bad: SchemeManifestView = {
      id: "BAD",
      elementType: "E-COL-01",
      baseGroups: [{ role: "PRIMARY_LONGITUDINAL", zone: "As_nope", shape: "DROITE" }],
    };
    const r = resolveScheme(bad, el);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.uncoveredZones).toContain("As_total");
  });
});
