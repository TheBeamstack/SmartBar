# roadmap_directions.md — Directions for work BEYOND the complete single-tenant product

> **Scope change (2026-07-05).** The product-completeness tracks **A–E** that used to live here (compliance
> truthfulness, detailing depth, site-ready output, 3D fidelity, data/interop) have been **folded into
> `v1.0.4_spec.md`** — the authoritative build contract for the *complete single-tenant SmartBar*. This file now
> holds only what remains **beyond** that: the platform-quality *infrastructure* (Track **F**), the breadth
> expansion (Track **G**), and the vertical / multi-tenant / backend arc (Track **H**). The **façonnage** flow +
> A–E are the spec; read that first.
>
> Each track below stays as **direction, not a spec**: *goal link · evidence (cited) · direction · scope boundary ·
> depends-on*. Absolute-date any "later" before it enters a real spec.

**The goal (from `core_logic.md`).** A **buildable, code-checked, site-ready** rebar design (3D + BBS + drawings),
**instant, in the browser**, on a **generic data-driven engine** that grows to any element, any code, and a backend
**without a rewrite**. `v1.0.4_spec.md` completes the single-tenant product against that sentence; the tracks here
grow it wider and take it to the cloud.

---

## TRACK F — Platform-quality infrastructure (ongoing; the per-feature bar is already in the spec)

> The *per-feature* quality bar — tests + a11y + the <16 ms budget on every feature — is a **hard invariant of
> `v1.0.4_spec §0.4`**, not a track. What remains here is the **infrastructure**: an enforced gate + a scaling
> harness that outlive any single feature.

### F1 — Enforced coverage-gate widening (beyond the prep characterization)
- **Goal link:** *trustworthy engine.* The critical adapter logic (`solveDoc.ts`) + the exporters sit **outside**
  the core-only enforced coverage gate.
- **Done in prep:** the adapter is now *characterized* + *measurable* (`v1.0.4_prep_results.md` P0.3 —
  `npm run coverage:adapter` ≈ 96%), but not yet *enforced* in `npm run check`.
- **Direction:** promote `apps/web/src/engine` + `packages/exporters` into the enforced gate with real thresholds;
  keep the core-only gate as-is.
- **Depends on:** the v1.0.4 adapter rewrites settling (H1/H2/H11/H13) so the enforced number is stable.

### F2 — Performance & scaling harness
- **Goal link:** *instant (<16 ms).* Bar-by-bar detailing multiplies `longBars`/instances.
- **Evidence:** perf cases exist (`D-V103-1`, `perf_heavy`) but predate heavy addressable use; a column with dozens
  of overrides + extras + splices was never load-tested.
- **Direction:** perf fixtures for addressable-heavy + multi-element projects; verify the solve/place/BBS loop holds
  the budget; profile the adapter's per-bar regeneration (H1 makes it conditional — confirm no needless regen).

*(F3 a11y completion is now absorbed into `v1.0.4_spec §0.4` as a per-feature invariant — no longer a standalone
track.)*

---

## TRACK G — Breadth (the "grow wide" bet — `core_logic §9.1 [later]`)

Each is **a new data manifest + profile, no engine rewrite** (`D-P4a-1`, hard rule §3.1).
- **G1 — More elements:** shear walls, isolated/strap footings, waffle slabs, retaining walls, L- and spiral
  stairs. Each = manifest + validation profile.
- **G2 — More codes:** the full EC2 rule-set (beyond the v1.0.4 A3 *wiring*), then **BS 8666 / ACI 315** conventions
  (bar shape codes, labelling) — data + a pack, plus the spec's C2 drawing conventions.
- **G3 — Prestressing / tendons:** a new `ReinforcingElement.kind` — the `.rcfg` slot is **already reserved**
  (`D-P0-2` preserves unknown kinds). New geometry (bespoke, `D-P4a-1`) + a code pack + drawing.
- **G4 — Opt-in "proposer":** suggest the smallest valid bar set — **never automatic** (`core_logic §3`). A pure
  search over the existing validator; opt-in convenience, not a design authority.

---

## TRACK H — Vertical / v1.1 (needs a backend — `core_logic §9.2`)

The engine is deliberately framework-free so it runs **unchanged** on a server (`D-P5-4`).
- **Accounts, cloud sync, teams (multi-tenant).**
- **IFC export** (`IfcReinforcingBar` / `IfcReinforcingMesh`) — depends on the spec's **E1** (canonical model).
- **A building-aware project** — storeys, grids, positions, cross-element schedules, BIM coordinates — vs. today's
  flat typed-instance list (`D-P7-1`).

---

## Appendix — Traceability (gap → source) for the tracks that remain here

| Track | Grounded in |
|---|---|
| F1 | `current_state §1` coverage note; `v1.0.4_prep_results.md` P0.3 |
| F2 | `D-V103-1` perf; growth of addressable use |
| G/H | `core_logic §9.1/§9.2` |

*(Tracks A–E and their traceability now live in `v1.0.4_spec.md` §I–§VI + §8.)*
