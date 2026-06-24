# current_state.md — RebarConfig (SmartBar) cross-agent / cross-session handoff

> **Purpose.** This file is the **single source of truth passed between agents and sessions**.
> Each phase of `v1.0_imp_plan.md` is implemented by a **separate agent that starts cold**. To
> stop the next agent from re-deriving context, guessing, or building on false assumptions, the
> agent who finishes a chunk of work **must append a handoff entry** (newest first, in §9) that
> records *in detail* what they did, what they decided and why, what is true *now*, and exactly
> what the next agent should do next. Keep §1 (progress) and §9 (log) truthful and current.
>
> **This file travels with the code (committed to GitHub).** It is the cross-machine handoff —
> see `cross_projects_policy.md §9` (box-local, one level up at `/home/devuser/projects/`).

---

## 0. Who works on this & how we sync

- **Amer** — dev agent on the owner's **local Windows PC**.
- **Zayd** — dev agent on the **Hetzner dev box** (Linux; this machine).
- **Owner (Ssi Daoudi)** — the human. Directs the work; **not steeped in low-level technical jargon**,
  so when you write here or talk to him: **explain technical terms in plain language** the first
  time (e.g. *"a monorepo = one git repo holding several sub-packages that depend on each other"*),
  lead decisions with *what it means / why it matters*, and **ask before any real design decision**
  (don't silently pick architecture or scope; pure-convention defaults are fine — just flag them).

**Sync model:** we take turns. **Pull before you start, push when the owner asks.** Trust
`git log` / the actual diff over memory. If this file conflicts on merge, keep **both** sessions'
log entries and flag it to owner.

**Plain-language: what this project is.** RebarConfig is a **web app for detailing the steel
reinforcement ("rebar") inside concrete elements** — columns, beams, slabs, stairs, piles. The
structural engineer already knows *how much* steel each zone needs (from other software); this
tool lets them lay out the *actual bars*, see them in 3D, get instant "is this buildable & code-
compliant?" feedback (French **BAEL**, European **Eurocode 2**, Moroccan seismic **RPS**), and
export the on-site paperwork (bar-bending schedule, DXF drawings, PDF sheet). **v1.0 runs 100%
in the browser — no server, free hosting.**

---

## 1. Progress at a glance

| Phase (plan = spec milestone) | Status | By |
|---|---|---|
| **P0 / M0** — Pin core contracts (types + JSON Schemas + fixtures + integrity gate) | ✅ **DONE** | Zayd, 2026-06-24 |
| **P1 / M1** — Engine skeleton + `E-COL-01` + **BAEL pack** (headless) | ✅ **DONE** (code) · ⏳ G-BAEL unsigned | Zayd, 2026-06-24 |
| **P2 / M2** — SPA shell + 3D viewport | ✅ **DONE** (code) | Zayd, 2026-06-24 |
| **P3 / M3** — Scheme catalog + supplements + advanced builder + `E-BEM-01` | ✅ **DONE** (code) · ⏳ G-BAEL unsigned | Zayd, 2026-06-24 |
| P4 / M4 — Full element set + EC2 pack + RPS seismic | ⛔ not started | — |
| P5 / M5 — Exports (BBS, DXF, PDF) + `.rcfg` I/O | ⛔ not started | — |
| P6 / M6 — Hardening, sign-off, release | ⛔ not started | — |

**Test status (P3):** `npm run check` green — purity ✓, manifest integrity ✓ (**10 shapes** / **2
elements** / **4 schemes** / **7 supplements**), core typecheck ✓, **web typecheck ✓**, **123 tests
passed** across 27 files (84 core + **39 web**). New P3 core suites: `scheme_switch`,
`placement_resolve`, `supplement_rebind`, `beam_curtailment`, `expert_mode`, `binding_keyboard`
(+`schema.valid` auto-grew 14→29 as it discovers every manifest). New P3 web suites:
`element_catalog`, `beam_supplements` (RTL). `vite build` succeeds (~1.7 MB bundle, code-split =
P6); `vite dev` serves on **127.0.0.1:5180** (HTTP 200, HTML + transpiled entry).

---

## 2. Authoritative companion docs (read these first, every time)

- **`v1.0-Spec.md`** (revision **r3**) — the build contract: *what & why*. The `[REF-…]` tags and
  `§` numbers are the stable references everything else cites. **If as-built reality diverges from
  the spec, say so in your log entry.**
- **`v1.0_imp_plan.md`** — the 7-phase plan (P0–P6 = M0–M6): *task-by-task how*, with each phase's
  steps, tests, Definition-of-Done, and a §V validation matrix mapping plan↔spec.
- **`current_state.md`** (this file) — the *as-built* reality + the handoff log.

> The plan records the *intended* reality; this file records the *actual* reality. Trust this file
> for "what exists now", trust the spec for "what it should ultimately be".

---

## 3. Hard rules every agent obeys (do not violate without recording a decision in §9)

1. **Everything structural is DATA.** Elements, shapes, schemes, supplements, code rules are JSON
   manifests + code-pack functions. **Adding an element/shape/scheme/code must need NO engine
   rewrite** (spec §0.1, §1). If you're about to write `if (elementType === …)` or
   `if (codePack === …)` inside `packages/core`, **stop** — it belongs in a manifest or a registered
   generator. (Plain language: the engine is a generic machine; the "knowledge" lives in data files.)
2. **Engine purity.** Nothing under `packages/core/` may import React, `three`, or touch the DOM
   (`window`/`document`). Enforced by `npm run check:purity` + `tests/engine-purity.spec.ts`. This
   is what lets the same engine power the UI, the exporters, the tests, and the future 1.1 server.
3. **Determinism.** The solver is pure functions: same input → identical output. No `Date.now()`,
   no `Math.random()` in `packages/core`.
4. **SI internally, convert at the edge.** Engine stores mm, mm². UI/IO converts to the French
   display units (geometry mm, steel area cm² or cm²/m, weight kg).
5. **Code-pack agnosticism.** Archetypes/schemes/validator call `code.*` named functions
   (`CodePack` interface, `packages/core/src/types/codepack.ts`). BAEL vs EC2 = swap the
   implementation behind the names, nothing else.
6. **`.rcfg` forward-compat (NORMATIVE, spec §10).** A reader must **preserve unknown fields and
   unknown `ReinforcingElement.kind`s on round-trip** — so a future file containing `TENDON`s
   survives a v1.0.0 load. Already locked + tested in P0; don't regress it.
7. **Engineering correctness is gated by a human.** Numeric code constants (BAEL/EC2/RPS) and the
   reference cases are **signed off by a qualified structural engineer** before that math is "done"
   (spec §11, §14). See §6 below. Until signed, ship constants flagged `"_provisional": true`.
8. **Every phase ends green:** `npm run check` (purity → manifests → typecheck → tests) passes,
   plus the new phase's tests. Update §1 and append a §9 entry.

---

## 4. How to run (commands, on the dev box)

```bash
npm install            # once; npm workspaces (Node 20, npm 10 on this box; no pnpm)
npm run check          # FULL gate: purity → manifests → typecheck(core) → typecheck:web → tests
npm run test           # vitest run (both projects: core=node, web=jsdom)
npm run check:manifests# JSON-Schema + cross-ref validation of apps/web/manifests
npm run check:purity   # engine-purity scan of packages/core
npm run typecheck      # tsc --noEmit on the engine + tests (root tsconfig)
npm run typecheck:web  # tsc --noEmit on apps/web (DOM/React tsconfig)
npm run build:web      # vite production build of the SPA (proves browser-bundleability)

# Run the SPA (P2):
cd apps/web && npm run dev    # vite dev → http://127.0.0.1:5180  (SmartBar's port; 5173 is Planitor)
```

The SPA exists now (P2): pick `E-COL-01`, edit geometry/material/cover/Ø/spacing/counts, see
live 3D + live alerts, failing bars turn RED. Run it via `vite dev` (port **5180**). Headless
boxes can't see WebGL — prove it with `npm run build:web` + the `web` vitest suites instead.

---

## 5. Repo map (as built in P0)

```
package.json              # root; npm workspaces ["packages/*","apps/*"]; scripts; devDeps
tsconfig.base.json        # shared compiler options (ES2022, moduleResolution "Bundler", strict)
tsconfig.json             # root typecheck (noEmit) over packages + tests + scripts
vitest.config.ts          # test runner; include tests/**/*.spec.ts
scripts/
  check-manifests.ts      # CI gate → calls core.checkManifestDir(apps/web/manifests)
  check-engine-purity.mjs # CI gate → scans packages/core/src for React/three/DOM
packages/core/            # @rebarconfig/core — the PURE ENGINE (no DOM/React/three)
  package.json            # main/types → src/index.ts (dev-time TS entry; dist build added later)
  schemas/*.schema.json   # JSON Schemas: shape, element, scheme, supplement, rcfg
  src/types/              # the 6 frozen contracts (see §6 of this map below)
  src/integrity/index.ts  # manifest-integrity gate (ajv + cross-ref + expr-scope check)
  src/geometry/           # P1: expr.ts (mathjs frozen scope) + segment-grammar.ts generator
  src/layout/             # P1: rect.ts — corner-share layout + computed d/d' (computeZoneGeometry)
  src/validation/         # P1: index.ts (validateColumn, tierFor, …) + P3: profiles.ts
                          #   (VALIDATION_PROFILES registry: BAEL_COLUMN/BAEL_BEAM — D-P3-1)
  src/scheme/             # P3: resolve.ts — scheme→zone map, placement+supplement resolvers,
                          #   nearestBarIndex, computeCurtailment (§5.3–5.7, D-P3-4)
  src/pipeline/           # element.ts: generic solveElement (D-P3-1) + solve.ts: solveColumn shim
  src/index.ts            # public surface: types + geometry/layout/validation/profiles/scheme/pipeline
packages/codepacks/       # @rebarconfig/codepacks — packs behind core's CodePack iface (P1)
  src/bael/bael-constants.json  # ⚠ PROVISIONAL BAEL constants, "_provisional": true (G-BAEL)
  src/bael/index.ts       # makeBaelPack(): BaelPack — code.* impls + PackExtras (bands, ls, …)
apps/web/                 # @rebarconfig/web — the SPA (P2): React 18 + Vite + Zustand + R3F
  index.html  vite.config.ts  tsconfig.json  vitest.setup.ts
  manifests/              # the real data (P3): shapes/ (10) elements/ (2) schemes/ (4) supplements/ (7)
  src/
    main.tsx App.tsx styles.css
    engine/               # adapter (NOT engine code): document.ts (ElementDoc = column|beam + factories),
                          #   manifests.ts (full registry), solveDoc.ts (doc→solveElement, 2-pass supplements)
    store/                # useStore.ts — Zustand; element/scheme catalog + supplements + expert; re-solves sync
    viewport/             # Viewport.tsx (R3F Canvas) + Rebar.tsx + rebarProps.ts (PURE mapping, both elements)
    ui/                   # Navbar Sidebar SupplementsPanel AlertsPanel NumberField derived.ts
    i18n/strings.ts       # FR/EN bundles (typed)
    *.spec.ts(x)          # P2 web suites (run under the jsdom vitest project)
tests/                    # P0 contract tests + P1 engine suites + fixtures (valid/ + invalid/)
vitest.config.ts          # core project config (node env)
vitest.workspace.ts       # P2: two projects — core (node) + web (jsdom + react plugin)
```

**The six frozen contracts (P0 deliverable, spec §12 M0)** — `packages/core/src/types/`:
1. `shape.ts` — Shape Archetype segment grammar (spec §5.2.1).
2. `distribution.ts` — Distribution: count or segmented spacing (§5.1.1).
3. `reinforcing-element.ts` — `ReinforcingElement` supertype + `BarGroup` + `isBarGroup` guard
   (§0.2.1, §10).
4. `layout.ts` — Layout-solver I/O incl. computed effective depth `d`/`d'` (§6.1 [REF-SYS-611]).
5. `codepack.ts` — the `code.*` `CodePack` interface + `RuleResult` (§7.11).
6. `rcfg.ts` — the `.rcfg` envelope (§10).
Manifest shapes are pinned by JSON Schema (`packages/core/schemas/`), not TS.

---

## 6. Open engineering sign-off gates (human dependency — track, don't skip)

These block *acceptance*, not coding. Code against **provisional** constants (flagged in JSON) and
keep moving, but a phase is not "accepted" until its gate is signed (spec §11, §14).

| Gate | Blocks | What must be ratified |
|---|---|---|
| **G-BAEL** | P1 acceptance | BAEL 91-99 constants table (spec §7.11) + reference cases (§14.7) |
| **G-TOL** | P1 / P4 | per-rule WARN-vs-PASS tolerance bands (§7.12, §14.8) |
| **G-EC2** | P4a | EC2 reference cases |
| **G-RPS** | P4b close | RPS-2011 ⚠ cells: `l_c`, critical-zone spacing per ND class, min tie ø, required confinement, zone enum + `a_g` map (§7.10b, §14.6) |
| **Sign-off** | release | full BAEL/EC2/RPS reference-case suites signed by the nominated engineer (§14.9) |

**Owner action pending:** §14 open items 1–13 (starter scheme list, default materials, diameter
set, cartouche fields, RPS defaults, the constants tables, WARN bands, curtailment defaults, cover
special cases, corner-torsion trigger, leg-counting policy, and *nominate the structural engineer*).
None block P1 *coding*, but G-BAEL must be signed before P1 is *accepted*.

---

## 7. Environment / gotchas (read before coding)

1. **Node 20.20 / npm 10.8 on this box; no pnpm.** Use `npm` workspaces. `package-lock.json` is
   committed.
2. **`@rebarconfig/core` `main`/`types` point at `src/index.ts` (raw TS) — and that's now proven in
   the browser too.** vitest/tsx transpile on the fly; **Vite** also consumes the raw TS (the
   workspace packages are in `optimizeDeps.exclude`). So **there is still no `dist` build of core**,
   and P2 did NOT add one — `vite build` succeeds against the raw source. See **D-P2-2**. The one
   change P2 needed was moving the Node-only integrity gate off the runtime barrel (**D-P2-1**), so
   the browser graph is free of `node:*`. Don't add a core `dist` build unless a *Node* consumer
   needs compiled JS.
3. **ajv draft 2020-12:** the integrity gate imports `ajv/dist/2020.js` (not the default `ajv`
   entry, which is draft-07). Keep that if you add schemas.
4. **Purity/scan scripts strip comments before matching** so prose like "JSON document." is not a
   false positive. If you extend the forbidden list, keep the comment-stripping.
5. **`npm audit` shows vulnerabilities** in the dev toolchain (esbuild/vitest transitive). Not
   shipped to users (dev-only), safe to ignore for now; revisit at P6 hardening.
6. **Not committed yet.** Branch is `main` (only commit `e9a670e`). Per `cross_projects_policy.md`
   §10, **commit/push only when the owner asks.** When asked: branch off `main` first.

---

## 8. Key decisions made in P0 (so the next agent doesn't re-litigate them)

- **D-P0-1 — Distribution vs layout principle.** Spec §5.4 lists five "distribution modes" but the
  §10 `.rcfg` example puts `SYMMETRIC`/`LAYERED` under `placement.layout.principle`, not under
  `distribution`. **Resolution:** `Distribution.mode` ∈ `{FIXED_COUNT, SPACING_ALONG_PATH,
  EQUAL_PERIMETER}` (how many / how spaced); `SYMMETRIC`/`LAYERED`/`FREE` are
  `PlacementRule.layout.principle` (how arranged). Documented in `distribution.ts` + `placement.ts`.
  *Next agent: build the layout solver (P1, §6.1) to read `layout.principle`, and normalize a bare
  `spacing` into a single `{extent:"all"}` segment.*
- **D-P0-2 — Forward-compat via JSON-Schema `if/then`.** `rcfg.schema.json` requires only
  `id`+`kind` on every reinforcement entry (so unknown kinds pass) and **conditionally** requires
  the full field set *only when* `kind === "REBAR_GROUP"`. This validates the v1.0 contract while
  letting future `TENDON`s through. Mirrored by the `UnknownReinforcingElement` TS type + the
  `tests/rcfg.roundtrip.spec.ts` preservation test. **Do not tighten this to reject unknown kinds.**
- **D-P0-3 — `isBarGroup` type guard ships in P0.** A one-line discriminant
  (`el.kind === "REBAR_GROUP"`) — counts as part of the type contract, not solver logic. Use it
  everywhere instead of comparing `kind` by hand.
- **D-P0-4 — `code.*` interface arg shapes.** `codepack.ts` already carries the r3 engineering
  additions as arguments: `AnchorageArgs.goodBond` + `asReqOverProv` (auto bond-class + As,req/As,prov
  reduction, §7.7), `AsLimitArgs.d` (computed effective depth) + `NEd`, `CoverArgs.fire`. The BAEL
  pack (P1) must implement these even if some default to a no-op initially.
- **D-P0-5 — Expression-scope check is light but real.** The integrity gate flags archetype
  expression symbols outside `{param keys} ∪ {math globals} ∪ {engine globals: diameter,
  mandrelDiameter, hookAllowances, hookExt, bendDeductions, code}`. If P1's generic generator needs
  a new in-scope symbol, **add it to `ENGINE_GLOBALS` in `integrity/index.ts`** (one place).
  *(P1 added no new symbols — the generator uses only the already-enumerated globals.)*
- **D-P1-1 — `cutLength` = schedule legs (to sharp vertices) + hook allowances − bend deductions.**
  The 3D `centerline3D` is built separately with mandrel fillets (`r = mandrelØ/2 + φ/2`) and has
  its own `geomLength`; the **fabrication `cutLength` is NOT the polyline sum and NOT the rounded
  centerline** — it's Σ schedule legs + Σ hookExt − Σ `code.bendDeduction`. The generator
  cross-checks this against the manifest's `totalLengthExpr` and **throws on disagreement** (catches
  authoring bugs). Don't "simplify" cutLength to the polyline — it'll break site lengths.
