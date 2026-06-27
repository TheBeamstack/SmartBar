/**
 * ViewCube pure camera-state (spec v1.0.1 Feature A §1.8). The GPU widget is verified by hand on a
 * browser, but its logic core — the 26 named views, the FRONT→+Z mapping, the iso default, and the
 * element-aware member-group rotation — is pure and asserted here, exactly as v1.0 unit-tests
 * `rebarProps`/`sectionAt` without a GPU.
 */
import { describe, it, expect } from "vitest";
import {
  NAMED_VIEWS,
  viewById,
  defaultViewDir,
  memberGroupRotation,
  memberGroupRotationFor,
  DEFAULT_VIEW_ID,
} from "./cameraState";

describe("ViewCube camera-state", () => {
  it("exposes 26 named views: 6 faces + 12 edges + 8 corners", () => {
    expect(NAMED_VIEWS).toHaveLength(26);
    expect(NAMED_VIEWS.filter((v) => v.kind === 1)).toHaveLength(6);
    expect(NAMED_VIEWS.filter((v) => v.kind === 2)).toHaveLength(12);
    expect(NAMED_VIEWS.filter((v) => v.kind === 3)).toHaveLength(8);
  });

  it("FRONT looks along +Z, TOP along +Y, RIGHT along +X", () => {
    expect(viewById("FRONT")!.dir).toEqual([0, 0, 1]);
    expect(viewById("TOP")!.dir).toEqual([0, 1, 0]);
    expect(viewById("RIGHT")!.dir).toEqual([1, 0, 0]);
  });

  it("the default view is the front-right-top isometric (a unit vector in the +,+,+ octant)", () => {
    expect(DEFAULT_VIEW_ID).toBe("TOP_FRONT_RIGHT");
    const d = defaultViewDir();
    expect(d[0]).toBeGreaterThan(0);
    expect(d[1]).toBeGreaterThan(0);
    expect(d[2]).toBeGreaterThan(0);
    expect(Math.hypot(...d)).toBeCloseTo(1, 6);
  });

  it("element-aware default: a column stands upright (identity); a beam lies horizontal (−90° about Z)", () => {
    expect(memberGroupRotation("VERTICAL")).toEqual([0, 0, 0]);
    expect(memberGroupRotation("HORIZONTAL")).toEqual([0, 0, -Math.PI / 2]);
    expect(memberGroupRotationFor("E-COL-01")).toEqual([0, 0, 0]);
    expect(memberGroupRotationFor("E-BEM-01")).toEqual([0, 0, -Math.PI / 2]);
  });

  it("every named view is a unit direction with a bilingual label", () => {
    for (const v of NAMED_VIEWS) {
      expect(Math.hypot(...v.dir)).toBeCloseTo(1, 6);
      expect(v.label_fr.length).toBeGreaterThan(0);
      expect(v.label_en.length).toBeGreaterThan(0);
    }
  });
});
