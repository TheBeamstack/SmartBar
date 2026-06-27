# architecture_breakdown.md — How RebarConfig (SmartBar) is built

> **Audience.** Developers and technical reviewers. This is the structural map of the codebase: the
> layers, the rules that shape them, the data flow, the **extension seams**, and the **architectural
> direction**. For the product in plain language see `core_logic.md`; for the build contract,
> `v1.0-Spec.md` and `v1.0.1-Spec.md`; for the live as-built log, `current_state.md`.
>
> **Direction-aware.** Sections tagged **[now]** exist today; **[next]** = v1.0.1 (breadth, no
> backend); **[later]** = v1.1 (depth — server, accounts, IFC). The whole point of the architecture is
> that **[next]** and **[later]** drop into existing seams **without an engine rewrite**.

---

## 1. The big picture

RebarConfig is a **monorepo** (npm workspaces) with a hard split between a **pure engine** and the
**app that drives it**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ apps/web  — React SPA (the ONLY place with DOM / React / Three.js)     │
│   adapter → store → viewport(3D) + ui(panels) + i18n + project model   │
└───────────────┬──────────────────────────────────────────────────────┘
                │ consumes (function calls, plain data in/out)
┌───────────────▼───────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ packages/core                 │  │ packages/codepacks   │  │ packages/exporters   │
│  THE PURE ENGINE              │◄─┤  BAEL / EC2 packs +   │  │  BBS · DXF · PDF ·    │
│  types · geometry · layout ·  │DI│  RPS seismic overlay  │  │  .rcfg I/O            │
│  validation · scheme ·        │  │  (behind interfaces)  │  │  (pure transforms of  │
│  pipeline · section · integr. │  └──────────────────────┘  │   a SolveResult)      │
│  NO DOM / React / three       │                            └──────────┬───────────┘
└───────────────────────────────┘                                       │ depends on core
                ▲                                                        │
                └──────────────── tests/ (contracts · golden · reference cases) ────┘
```

**Why this shape:** the engine is the asset. Keeping it framework-free means the *same* engine powers
the UI, the exporters, the tests, and — by design — the **future v1.1 server** (§11). React/Three are
disposable presentation; the engine is forever.

Workspaces: `packages/core` (`@rebarconfig/core`), `packages/codepacks`, `packages/exporters`,
`apps/web`, and `tests/`. Node 20 / npm 10, no pnpm. The workspace packages ship **raw TypeScript**
(no `dist` build) — Vite/vitest/tsx transpile the source directly.

---

## 2. The non-negotiable invariants (the rules that shape everything)

Every change is held to these. They are enforced by CI gates, not goodwill.

1. **Engine purity.** Nothing under `packages/core` imports React, `three`, or touches `window`/
   `document`. Geometry is plain number arrays. *Enforced by* `scripts/check-engine-purity.mjs` +
   `tests/engine-purity.spec.ts`. → This is what makes the engine reusable on a server.
2. **Determinism.** The solver is pure functions: same input → byte-identical output. No `Date.now()`,
   no `Math.random()` in core. → Golden-file tests; reproducible exports.
3. **Everything structural is data.** Elements/shapes/schemes/supplements/code rules are JSON
   manifests + registered functions. **No `if (elementType === …)` / `if (codePack === …)` in core.**
4. **SI internally, convert at the edge.** Engine stores mm, mm². The UI/IO converts to display units
   (cm², cm²/m, kg).
5. **Code-pack agnosticism.** Validation calls **named** `code.*` functions; BAEL vs EC2 swaps the
   implementation behind the names, nothing else.
6. **Forward-compatible persistence.** A `.rcfg` reader preserves unknown fields, unknown
   reinforcement `kind`s, and unknown elements on round-trip. A future file never loses data on an
   older reader.
7. **Every phase ends green.** `npm run check` (purity → manifest integrity → typecheck → web
   typecheck → tests) passes; coverage gate `npm run coverage` ≥ 90% on solver+validation.

---

## 3. `packages/core` — the pure engine

The heart. Subsystems (each a directory under `src/`):

- **`types/` — six frozen contracts** (the stable interfaces everything compiles against):
  `shape.ts` (segment-grammar archetypes), `distribution.ts` (count vs segmented spacing),
  `reinforcing-element.ts` (`ReinforcingElement` supertype + `BarGroup` + the `isBarGroup` guard —
  the future-tendon seam), `layout.ts` (layout-solver I/O incl. **computed effective depth `d`/`d'`**
  and `MemberPlacement` for world placement), `codepack.ts` (the `code.*` `CodePack` interface +
  `RuleResult`), `rcfg.ts` (the `.rcfg` envelope), plus `seismic.ts` (the `SeismicOverlay` interface).