- **D-P1-2 — `code.bendDeduction` is a PROVISIONAL geometric model.** `deduction = r·(2·tan(θ/2) − θ)`
  (the sharp-vertex vs rounded-arc difference), capped for acute/180° angles. Real BAEL tabulated
  deductions differ → **G-BAEL** item. It's isolated in `bael-constants.json`; only the value moves
  when signed. Consequence: `l_s` computes ≈**44φ** for FeE500/C25, not the tabulated ≈40φ — that
  gap is a deliberate, flagged sign-off discrepancy (see `bael_reference.spec.ts`).
- **D-P1-3 — Code pack passed by dependency injection; core never imports codepacks.** `solveColumn`
  / `validateColumn` take a `CodePack` argument (so core stays pack-agnostic and there's no circular
  dep). `@rebarconfig/codepacks` depends on core for the interface, not vice-versa. The pack also
  carries **`PackExtras`** (warn bands, `minShearStress_MPa`, `tieDiameterMin`, `lsStraight`,
  `_provisional`); core reads them through an **optional** `CodePackExtras` surface so *any* pack may
  omit them (defaults apply). **Don't add codepack imports inside `packages/core`.**
- **D-P1-4 — Orchestrator is `solveColumn`, not yet a generic element dispatcher.** It is column-
  specialized **by composition, not by branching** (no `if (elementType===…)` — it just wires
  layout→geometry→`validateColumn`). P3 (beam) must introduce a **validation-profile registry**
  (`BAEL_COLUMN` / `BAEL_BEAM` → a validator fn) and a generic `solve(element, …)` that picks the
  profile + layout descriptor from the manifest — reusing the same geometry/layout. Do **not** grow
  `solveColumn` into an `if/else` over element types.
