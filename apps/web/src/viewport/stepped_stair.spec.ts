/**
 * v1.0.4 D1 (spec Part V D1) — the pure stepped-stair geometry: n tread boxes to the base + the new
 * top LANDING slab (`landing_L`, previously not modelled, D-V103-8). Headless math test; the GPU
 * acceptance (bars sit in the treads, the landing reads right) is the owner's pass (§D-2).
 */
import { describe, it, expect } from "vitest";
import { steppedStairSpec } from "./steppedStair";

const G = 280, R = 170, N = 12, WIDTH = 1200, WAIST = 180, LANDING = 1000;
const base = { g: G, r: R, n_steps: N, flight_width: WIDTH, waist_t: WAIST };
const L = N * G;
const RISE = N * R;

describe("D1 — stepped-stair tread boxes", () => {
  const spec = steppedStairSpec(base, 999);

  it("emits one solid box per tread", () => {
    expect(spec.steps).toHaveLength(N);
  });

  it("tread heights grow one riser per step (solid to the base)", () => {
    expect(spec.steps[0]!.size[2]).toBeCloseTo(R, 6);
    expect(spec.steps[N - 1]!.size[2]).toBeCloseTo(N * R, 6);
    for (let i = 1; i < N; i++) expect(spec.steps[i]!.size[2]).toBeGreaterThan(spec.steps[i - 1]!.size[2]);
  });

  it("treads span the run, each the flight width × going", () => {
    expect(spec.steps[0]!.position[1]).toBeCloseTo(-L / 2 + G / 2, 6);
    expect(spec.steps[N - 1]!.position[1]).toBeCloseTo(L / 2 - G / 2, 6);
    for (const s of spec.steps) {
      expect(s.size[0]).toBe(WIDTH); // width
      expect(s.size[1]).toBe(G); // going
    }
  });

  it("uses the fallback width when geometry omits flight_width", () => {
    const s = steppedStairSpec({ g: G, r: R, n_steps: 3 }, 777);
    expect(s.steps[0]!.size[0]).toBe(777);
  });
});

describe("D1 — the top landing slab (landing_L)", () => {
  it("models a landing past the flight, top-aligned with the top tread, waist-thick", () => {
    const spec = steppedStairSpec({ ...base, landing_L: LANDING }, 999);
    expect(spec.landing).not.toBeNull();
    const lg = spec.landing!;
    expect(lg.size).toEqual([WIDTH, LANDING, WAIST]); // width × landing run × waist thickness
    expect(lg.position[1]).toBeCloseTo(L / 2 + LANDING / 2, 6); // extends PAST the flight (+Y)
    // its TOP surface aligns with the top tread's top (R/2 in the centred frame)
    expect(lg.position[2] + lg.size[2] / 2).toBeCloseTo(RISE / 2, 6);
  });

  it("has no landing when landing_L is absent or zero", () => {
    expect(steppedStairSpec(base, 999).landing).toBeNull();
    expect(steppedStairSpec({ ...base, landing_L: 0 }, 999).landing).toBeNull();
  });

  it("is deterministic", () => {
    const g = { ...base, landing_L: LANDING };
    expect(steppedStairSpec(g, 999)).toEqual(steppedStairSpec(g, 999));
  });
});