- **`geometry/`** — the **segment-grammar generator** (`generateBarShape`: turtle model line/turn/arc/
  hook → 3D centreline + `cutLength` + the fabrication `fiche`), the **shape registry**
  (`registry.ts` → the single geometry seam), and the two **bespoke generators** `bespoke/helix.ts`
  (spiral) + `bespoke/mesh.ts` (welded mat). `expr.ts` evaluates archetype expressions against a
  frozen `mathjs` scope.
- **`layout/`** — cross-section bar placement: `rect.ts` (corner-shared rectangular layout +
  `computeZoneGeometry` for the real `d`), `circular.ts` (equal-perimeter pitch circle), `slab.ts`
  (per-metre 1-D lines).
- **`validation/`** — the compliance engine: `profiles.ts` (the **validation-profile registry** —
  `BAEL_COLUMN`/`BAEL_BEAM`/`CIRCULAR_COLUMN`/`SLAB_ONEWAY`/`SLAB_TWOWAY`/`STAIR`/`JOIST_SLAB`),
  `predicates.ts` (topological checks: distribution-min, corner-torsion, stair re-entrant pull-out),
  `seismic.ts` (`applySeismicOverlay` — composes RPS on top of the base profile), and the validity
  tiers / severity policy.
- **`scheme/`** — `resolve.ts`: maps a scheme's base groups onto an element's zones, resolves
  placement rules, and binds supplements **by stable bar indices** (so a base change re-solves
  dependents); `computeCurtailment` for chapeau lengths.
- **`pipeline/`** — the orchestrators that wire layout → shape-gen → validation into a pure
  `SolveResult`: the generic `element.ts` (`solveElement`, the one engine) + section-specific shims
  `circular.ts`, `slab.ts`, `stair.ts`, `joist.ts`, and the `solveColumn` convenience shim. **No
  element branching** — dispatch is by *section* (a data axis) + *profile id*.
- **`section/`** — the **Section/Coupe engine**: `place.ts` (`placeBars` → world 3D centrelines, the
  single source of placement), `sectionAt.ts` (`sectionAt(result, cut) → CoupeView`: pure plane ∩
  geometry), `convention.ts` (provisional coupe conventions), `types.ts`. One `CoupeView` feeds the
  3D preview, DXF, and PDF — written once.
- **`integrity/`** — the manifest-integrity gate (ajv JSON-Schema validation + cross-reference +
  expression-scope checks). **Node-only**, exposed as a subpath so it never enters the browser bundle.

**The central output type, `SolveResult`,** carries the solved groups, per-zone provided area + `d`,
the `RuleResult[]` validation list with tiers and `affectedGroupIds`, the `member` placement, and the
rolled-up status. Everything downstream (viewport, exporters, coupes) is a pure function of it.

---

## 4. `packages/codepacks` — pluggable rules (the swap seam)

Implements core's **injectable contracts**:
- **`CodePack`** — `makeBaelPack()` and `makeEc2Pack()` implement the same `code.*` names (area,
  spacing, cover, ratios, tie spacing, mandrel, anchorage/lap, …). Selecting EC2 vs BAEL swaps the
  implementation; the pipeline is identical (`pack_swap.spec` proves it). Constants live in
  `*-constants.json`, all flagged `"_provisional": true` until engineer sign-off.
- **`SeismicOverlay`** — `makeRpsOverlay(regime)` is a **second injectable contract**, parallel to
  `CodePack`, that *composes on top of* either base pack (injects critical-zone tie segments, forces
  135°/10φ hooks, tightens limits, promotes confinement to required). A future EC8/ASCE7 overlay is
  just another `makeXxxOverlay` — no engine change.

