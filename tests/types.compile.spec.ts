/**
 * P0 contract test — type-level assertions on the frozen contracts (spec §0.2.1, §10, §5.1.1).
 * Uses vitest expectTypeOf (compile-time checks; runtime body is a no-op assert).
 */
import { describe, it, expectTypeOf } from "vitest";
import type {
  BarGroup,
  ReinforcingElement,
  Distribution,
  FixedCountDistribution,
  SpacingAlongPathDistribution,
} from "@rebarconfig/core";

describe("type contracts", () => {
  it("BarGroup has the §10 serialized fields with the REBAR_GROUP discriminant", () => {
    expectTypeOf<BarGroup["kind"]>().toEqualTypeOf<"REBAR_GROUP">();
    expectTypeOf<BarGroup>().toHaveProperty("id");
    expectTypeOf<BarGroup>().toHaveProperty("role");
    expectTypeOf<BarGroup>().toHaveProperty("shapeArchetypeId");
    expectTypeOf<BarGroup>().toHaveProperty("diameter");
    expectTypeOf<BarGroup>().toHaveProperty("distribution");
    expectTypeOf<BarGroup>().toHaveProperty("placement");
    expectTypeOf<BarGroup["diameter"]>().toEqualTypeOf<number>();
  });

  it("ReinforcingElement is a discriminated union open to unknown future kinds", () => {
    // A BarGroup is assignable to the supertype …
    expectTypeOf<BarGroup>().toMatchTypeOf<ReinforcingElement>();
    // … and so is an unknown-kind carrier (forward-compat, §10).
    const tendonLike = { id: "t1", kind: "TENDON", profile: "parabolic" };
    expectTypeOf(tendonLike).toMatchTypeOf<ReinforcingElement>();
  });

  it("Distribution is a union over the serialized modes (§5.1.1)", () => {
    expectTypeOf<FixedCountDistribution>().toMatchTypeOf<Distribution>();
    expectTypeOf<SpacingAlongPathDistribution>().toMatchTypeOf<Distribution>();
    expectTypeOf<FixedCountDistribution["mode"]>().toEqualTypeOf<"FIXED_COUNT">();
  });
});