- **D-P1-5 — Effective depth `d` is a first-class output from day one.** `computeZoneGeometry`
  returns `d`/`d'`/tension-centroid per zone, area-weighted across layers (NOT `0.9h`). Column
  default flexure assumes tension face = BOTTOM (strong-axis). Beams/slabs (P3) pass the zone's real
  tension face. Every `d`-consuming rule reads this value.
- **D-P2-1 — Integrity gate moved off the runtime barrel (browser-safety).** The manifest-integrity
  gate (`validateManifest`/`checkManifestDir`/`crossReferenceCheck`/`ManifestKind`) imports
  `node:fs/path/url` + ajv, so a browser bundle that imports anything from `@rebarconfig/core`
  used to pull Node built-ins → `vite build` failed. **Resolution:** dropped `export * from
  "./integrity"` out of `packages/core/src/index.ts`; it is now a **Node-only subpath**
  `@rebarconfig/core/integrity` (added to core `package.json` `exports`). The runtime barrel is now
  pure (types + geometry/layout/validation/pipeline; mathjs is browser-safe). Updated the 4 Node
  consumers (`scripts/check-manifests.ts`, `tests/crossref`, `tests/schema.valid`,
  `tests/schema.invalid`). **No engine logic changed; no `.rcfg`/contract change.** This is the
  clean answer to the §7.2 "need a dist build for the browser" worry — see D-P2-2.