Core depends on the *interface*, never on this package — dependency injection keeps it acyclic and
pack-agnostic.

---

## 5. `packages/exporters` — the output engines

Pure transforms of a `SolveResult` / `CoupeView` (depends on core, mirrors the codepacks pattern):
`bbs.ts` (the §9.1 schedule + steel summary + cut-nesting), `dxf.ts` (a hand-rolled deterministic R12
writer on four strict layers), `pdf.ts` (vector sheet via `pdf-lib` — the only non-trivial dependency,
pure JS, no DOM), `rcfg.ts` (serialize/parse + migration registry + `AutosaveManager` over an
injectable `KeyValueStore`). BBS/DXF/.rcfg are dependency-free and golden-tested headlessly.

---

## 6. `apps/web` — the SPA (the only impure layer)

React 18 + Vite + **Zustand** (state) + **React-Three-Fiber / three.js** (3D). Structured so **no
engine logic leaks in** — it only marshals data and renders:

- **`engine/` (adapter — pure, *not* engine code):**
  - `document.ts` — the editable `ElementDoc` (`ColumnDoc | BeamDoc | GenericDoc`), the UI-convenience
    shape, with default factories.
  - `elementSpecs.ts` — **data-driven specs** for the six non-rect elements (geometry fields + zones),
    so a new element is a spec entry, not bespoke React.
  - `manifests.ts` — the JSON manifest registry (shapes/elements/schemes/supplements).
  - `solveDoc.ts` — marshals an `ElementDoc` → the engine's `solveElement` (injects the pack +
    archetypes; two-pass supplement solve). **No geometry/validation math here.**
  - `project.ts` / `projectRcfg.ts` / `projectTakeoff.ts` — the **Phase 7 project layer** (instances,
    project `.rcfg` envelope + migration, the quantity-aware steel takeoff).
  - `rcfgDoc.ts` / `exportActions.ts` — single-element `.rcfg` adapter + the browser download glue
    (pdf-lib is **lazy-imported** so it stays out of the initial bundle).
- **`store/useStore.ts` — the Zustand store.** Holds the **Project** (instances + `activeInstanceId`)
  and the active element's live `doc`/`result`/`cuts`. **Every mutation re-solves synchronously** in
  the same tick (well under the 16 ms budget). A "checkout" model syncs the active instance back into
  the project list before any project-wide read/export.
- **`viewport/`** — R3F renderer + `rebarProps.ts` (a **pure** mapper: `SolveResult` → world polylines
  + flags; unit-tested headlessly). The 3D components only instance/colour/clip; **all geometry comes
  from core's `placeBars`**. A drag-degradation path renders cheap lines mid-drag.
- **`ui/`** — the panels: `Navbar`, `Sidebar` (Schéma/Géométrie/Projet tabs + per-element controls +
  the symmetry selector + seismic picker), `AlertsPanel`, `SupplementsPanel`, `CoupePanel`,
  `BbsPanel`, `ProjectPanel`, `BottomPanel`, `useAutosave`.
- **`i18n/`** — typed FR/EN bundles (completeness asserted by a test).

---

## 7. The data flow (one edit, end to end)

```
user edits a control
   → store mutates the active ElementDoc
   → solveDoc(doc)  [adapter marshals conventions + injects the code pack]
   → solveElement(input)  [core: generic orchestrator]
       → solveRectLayout / circular / slab        (bar positions + computed d)
       → generateShape(...) per group              (centrelines + cutLength + fiche)
       → validationProfile(...) + applySeismicOverlay  (RuleResult[] + tiers)
       → roll up status, attach member placement
   → SolveResult (plain data)
   → store sets { doc, result, cuts }  (synchronous, same tick)
   → React re-renders:
        viewport  ← placeBars(result) → world polylines (failing bars red)
        alerts    ← result.validation
        badges    ← As,prov / As,req / d
        coupes    ← sectionAt(result, cut) → CoupeView (live SVG)
        exports   ← computeBBS / buildDxf / buildPdf (on demand)
```

The same `SolveResult` is the single truth for screen *and* paper.

---

## 8. The five extension seams (how it grows without a rewrite)

This is the architectural thesis (`v1.0-Spec.md §0.1`, the `REF-EXT-GAP-*` markers) made concrete:

| To add… | You touch… | NOT… |
|---|---|---|
| **A new element type** | a JSON `elements/*.json` manifest + (web) an `elementSpecs` entry + a registered validation profile | the solver, the viewport, the exporters |
| **A new bar shape** | a JSON `shapes/*.json` (generic grammar) **or** register one bespoke generator in the shape registry | the pipeline (it calls `generateShape`) |
| **A new scheme / supplement** | a JSON manifest under `schemes/` / `supplements/` | any code |
| **A new design code** | a new `CodePack` implementation behind the same `code.*` names | the pipeline / profiles |
| **A new reinforcement technology** (e.g. tendons) | a new `ReinforcingElement.kind` + its generator + a validation profile + a BBS mapper | the solver, store, viewport, `.rcfg` envelope |

Each seam is a *registry* or an *injected interface*, never a branch. New capability = new data or a
new registered function.

---

## 9. The project model layer (Phase 7) [now: core · next: combined exports]

The single-element engine is **unchanged**; the project is a **container** of independent per-element
solves:
- `Project = { meta, defaults, instances: ElementInstance[] }`; `ElementInstance = { mark, quantity,
  document }`. The store checks one instance out for live editing; `quantity` scales **totals only**
  (one solve per *type*).
- `.rcfg` becomes a **project envelope** (`rcfg_version 1.1`, top-level `elements[]`); a legacy 1.0
  single-element file **migrates to a 1-instance project**. Forward-compat preserves unknown
  instances/fields/kinds.
- `projectTakeoff` aggregates per-type **unit mass + density (kg/m³) + total mass** and **project grand
  totals**. **[next]** the combined PDF (sheet-per-type + summary), namespaced project-wide BBS, and a
  **per-project export-lock** (any 🔴 type blocks the set) complete in v1.0.1.

---

## 10. Persistence, quality & build gates

- **Persistence:** `.rcfg` JSON (download/import) + **IndexedDB autosave/recovery** behind an injected
  `KeyValueStore` (so it's unit-tested with an in-memory store). Forward-compat is normative and tested.
- **Quality gates (CI = `npm run check`):** engine-purity scan → manifest-integrity (ajv + cross-ref)
  → core typecheck → web typecheck → **303 tests** (contracts, golden files, engineering reference
  cases, store/RTL). Plus `npm run coverage` (≥ 90% core solver+validation) and `npm run build:web`
  (proves browser-bundleability; three.js + lazy pdf-lib are code-split).
- **Engineering sign-off gates** (G-BAEL/EC2/RPS/COUPE/TOL) are tracked **people dependencies** —
  numeric constants ship flagged `_provisional` until a structural engineer ratifies them. *Code green
  ≠ engineering accepted.*

---

## 11. Architectural direction

### [next] v1.0.1 — breadth, still no backend
- More elements/codes/regions as **data** (the §8 seams).
- **Presentation upgrades** that are *viewport/exporter only, no engine change*: the **ViewCube**
  (camera-state mapping is pure + testable; the widget needs a GPU), the **3D coupe drag-handle**, and
  the **shop-drawing elevation *fiche*** (element-aware orientation + marks + dimensions — an
  annotation layer over the existing `placeBars` projection).
- **Combined project exports** (§9) — pure exporter work, headless-testable.
- **Prestressing** via a new `ReinforcingElement.kind` — the supertype already exists for exactly this.

### [later] v1.1 — depth, the server jump
- **The same pure engine runs server-side, unchanged.** Because `packages/core` has zero DOM/React/
  three coupling, the v1.1 backend (a FastAPI/Node service) reuses it verbatim for validation,
  schedules, and the **IFC export** (`IfcReinforcingBar`/`IfcReinforcingMesh` via IfcOpenShell) — none
  of which a browser can do. Accounts, cloud sync, and a building-aware project (storeys/grids/
  positions) layer **on top** of the engine, not into it.

The invariants in §2 are not bureaucracy — they are the *enabling conditions* for this roadmap.
Purity is what lets the engine move to the server; data-driven design is what lets the catalog grow;
forward-compat is what lets files outlive versions. The architecture is shaped by where the product is
going, not only by what it does today.