- **D-P2-2 — No separate `dist` build of core; Vite transpiles the raw-TS workspace.** `core`/
  `codepacks` still point `main`/`types` at `src/*.ts`. Vite consumes them via its own TS transform
  (they're in `optimizeDeps.exclude` so they go through the source pipeline, not pre-bundle). So the
  browser gets the engine **unchanged** and there is still **no build step for core**. `vite build`
  bundles the whole graph; the SPA bundle is ~1.6 MB (three.js) — a P6 code-splitting item, not a
  blocker.
- **D-P2-3 — The SPA is a DUMB renderer; all geometry stays in core.** `apps/web/src/viewport/
  rebarProps.ts` is a **pure** mapper (no three/DOM) that turns a `SolveResult` into plain world
  polylines + flags; it is unit-tested headlessly (`red_fail_mapping`, `degradation`). The R3F
  components only instance/colour/clip — they never compute bend geometry (that's the engine's
  `centerline3D`, only translated/centred for placement). Keep it that way (plan P2 risk note).
- **D-P2-4 — Degradation affects render+UI, never correctness.** The store **always** re-solves
  synchronously on every mutation (solve ≪ 16 ms). `dragMode` only flips the *viewport* to
  centreline `Line`s and *defers the alerts list* during an active slider drag (`viewportDirectives`
  in rebarProps.ts), restoring full fidelity on release. Correctness is never skipped on commit (§2.2).
- **D-P2-5 — Element/code pickers are stubbed to the only built options.** Navbar element ▼ is
  locked to `E-COL-01` and code ▼ to BAEL-FR (the only element + pack that exist pre-P3/P4). Import
  is a stub; **Export is wired to the §7.9 export-lock now** (disabled on a 🔴 FAIL) even though the
  exporters themselves are P5. Diameter set `{6,8,…,32}` is a P2 convention (ratified set = §14 item).
- **D-P3-1 — Validation-profile registry + generic `solveElement` (closes D-P1-4).** `packages/core/
  src/validation/profiles.ts` holds `VALIDATION_PROFILES = { BAEL_COLUMN, BAEL_BEAM }` (a name→validator
  map); `packages/core/src/pipeline/element.ts` `solveElement` is the ONE orchestrator — it assembles the
  layout, generates each group's shape, computes per-zone `d`, and dispatches the profile named by the
  manifest. **`solveColumn` is now a thin shim over `solveElement`** (it just applies the column's tie-inset
  / `L=H` conventions) → one engine, no fork. `BAEL_COLUMN` *delegates to the proven P1 `validateColumn`*
  (single source of truth — all 78 prior tests stayed byte-identical). **No `if(elementType)` in core.**
- **D-P3-2 — Beam is one representative cross-section (v1.0).** `E-BEM-01` zones: `As_span_bottom` (BOTTOM
  face, tension BOTTOM), `As_top_support` (TOP face = chapeaux, tension TOP), `Asw_shear` (stirrups). The
  spec's separate `As_top_left`/`As_top_right` supports are **collapsed into one representative support
  zone** — faithful enough to prove generality + curtailment; the left/right split is a P4+ refinement.
  `validateBeamProfile` does per-zone provided-area + ratio (As,min = `0.23·b·d·ft28/fe` with the **computed
  `d`**, not `0.9h`), clear spacing, cover, stirrup `s ≤ 0.75·d`, leg-counted Asw, and **end-support
  anchorage ≥ 0.25·As,span** (WARN if short).
- **D-P3-3 — Curtailment/shift (§7.7) feeds the chapeau bar length.** `computeCurtailment(code, …)` =
  `{ shift=a_l≈d, lbd, extension = supportZone + a_l + l_bd }`. The `CHAPEAU` archetype is a horizontal run
  (its principal leg = `extension`) + two 90° down-returns (end hooks) → its `cutLength` carries the
  curtailment length onto the BBS. (Honest: the support return detailing is minimal; `beam_curtailment.spec`
  checks leg a == extension and cutLength > extension.)
- **D-P3-4 — Scheme/placement/supplement resolvers are PURE core** (`packages/core/src/scheme/resolve.ts`).
  `resolveScheme` maps base groups → declared zones (switching = call again, wholesale remap). Supplements
  **bind by STABLE bar indices, never coordinates** (§10): `resolveBarPairPlacement` positions a
  `LINK_BAR_PAIR` épingle at the midpoint and re-solves when bars move; a deleted ref or unmet
  `requires.min_bars` → **WARN + rebind prompt**. **`nearestBarIndex` is the shared backbone of BOTH 3D
  click-binding and the keyboard/index list** → identical binding (a11y parity, `binding_keyboard.spec`).
- **D-P3-5 — UI generalised to `ElementDoc` (column | beam) via `solveDoc` → `solveElement`.** The store
  holds either doc; the adapter marshals conventions + does a **two-pass solve for supplements** (solve base
  → bind against `result.bars` → re-solve with the add-ons). The column path is byte-identical to P2 (all P2
  web tests pass unchanged). **Scheme switch preserves geometry/material/cover/exposure**, remaps the
  reinforcement to the scheme default, and clears supplements.
- **D-P3-6 — Supplement shape-params + 3D placement are UI-edge conventions.** The engine stays generic;
  `solveDoc.supplementShapeParams` computes archetype params (e.g. épingle `span` from the resolved
  midpoint) so `generateBarShape` never throws. **Precise 3D supplement placement is deferred** — the
  viewport renders supplements centred (shows presence) rather than at the exact resolved midpoint; the
  engine already knows the exact position (`ResolvedSupplement.position`). Beam is drawn with member axis +Y
  (it stands up); orientation is a P6 visual-polish item.

---

## 9. Handoff log (newest first — APPEND your entry here before you stop)

### 2026-06-24 — P3 / M3 complete (code; G-BAEL unsigned) — by **Zayd** (dev box)

**What I did (in detail).** Built the **scheme catalog + supplements + advanced builder + the beam
`E-BEM-01`** as the second element — proving the "add JSON + a registered profile, no engine
rewrite" thesis — per `v1.0_imp_plan.md` Phase 3. Concretely:

1. **Validation-profile registry + generic `solveElement` (D-P3-1, closes the P1 D-P1-4 prereq).**
   New `validation/profiles.ts` (`VALIDATION_PROFILES`, `validateColumnProfile`, `validateBeamProfile`)
   and `pipeline/element.ts` (`solveElement`). Rewrote `pipeline/solve.ts` so **`solveColumn` is a
   convention-applying shim over `solveElement`** — one engine, zero element branching. `BAEL_COLUMN`
   delegates to the unchanged P1 `validateColumn` (all 78 prior tests stayed identical).
2. **Beam validation profile (D-P3-2/3).** Per-zone provided-area + ratio (beam As,min with the
   **computed `d`**), clear spacing, cover, stirrup `s≤0.75·d`, leg-counted Asw, **end-support anchorage
   ≥0.25·As,span**, and the **curtailment/shift** helper (`computeCurtailment`) feeding the chapeau
   cutLength.
3. **Scheme / placement / supplement resolvers (D-P3-4)** — new pure `scheme/resolve.ts`:
   `resolveScheme` (base groups→zones, clean remap on switch), `resolveBarPairPlacement` +
   `nearestBarIndex` (LINK_BAR_PAIR midpoint; click==keyboard binding), `resolveSupplement` (broken-ref
   / min_bars → WARN + rebind), `computeCurtailment`.
4. **Manifests (data, integrity-green):** `elements/E-BEM-01.json`; **5 new shapes** (`CHAPEAU`,
   `ETRIER`, `U_BAR`, `CROCHET_L`, `RELEVE`); **2 beam schemes** (simple span; chapeaux+relevés) + a
   2nd column scheme (`COL_TIES`); **6 new supplements** (`SUPP_DIAGONALE_ANGLE`, `_RELEVE_BARS`,
   `_SKIN_SIDE`, `_DIAMANT_TIE`, `_DOUBLE_STIRRUP_SUPPORT`, `_HEAD_HOOPS`). Gate: {shapes:10,
   elements:2, schemes:4, supplements:7}.
5. **UI generalised to the catalog (D-P3-5/6).** `engine/document.ts` → `ElementDoc` (column|beam) +
   factories; `engine/manifests.ts` → full registry; `engine/solveDoc.ts` → routes both elements
   through `solveElement` with a **two-pass supplement solve**. `store/useStore.ts`: `selectElement` /
   `selectScheme` / beam setters / `addSupplement`/`removeSupplement`/`rebindSupplement` / `expert`.
   `Navbar` (element ▼ + scheme ▼ enabled, expert toggle), `Sidebar` (conditional column/beam controls
   + expert group list), new **`SupplementsPanel`** (catalog + **keyboard index binding** + rebind/
   remove + WARN rows). Viewport/`rebarProps` generalised to render either element + supplements.
6. **Tests (headless + RTL):** 6 new core suites (`scheme_switch`, `placement_resolve`,
   `supplement_rebind`, `beam_curtailment`, `expert_mode`, `binding_keyboard`) + 2 web suites
   (`element_catalog`, `beam_supplements`).

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {10/2/4/7} · core
typecheck ✓ · web typecheck ✓ · **123 tests / 27 files** (84 core + 39 web). `npm run build:web` ✓
(~1.7 MB — three.js; code-split = P6). `vite dev` serves **HTTP 200** on 127.0.0.1:5180.

**Decisions:** D-P3-1…D-P3-6 in §8. Load-bearing: the profile registry + `solveColumn`-as-shim
(D-P3-1), stable-index supplement binding with click==keyboard parity (D-P3-4), and the two-pass
UI supplement solve (D-P3-5).

**Open / deliberately deferred (be honest):**
- **Beam left/right support split collapsed** into one representative support zone (D-P3-2) — fine for
  v1.0 detailing; revisit when slabs/continuous beams land (P4).
- **3D supplement placement is indicative** (centred), not the exact resolved midpoint, and **3D
  click-to-bind UI wiring** (viewport pointer→store) is minimal — the *pure backbone* (`nearestBarIndex`)
  and the **keyboard/index binding path are fully wired + tested**; the click path is a thin add (D-P3-6).
- **Advanced builder = view + supplement add/remove + the resolved group list** under the expert toggle;
  arbitrary add/replace of *any* base group with explicit coordinates is supported at the **data/engine**
  level (`expert_mode.spec` proves the `.rcfg` round-trip + tier-1 block / tier-2 warn-only) but the
  *form UI* for it is minimal. Custom-scheme **saving** stays 1.1 (spec §5.6). Full `.rcfg` I/O = P5.
- **No human has seen the beam (or any) 3D in a browser** — headless dev box, no WebGL. Render *logic*
  is tested; *pixels* are not. Open `vite dev` on a GPU machine to eyeball.
- **G-BAEL still UNSIGNED** — the beam reuses the same provisional BAEL pack (provisional pill shows in
  the UI). P3 *code* done; *acceptance* still waits on the engineer (§6, §14.7). No git commit (§7.6).

**→ Next agent: P4 / M4 (full element set + EC2 pack + RPS seismic).** The seams are ready: a new
element = manifests + a registered `VALIDATION_PROFILES` entry (no engine rewrite); the bespoke
geometry generators (`SPIRALE_HELICE`, `TREILLIS_MESH`) register in the shape map (§5.2.1g). EC2 = a
2nd `CodePack` behind the same `code.*` names + an `EC2_*` profile pair. RPS overlay composes onto
either pack as keyed overrides (§7.10). *Before starting: `git log`/diff to confirm nothing moved;
`npm run check` GREEN + `npm run build:web`; then append your own §9 entry.* If you instead close P3
gaps first, the highest-value are: **exact 3D supplement placement + 3D click-to-bind wiring** and
chasing the **G-BAEL signature**.

### 2026-06-24 — P2 / M2 complete (code) — by **Zayd** (dev box)

**What I did (in detail).** Built the **running SPA** (`apps/web`) — React 18 + Vite + Zustand +
Three.js/R3F — that drives the P1 engine **unchanged**: pick `E-COL-01`, edit
geometry/material/cover/Ø/spacing/counts, watch live 3D + live alerts, failing bars turn RED.
Per `v1.0_imp_plan.md` Phase 2. Concretely:

1. **Vite React app scaffolded** — `apps/web/package.json` (react 18.3, three 0.169, @react-three/
   fiber 8.17 + drei 9.114, zustand 4.5; dev: vite 5.4, @vitejs/plugin-react, jsdom, RTL),
   `index.html`, `vite.config.ts` (port **5180**; `optimizeDeps.exclude` the workspace packages so
   Vite transpiles raw-TS core — **D-P2-2**), `tsconfig.json` (DOM lib + react-jsx).
2. **Engine adapter (pure, not engine code)** — `src/engine/`: `document.ts` (`ColumnDoc` editable
   state + `defaultColumnDoc()` = the P1 reference column), `manifests.ts` (Vite JSON imports of the
   DROITE/CADRE_RECT archetypes), `solveDoc.ts` (`ColumnDoc → SolveResult` via `solveColumn` +
   `makeBaelPack`). **No geometry/validation math here** — all in core.
3. **Zustand store** — `src/store/useStore.ts`: holds the doc + result; **every mutation re-solves
   synchronously** in the same tick (times it for the perf HUD). `dragMode`, `selectedGroupIds`,
   `lang`, `showSection`, `debugPerf`. **D-P2-4** (solve always runs; only render/UI degrade).
4. **PURE viewport mapping** — `src/viewport/rebarProps.ts`: `failingGroupIds`, `viewportDirectives`
   (drag→lines+deferred), `buildScene` (SolveResult→world polylines + failing/selected flags). No
   three/DOM → unit-tested headlessly. **D-P2-3**.
5. **R3F viewport** — `Viewport.tsx` (Canvas, semi-transparent concrete box opacity 0.30,
   OrbitControls, **section-cut** global clip plane, perf HUD behind `debugPerf`) + `Rebar.tsx`
   (TubeGeometry in full fidelity / drei `Line` in drag-degradation; RED on FAIL, cyan on select).
6. **UI shell + i18n** — `Navbar` (element/code locked to E-COL-01/BAEL, FR/EN, section+perf toggles,
   **Export disabled on 🔴** per §7.9, Import stub — **D-P2-5**), `Sidebar` (tabs Schéma/Géométrie/
   Projet-Code; per-zone Ø + counts/spacing/legs; **live As,prov/As,req + computed-d badges**),
   `AlertsPanel` (FR/EN rows, click/Enter to highlight affected bars, icon+text+colour for a11y),
   `NumberField` (slider flips `dragMode` on pointer down/up). `i18n/strings.ts` = typed FR/EN bundles.
7. **Browser-safety fix (D-P2-1).** `vite build` initially failed: importing `@rebarconfig/core`
   transitively pulled the Node-only **integrity gate** (`node:fs/path/url`+ajv). Moved it off the
   runtime barrel to a **subpath** `@rebarconfig/core/integrity`; updated the 4 Node consumers
   (`scripts/check-manifests.ts`, `tests/crossref`, `tests/schema.valid`, `tests/schema.invalid`).
   Runtime barrel is now pure. **No engine logic / no contract / no `.rcfg` change.**
8. **Tests + gate wiring.** `vitest.workspace.ts` = two projects: **core** (node, `tests/**`) +
   **web** (jsdom, react plugin, `apps/web/src/**`). Added `typecheck:web` + `build:web` scripts and
   folded `typecheck:web` into `npm run check`. New web suites: `store_resolve`, `perf_budget`
   (best-of-50 solve < 16 ms), `red_fail_mapping`, `degradation`, `smoke` (RTL: change Ø → As,prov
   badge updates 18.85→29.45 cm², click alert → group selected).

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {shapes:5, elements:1,
schemes:1, supplements:1} · core typecheck ✓ · **web typecheck ✓** · **78 tests / 19 files** (64
core + 14 web). `npm run build:web` ✓ (bundle ~1.6 MB — three.js; code-split = P6). `vite dev`
boots and serves **HTTP 200** on 127.0.0.1:5180 (HTML + transpiled `/src/main.tsx` → whole
three/r3f graph resolves). **Headless box: WebGL not visually verified** — proven via build + the
jsdom suites + the pure mapping tests instead (honest limitation).

**Decisions:** D-P2-1…D-P2-5 in §8. Load-bearing: integrity-off-barrel (D-P2-1), dumb-renderer/
pure-mapping (D-P2-3), and "store always solves; degradation is render-only" (D-P2-4).

**Open / deliberately deferred (be honest):**
- **No human has seen the 3D in a browser** (headless dev box). The render *logic* is tested; the
  *pixels* are not. Owner/Amer should open `vite dev` on a machine with a GPU/browser to eyeball it.
- **Section-cut** uses a single global horizontal clip plane at mid-height (simple + correct for a
  column); a movable/oriented cut plane is a polish item.
- **i18n** covers the chrome + manifest labels only; full bundle + missing-key assertion is P6.
- **Perf** asserted on the solve (<16 ms) headlessly; the §2.2 *render* budget under heavy elements
  (dense ties/mesh) is a P6 pass — degradation path is wired + tested but not load-profiled.
- G-BAEL still UNSIGNED (provisional constants surface in the UI as a ⚠ "provisoire" pill). Export
  lock on 🔴 is wired; the **exporters themselves are P5**. No git commit (owner-gated, §7.6).

**→ Next agent: P3 / M3 (scheme catalog + supplements + advanced builder + `E-BEM-01`).** The two
prerequisites flagged in P1 are still the right first moves: the **validation-profile registry +
generic `solve(element,…)`** (D-P1-4 — needed before the beam) and chasing the **G-BAEL signature**.
The UI is ready to grow: the store holds one `ColumnDoc` today — P3 should generalise it to a
scheme-driven element document and add the scheme/supplement panels (§5.3–5.6). The viewport mapper
(`rebarProps.ts`) and the R3F layer already render arbitrary bar polylines, so new archetypes/
supplements render for free once the engine emits them. *Before starting: `git log`/diff to confirm
nothing moved; `npm run check` GREEN + `npm run build:web`; then append your own §9 entry.*

### 2026-06-24 — P1 / M1 complete (code; G-BAEL unsigned) — by **Zayd** (dev box)

**What I did (in detail).** Built the **headless engine** that solves + validates the
rectangular tied column `E-COL-01` with its ties scheme against the **BAEL-FR pack**, per
`v1.0_imp_plan.md` Phase 1. No UI (that's P2). Concretely:

1. **Generic segment-grammar generator** — `packages/core/src/geometry/`:
   - `expr.ts` — mathjs evaluator (`mathjs@^13`, installed into core) against the **frozen
     §5.2.1f scope** (params + `diameter`/`mandrelDiameter`/`hookExt`/`bendDeductions`/
     `hookAllowances` + math globals + `code.*`). Same symbol set the integrity gate enforces.
   - `segment-grammar.ts` — `generateBarShape(archetype, params, φ, code)` → `centerline3D`
     (fillet-rounded, sampled), `cutLength`, `geomLength`, `fiche` (legs a/b/c, bends, hooks),
     closure check. Turtle model (`line|turn|arc`), `hand`-resolved bends, closed-shape weld,
     mandrel fillets `r = mandrelØ/2 + φ/2`, end hooks. **See D-P1-1** (cutLength model).
2. **Layout solver** — `packages/core/src/layout/rect.ts`: `solveRectLayout` (corner-first,
   **shared corners counted once**, `nFace−2` intermediates, SYMMETRIC + LAYERED, underfilled-
   face flagging) and `computeZoneGeometry` (**computed `d`/`d'`**, area-weighted, §6.1 — D-P1-5).
3. **BAEL-FR pack** — new workspace `packages/codepacks/` (`@rebarconfig/codepacks`):
   `makeBaelPack()` implements every `code.*` (`mandrelMin`, `bendDeduction`, `lbd`/`l0` with
   **As,req/As,prov reduction + auto poor-bond**, `AsMin`/`AsMax`, `tieSpacingMax`, `cover`
   incl. fire + cast-against-earth) + `PackExtras`. **All constants in `bael-constants.json`,
   `"_provisional": true`** (G-BAEL). DI into core — **D-P1-3**.
4. **Validation engine + validity tiers** — `packages/core/src/validation/`: `validateColumn`
   returns the frozen `RuleResult` + `{tier, symbol}` (FAIL→🔴/1, WARN→🟠/2, PASS→🟢/3 per §7.12);
   rules for provided area, min-bars, per-face min, ratio, clear spacing, cover, tie spacing/ø,
   **leg-counted `Asw`**, mandrel feasibility. Provisional **G-TOL** WARN bands from the pack.
5. **Pipeline orchestrator** — `packages/core/src/pipeline/solve.ts`: `solveColumn` wires
   layout → shape-gen → validation → rollup into a pure `SolveResult`. **D-P1-4** (not yet a
   generic element dispatcher — that's a P3 prerequisite).
6. **Archetypes** — added `shapes/attente.json` + `shapes/baionnette.json` (column lap-zone
   shapes; authored + integrity-valid, not yet wired into a scheme — lap-zone scheme is P3).

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ (mathjs import is allowed; core
still has no DOM/React/three) · manifests ✓ {shapes:5, elements:1, schemes:1, supplements:1} ·
typecheck ✓ · **64/64 tests** across 14 files. New suites listed in §1. Worked reference column
(`b300×h600×H3000`, FeE500/C25, 6Ø20 + Ø8@200): As,prov=1884.96 mm², s_clear=82 mm, c_nom=30,
s_t,max=300, A_min=720 / A_max=9000, d=552 (= h−c−φt−φℓ/2, **not** 0.9h=540).

**Decisions:** D-P1-1…D-P1-5 in §8. The load-bearing ones: cutLength model (D-P1-1), pack-by-DI
(D-P1-3), and "no element branching — add a profile registry for the beam" (D-P1-4).

**Open / deliberately deferred (be honest):**
- **G-BAEL is UNSIGNED.** Every BAEL number is provisional (`bael_reference.spec.ts` is flagged,
  `res.provisional===true`). P1 *code* is done; P1 *acceptance* waits on the engineer (§6, §14.7).
  Notable discrepancy to raise: computed `l_s≈44φ` vs tabulated ≈40φ (D-P1-2).
- **Mandrel bearing-stress escalation (§7.6)** not implemented — only the 4φ/7φ baseline + the
  feasibility check (≥ code min, ≥ φℓ). The `F_bt·(1/a_b + 1/2φ)/f_cd` term is a TODO (P4 with EC2).
- **Curtailment/shift, end-support anchorage (§7.7)** = P3 (beam). Seismic/EC2 = P4. No `dist` build
  yet (raw-TS entry still fine; SPA in P2 will need it — §7.2).
- No git commit (waiting on owner; §7.6). `package-lock.json` updated by the mathjs install.

**→ Next agent: P2 / M2 (SPA shell + 3D viewport)** — `v1.0_imp_plan.md` Phase 2. The engine is
ready to be consumed **unchanged**: `solveColumn` returns plain arrays (`centerline3D`, bar
positions, `RuleResult[]` with `affectedGroupIds`) — the viewport must be a dumb renderer (keep
all geometry math in core). You'll need the `dist` build for the browser (§7.2). *Before starting:
`git log`/diff to confirm nothing moved since this entry; `npm run check` to confirm GREEN; then
append your own §9 entry.* If you instead pick up where P1 left gaps, the two worth closing first
are the **profile registry (D-P1-4)** and chasing the **G-BAEL signature**.

### 2026-06-24 — P0 / M0 complete — by **Zayd** (dev box)

**What I did (in detail).**
Scaffolded the monorepo and **pinned the six core contracts** as TypeScript types + JSON Schemas +
fixtures, with the **manifest-integrity CI gate** — exactly the M0 scope ("types + schemas +
fixtures, no UI, no solver bodies", spec §12 M0). Concretely:

1. **Monorepo + tooling.** Root `package.json` (npm workspaces over `packages/*` + `apps/*`),
   `tsconfig.base.json` + root `tsconfig.json` (strict, `moduleResolution: "Bundler"`),
   `vitest.config.ts`, `.gitignore`. Dev deps: typescript 5.6, vitest 2.1, ajv 8 + ajv-formats,
   tsx, @types/node. `npm install` succeeds; `package-lock.json` committed.
2. **The six contracts** in `packages/core/src/types/` — `shape.ts` (§5.2.1 segment grammar, turtle
   ops `line|turn|arc|hook`, hooks, mandrel rules), `distribution.ts` (§5.1.1), `placement.ts`
   (§5.4, incl. `RectLayout` + `LayoutPrinciple`), `reinforcing-element.ts` (§0.2.1/§10 supertype +
   `BarGroup` + `isBarGroup`), `layout.ts` (§6.1 solver I/O **incl. computed `d`/`d'` per zone**),
   `codepack.ts` (§7.11 `CodePack` interface + `RuleResult`, with the r3 anchorage/cover args),
   `rcfg.ts` (§10 envelope, forward-compat index signatures).
3. **JSON Schemas** in `packages/core/schemas/` for shape / element / scheme / supplement / rcfg
   (Draft 2020-12). The rcfg schema encodes forward-compat via `if/then` (see D-P0-2).
4. **Integrity gate** `packages/core/src/integrity/index.ts` — ajv schema validation +
   cross-reference checks (scheme→declared zones / existing shapes / catalogued supplements;
   supplement→existing shape) + the §5.2.1f expression-scope check. Exposed via `core` and run by
   `scripts/check-manifests.ts`.
5. **Real example manifests** in `apps/web/manifests/` — `DROITE`, `CADRE_RECT` (the §5.2.1h worked
   example), `EPINGLE`; element `E-COL-01`; scheme `COL_TIES_CROSSTIE`; supplement
   `SUPP_EPINGLE_CROSSTIE`. These are both the seed data for P1 *and* the happy-path of the gate.
6. **Fixtures + tests** in `tests/` — the §10 column `.rcfg` verbatim, a `TENDON` forward-compat
   `.rcfg`, and four deliberately-broken fixtures. Six spec files (28 tests): `schema.valid`,
   `schema.invalid`, `rcfg.roundtrip` (incl. unknown-kind preservation), `types.compile`
   (`expectTypeOf`), `crossref`, `engine-purity`.
7. **Purity gate** `scripts/check-engine-purity.mjs` — scans `packages/core` for React/three/DOM.

**State now: GREEN.** `npm run check` passes end-to-end (purity ✓ · manifests ✓ {shapes:3,
elements:1, schemes:1, supplements:1} · typecheck ✓ · 28/28 tests ✓). One false positive fixed
along the way (the purity scanner matched "document." inside a JSDoc comment → now strips comments
before scanning).

**Decisions:** see §8 (D-P0-1…D-P0-5). The most important for you: the Distribution-vs-layout split
(D-P0-1) and the forward-compat schema (D-P0-2) — don't undo them.

**Not done / deliberately deferred:** no solver/validation/exporter bodies (that's P1+), no app, no
`dist` build (raw-TS entry is fine until a Node/SPA consumer needs compiled JS — see §7.2). No git
commit (waiting on owner; §7.6).

**→ Next agent: start P1 / M1** (`v1.0_imp_plan.md` "Phase 1"). In order:
1. Build the **generic segment-grammar generator** (§5.2.1) — consume `ShapeArchetype`, emit
   `centerline3D` + `cutLength` + `fiche`. Use `mathjs` against the frozen scope (§5.2.1f); the
   in-scope symbol set is already enumerated in `integrity/index.ts` (keep them in sync).
2. Build the **layout solver** (§6.1) for the rectangular column: corner-bars-first (shared corners
   counted once), `SYMMETRIC`/`LAYERED`, **and emit computed `d`/`d'`** (the `ZoneGeometry` type is
   ready in `layout.ts`).
3. Implement the **BAEL-FR code pack** behind the `CodePack` interface (`codepack.ts`) — area,
   clear spacing, cover (incl. cast-against-earth + fire stub), column ratios + min bars, tie
   spacing + **leg-counted `Asw`**, mandrel (+ bearing-stress), anchorage/lap (+ `As,req/As,prov`
   reduction + auto bond-class). **Flag every numeric constant `"_provisional": true` until G-BAEL
   is signed** (§6 here).
4. Wire the **validation engine + validity-layer tiers** (§0.1, §7.12) and the **pipeline
   orchestrator** (§6). Headless. No UI.
5. **Tests that gate P1:** the BAEL **engineering reference cases** (these need G-BAEL sign-off),
   `segment_grammar` (CADRE_RECT closure + cutLength), `layout_corner_sharing`, `effective_depth`,
   `leg_count_asw`, `anchorage_reduction`, `validity_tiers`, `determinism`.
   *Remember the golden rule: the BAEL pack is data + functions behind `code.*` — no element/code
   branching in the engine.*
   *Before you start: `git log`/diff to confirm nothing changed since this entry; run `npm run
   check` to confirm the P0 baseline is still green; then append your own §9 entry when done.*
