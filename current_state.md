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
| **P4a / M4a** — Circular/pile/slab geometries + helix/mesh generators + **EC2 pack** + slab predicates | ✅ **DONE** (code) · ⏳ G-EC2 unsigned | Zayd, 2026-06-24 |
| **P4b / M4b** — Stair `E-STR-01` + joist slab `E-SLB-03` + **RPS-2011 seismic overlay** | ✅ **DONE** (code) · ⏳ G-RPS unsigned | Zayd, 2026-06-24 |
| **P5 / M5** — Section/Coupe engine ✅ · BBS ✅ · DXF-1/DXF-2 ✅ · PDF + export-lock ✅ · `.rcfg` I/O + autosave ✅ · WARN stamp ✅ · **SPA wiring (Export/Import + BBS table + coupe manager + autosave) ✅** | ✅ **DONE** (code) · ⏳ G-COUPE unsigned · ⚠ 3D coupe drag-handle deferred to P6 (numeric+keyboard parity shipped) | Amer, 2026-06-25 |
| P6 / M6 — Hardening: **coverage 95% ✅ · i18n ✅ · heavy-perf ✅ · code-split ✅** · **control-panel fixes 8a ✅ + 8b beam-top-bars ✅ + 8c brins-auto-draw ✅ (all code+test)** · **all 8 elements + seismic picker wired into the SPA ✅ (D-P6-3)** · (**ViewCube + 3D coupe drag-handle → moved to `v1.0.1-Spec.md`**; a11y axe · authoring/user docs · engineer sign-off — pending) | 🟢 **CODE DONE (this session)** · ⏳ GPU/docs/sign-off pending | Zayd, 2026-06-25 |
| **P7 — Multi-element project model** | 🟢 **CORE DONE (code): model + element manager + steel takeoff + `.rcfg` v1.1 envelope + migration (D-P7-3).** Remaining (combined exports · namespaced BBS · elevation *fiche* · reorder) **→ `v1.0.1-Spec.md` Feature C** | Zayd, 2026-06-25 |

**The app is now testable end-to-end with the WHOLE element catalog + multi-element projects.** This
session (Zayd, 2026-06-25 — see the newest §9 entry) closed the P6 control fixes (8a/8b/8c), **wired all 8
§3.1 elements + the seismic regime picker into the SPA** (was column+beam only), shipped the **P7 project
core** (instance list + element manager + steel takeoff + `.rcfg` v1.1 envelope + legacy migration), and
authored **`v1.0.1-Spec.md`** — which now holds the two deferred GPU/visual features (**ViewCube**, **3D
coupe drag-handle**) **plus** the remaining project work (**combined exports, namespaced BBS, elevation
*fiche*, reorder** — Feature C). The single-element engine/exporters from P5 are unchanged underneath.

**Test status (this session):** `npm run check` green — purity ✓, manifest integrity ✓ (**13 shapes** / **8
elements** / **10 schemes** / **7 supplements**), core typecheck ✓, web typecheck ✓, **303 tests passed**
across 61 files (+27 / +7 vs the prior P6 handoff). New web suites this session: `all_elements`,
`beam_top_bars`, `tie_legs_geometry`, `project_model`. `npm run coverage` ✓ (95.14% core, thresholds
enforced). `npm run build:web` ✓ (app/engine ≈ 784 kB + three ≈ 998 kB + lazy pdf-lib ≈ 434 kB). **Still a
headless box — no human has visually verified WebGL/PDF**; the ViewCube + 3D coupe handle are specified for
v1.0.1 precisely because they need a GPU (the owner will test the rest on a Windows PC).

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
                          #   P4a: registry.ts (generateShape seam) + bespoke/{helix,mesh}.ts (§5.2.1g)
  src/layout/             # P1: rect.ts — corner-share layout + computed d/d' (computeZoneGeometry)
                          #   P4a: circular.ts (EQUAL_PERIMETER pitch circle) + slab.ts (per-metre)
  src/validation/         # P1: index.ts (validateColumn, tierFor, …) + P3: profiles.ts
                          #   (VALIDATION_PROFILES: BAEL_COLUMN/BAEL_BEAM — D-P3-1; +P4a CIRCULAR_COLUMN/
                          #   SLAB_ONEWAY/SLAB_TWOWAY) + P4a predicates.ts (§7.13 slab/corner-torsion)
  src/scheme/             # P3: resolve.ts — scheme→zone map, placement+supplement resolvers,
                          #   nearestBarIndex, computeCurtailment (§5.3–5.7, D-P3-4)
  src/pipeline/           # element.ts: generic solveElement (D-P3-1) + solve.ts: solveColumn shim
                          #   P4a: circular.ts (solveCircular) + slab.ts (solveSlab) — section pipelines
                          #   P5: every result now carries member: MemberPlacement (D-P5-1, §9.5)
  src/section/            # P5: Section/Coupe engine (§9.5) — place.ts (placeBars: world geometry),
                          #   sectionAt.ts (sectionAt → CoupeView + defaultCoupeFor), types.ts,
                          #   convention.ts (provisional coupe conventions → G-COUPE)
  src/index.ts            # public surface: types + geometry/layout/validation/profiles/scheme/pipeline
packages/codepacks/       # @rebarconfig/codepacks — packs behind core's CodePack iface (P1, P4a)
  src/bael/bael-constants.json  # ⚠ PROVISIONAL BAEL constants, "_provisional": true (G-BAEL)
  src/bael/index.ts       # makeBaelPack(): BaelPack — code.* impls + PackExtras (bands, ls, slab, …)
  src/ec2/ec2-constants.json    # ⚠ PROVISIONAL EC2 constants, "_provisional": true (G-EC2) [P4a]
  src/ec2/index.ts        # makeEc2Pack(): Ec2Pack — same code.* names, EC2 forms (§7.1–7.8) [P4a]
packages/exporters/       # @rebarconfig/exporters — P5 export engines + project I/O (depends on core)
  src/bbs.ts              # computeBBS(result) → §9.1 schedule (unitMass, marks, merge, summary) + nestCuts
  src/dxf.ts              # DxfBuilder (R12) + buildDxf1 (elevation+default coupe) / buildDxfCoupes (DXF-2)
  src/pdf.ts              # buildPdf(result) → Uint8Array (cartouche + views + BBS + stamp); pdf-lib; 🔴-locked
  src/export-lock.ts      # canExport/assertExportable/ExportLockedError + statusStamp (§7.9/§7.12)
  src/rcfg.ts             # serializeRcfg/parseRcfg (+migrate), section_cuts, AutosaveManager + IndexedDB store
  src/index.ts            # barrel (BBS/DXF/PDF/export-lock/.rcfg). PURE except pdf-lib + browser IndexedDB glue
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
| **G-COUPE** | P5 (coupe) | coupe drawing conventions (§9.5, [REF-EXT-GAP-7], §14 items 14–17): near-parallel angle threshold, default look-behind depth, cutting-line/tag style, default coupe station |
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
- **D-P4a-1 — Shape registry is the single geometry seam (§6, §5.2.1g).** `geometry/registry.ts` maps
  `archetypeId → generator`; `generateShape(...)` dispatches to a registered **bespoke** generator if one
  exists, else the generic segment-grammar generator. Exactly two bespoke entries: `SPIRALE_HELICE`
  (`bespoke/helix.ts`) and `TREILLIS_MESH` (`bespoke/mesh.ts`). The whole pipeline (element/circular/slab)
  now calls `generateShape`, never `generateBarShape` directly — adding a non-polyline shape = register one
  function, nothing else. The bespoke generators **do not** evaluate `totalLengthExpr` (only the integrity
  scope-check reads it); their cut/coil lengths come from closed-form geometry.
- **D-P4a-2 — Section dispatch lives in the pipeline, NOT element branching.** Circular and slab need
  genuinely different layout algorithms (spec §6.1 enumerates rect/circular/slab as distinct), so they get
  their own orchestrators — `pipeline/circular.ts` (`solveCircular`: E-COL-02 + E-FND-01) and
  `pipeline/slab.ts` (`solveSlab`: E-SLB-01/02) — exactly like `solveColumn` is a shim over `solveElement`.
  All three **share the seams**: shape registry + the **profile registry** (`getValidationProfile`). There
  is still **no `if (elementType===…)`** anywhere; dispatch is by *section* (a data axis) + *profile id*.
  `ProfileContext` gained optional `section`/`circular`/`slab` fields and `layout`/`geometry.{b,h}` became
  optional; the P1/P3 rect profiles assert `ctx.layout` and read `b,h ?? 0` (rect path byte-identical).
- **D-P4a-3 — Profiles are pack-agnostic; the `BAEL_` prefix is legacy naming.** `validateColumnProfile`/
  `validateBeamProfile` already validate identically under EC2 (all limits via `code.*`). New P4a families use
  **neutral element-family names**: `CIRCULAR_COLUMN` (shared by circular column + pile), `SLAB_ONEWAY`,
  `SLAB_TWOWAY`. `pack_swap.spec` proves swapping BAEL↔EC2 changes only the limits (ρ-limits, cover, tie-ø),
  not the pipeline or provided area. Renaming the two legacy keys was deliberately deferred (would touch the
  `solveColumn` shim + E-COL-01/E-BEM-01 manifests + tests for zero behaviour gain).
- **D-P4a-4 — EC2 pack behind the SAME `code.*` names (§7.11).** `packages/codepacks/src/ec2/` —
  `makeEc2Pack()` implements EC2 forms: `l_b,rqd=(φ/4)(σ_sd/f_bd)` with `f_bd=2.25·η₁·η₂·f_ctd`,
  `f_ctm=0.30·f_ck^⅔`; ρ-limits `0.2%/4%·Ac` (col) and `max(0.26·f_ctm/f_yk·b·d, 0.0013·b·d)` (beam/slab);
  `s_cl,tmax=min(20φ,b,400)`; tie-ø `max(6,φ/4)`; cover by EC2 exposure class + fire; mandrel 4φ/7φ.
  **All constants in `ec2-constants.json` flagged `"_provisional": true` (gate G-EC2)** — same discipline as
  BAEL/G-BAEL. The codepacks barrel re-exports both packs selectively (both ship a same-named `PackExtras`).
  Added `slabSpacingMax(h,secondary)` + `distMinFraction` to **both** packs and to core `CodePackExtras`.
- **D-P4a-5 — Slabs are per-metre + spacing-driven; topological predicates are pure functions.**
  `layout/slab.ts` (`slabProvidedPerMetre`, `slabEffectiveDepth`) + `validation/predicates.ts`
  (`slabDistributionMin` 🔴, `twowayCornerTorsionMissing` 🟠) per §7.13. The slab profile checks provided
  area/m, `As,min` over a 1 m strip with the **computed d**, and max bar spacing; one-way adds the
  distribution-min predicate, two-way adds the corner-torsion predicate. `end_support_anchorage_short`
  stays the beam profile's existing inline check (§7.7).
- **D-P4a-6 — Helix/mesh are closed-form, oriented for placement; 3D mesh render is indicative.** Helix
  axis = local +v (coil in u–w), `coilLength = turns·√((π·D_h)²+pitch²)`, sampled at 36 pts/turn. Mesh emits
  per-direction wire counts (`floor(extent/pitch)+1`) + lengths + total; its `centerline3D` is the **panel
  outline only** (presence), exact per-wire 3D deferred like supplements (D-P3-6). Spiral confinement is
  treated as a 2-leg hoop at `spacing = pitch` for `Asw/m` (reuses `aswProvidedPerMetre`).
- **D-P4b-1 — The seismic overlay is a SECOND injectable contract, parallel to `CodePack` (§7.10).**
  New frozen interface `SeismicOverlay` (`packages/core/src/types/seismic.ts`): the engine stays
  overlay-agnostic exactly as it is pack-agnostic — it calls `overlay.criticalZoneLength / critSpacingMax /
  injectCriticalSegments / hookRule / requiredConfinement / engagementRule / lapInCriticalZoneTier`, and the
  RPS implementation (`packages/codepacks/src/seismic/`) supplies constants + behaviour. `makeRpsOverlay(regime)`
  rides on **either** BAEL or EC2 (it never touches the base pack). A future EC8/ASCE7 overlay = a second
  `makeXxxOverlay` — **no engine change**. All cells in `rps-2011.json` flagged `"_provisional": true` → gate
  **G-RPS** (same discipline as G-BAEL/G-EC2). **Don't fold seismic constants into the base packs.**
- **D-P4b-2 — Overlay composes AFTER the base profile, in `solveElement` (no element branching).** When
  `ElementSolveInput.seismic` is set, `solveElement` runs the base profile validator, then `applySeismicOverlay`
  (`validation/seismic.ts`) appends the §7.10 items (per-segment critical-zone spacing, crit tie-ø, 135°/10φ
  hooks, `confinement_required`) + the §7.13 seismic predicates (`lap_in_critical_zone`, `crosstie_engagement`),
  and the status rolls up once over the combined list. `solveColumn` passes a `seismic` block through (derives
  the member `{length,bMin,hSectionMax}` from geometry). **Segment injection is data, not geometry:** the
  result carries `seismic.{l_c, segments}` (`END_BOTTOM/MIDDLE/END_TOP`, user spacing → `MIDDLE`) for preview +
  per-segment BBS marks. Seismic wired to column/beam (the members with plastic-hinge zones); slabs/piles/stairs
  don't get it in v1.0 (out of scope, no test). **No `if (elementType===…)`; dispatch stays by section + profile.**
- **D-P4b-3 — Stair + joist are SLAB-FAMILY sections (reuse the per-metre machinery).** `pipeline/stair.ts`
  (`solveStair` → `STAIR` profile) and `pipeline/joist.ts` (`solveJoist` → `JOIST_SLAB` profile) mirror
  `solveSlab`: per-metre provided steel (`slabProvidedPerMetre`), computed `d` (`slabEffectiveDepth`), shapes via
  the registry, `SolvedSlabZone`/`SlabContext` reused. Both profiles call the shared `slabZoneChecks` +
  `slabDistributionMin` (stair: As_dist; joist: topping mesh ≥ 0.2·joist-bottom). The stair adds a `StairContext`
  + the `stair_reentrant_corner_pullout` predicate. **No new layout solver was needed** — the slab seam already
  covered them; this is the §0.1 thesis a third way (new element = new pipeline shim + profile + manifests).
- **D-P4b-4 — `MARCHE_PALIER` is a GENERIC polyline shape (no new generator).** Authored as a 3-op segment-grammar
  shape (`flight` line → `bend` turn → `landing` line, like `RELEVE`/`BAIONNETTE`); it goes through the generic
  generator, **not** the bespoke registry — confirming only helix+mesh are truly bespoke (D-P4a-1). The
  re-entrant-corner risk is **not** geometry; it's the `stair_reentrant_corner_pullout` predicate fed by
  `StairContext.{reentrantCorner (landing_L>0), mainBarWrapsCorner}`: 🔴 when a tension bar is continuous around
  the concave kink, PASS when split+anchored or no landing. `mainBarWrapsCorner` defaults **false** (the correct
  split detailing) — a wrapped main bar is an explicit unsafe choice.
- **D-P4b-5 — Hook/lap/engagement facts are INPUTS the overlay reads, not new geometry.** Ties carry optional
  `hookAngle`/`hookExtFactor` (default 135/10 — the gravity good-practice default per §5.2.1d); the seismic block
  carries `longBarsTotal`/`longBarsEngaged`, `confinementPresent` (catalog ids; defaults to the supplements'
  `catalogId`s), and `laps[]` (extents along the member axis). `lap_in_critical_zone` tests `[start,end] ∩ ([0,l_c]
  ∪ [L−l_c, L])`; `confinement_required` FAILs (export-blocking, §0.1) when a required add-on id is absent. These
  are honest **edge-supplied** facts for v1.0 — the UI will populate them in a later pass (see deferred, below).

---

- **D-P5-1 — World placement is now a first-class CORE output (`SolveResult.member`).** The 3D
  placement convention (member axis = world **+Y** over `length`, cross-section in **X–Z**: `u→X`,
  `v→Z`) used to live ONLY in the SPA (`apps/web/src/viewport/rebarProps.ts`). The Section/Coupe
  engine (§9.5) must reconstruct world bar geometry purely in core, so every pipeline now emits a
  `MemberPlacement` (`types/layout.ts`): `{ envelope: "RECT"|"CIRCULAR", length, b?,h?,D?,
  transverse[] }`. This *unifies all 8 elements as axial prisms*: slab-family sections map to a RECT
  envelope (width × thickness, bars running along the span). `member` is a **required** field on
  `SolveResult` (all 5 orchestrators populate it; column shim inherits it). New pure core module
  `packages/core/src/section/place.ts` (`placeBars(result) → PlacedBar[]`) is the core-side twin of
  `rebarProps.buildScene` — **the web mapper should be refactored to consume `placeBars` in a P6
  polish pass** (today both exist; the engine one is the source of truth). No `.rcfg`/contract change.
- **D-P5-2 — `sectionAt` is pure plane∩geometry; coupe conventions are provisional DATA.** `sectionAt
  (result, cut, conv?) → CoupeView` (`packages/core/src/section/sectionAt.ts`) intersects the cut
  plane with the concrete envelope (box-edge crossings for RECT → convex polygon; sampled lateral
  surface for CIRCULAR → circle/ellipse) and classifies each bar segment by **crossing angle**: steep
  → a nominal **circle** of Ø at the plane-crossing point; below the near-parallel threshold → a
  **line** (elevation run, e.g. a tie outline). **Look-behind** shows the cut face + within
  `lookBehind_mm` behind (viewing arrow = +normal), with a hard **"nearest transverse set"** guarantee
  (§9.5.3) so a cut between two stirrups still shows the nearest one. The cutting-line/tag, near-parallel
  threshold (≈25°), and default look-behind (≈ one spacing clamped 100–150 mm) live in
  `section/convention.ts`, all flagged `_provisional` per **[REF-EXT-GAP-7]** + §14 items 14–17 — a new
  **G-COUPE** convention gate (owner sign-off), same discipline as G-BAEL/EC2/RPS. `defaultCoupeFor
  (result)` seeds the perpendicular mid-length representative coupe (§14 item 17).
- **D-P5-3 — Coupe coverage is exact for axial members, representative for slab-family (honest).** Column/
  beam/circular-column/pile produce exact coupes (true prismatic members). Slab/stair/joist reuse the
  RECT-envelope axial model; their per-metre **distribution bars are placed along the span like the main
  steel** (the D-P4a-5 representative model), so a slab coupe shows main bars exactly but distribution
  bars indicatively — a P6 refinement, disclosed. Oblique CIRCULAR cuts are a **sampled** ellipse.
- **D-P5-4 — The export engines live in a NEW package `@rebarconfig/exporters`, not in core.** BBS/DXF/PDF
  /`.rcfg` I/O are pure transforms of a `SolveResult`/`CoupeView`; they depend on `@rebarconfig/core` and
  mirror the `codepacks` pattern (separate workspace, raw-TS `src` entry, no `dist`). **Rationale:** keeps
  the engine lean + framework-agnostic (the PDF needs `pdf-lib`; putting it in core would bloat the SPA
  bundle and muddy the purity boundary). BBS + DXF + the `.rcfg` serialise/parse + `AutosaveManager` are
  **dependency-free pure TS** (golden-tested headlessly); only `pdf.ts` pulls `pdf-lib` (pure JS, no DOM) and
  `rcfg.ts`'s `indexedDbStore()` touches the browser `indexedDB` (injected behind a `KeyValueStore` so
  autosave is unit-tested with `memoryStore()`). The package is NOT yet a web dependency — the SPA Export
  button is still the P2 export-lock stub (D-P2-5); wiring it is the P5 UI follow-up. *(Convention default per
  §0 — flagged, not a scope/product change.)*
- **D-P5-5 — DXF is a hand-rolled deterministic R12 (AC1009) writer; no DXF library.** `DxfBuilder` emits
  `LINE`/`CIRCLE`/`TEXT` on the **four strict layers** `COFFRAGE`/`ARMATURES`/`COTATION`/`TEXTE` (§9.2). Bytes
  are stable (4-dp formatting, no `-0`) → golden-testable, and R12 LINE-runs read in any CAD. Source geometry
  is written ONCE in core: the **elevation** is `placeBars` projected to `(axis=+Y, height=+Z)`; the **coupe**
  is `sectionAt`'s `CoupeView`. `buildDxf1` = elevation + the default coupe (release bar); `buildDxfCoupes` =
  DXF-2 (multiple/oblique coupes + per-coupe cutting-line/tag on the elevation). The §9.2 label-collision
  solver stays templated (deferred per the plan). **Transverse BBS counts reuse `transverseStations`** (the
  same source as the 3D placement) and a **continuous spiral counts as ONE bar** (detected via the helix
  result's `coilLength`), never `floor(H/pitch)` discrete sets.
- **D-P5-6 — `.rcfg` forward-compat rides the existing index signature; `section_cuts[]` needs NO core
  contract change.** `parseRcfg`/`serializeRcfg` are JSON in/out that preserve unknown top-level fields,
  unknown `kind`s (D-P0-2), AND unknown coupe fields — `section_cuts` is carried as additive data (typed via
  `RcfgProject = RcfgDocument & { section_cuts?: SectionCut[] }`, but it survives even on a reader that doesn't
  type it). `rcfg_version` gates a (currently empty) migration registry; a FUTURE/newer version loads as-is,
  never dropped. **Export lock (§7.9):** `buildPdf` throws `ExportLockedError` on a 🔴 FAIL; WARN compiles but
  is stamped "À vérifier / Review required" (the stamp also rides on the BBS record via `reviewRequired`).

- **D-P5-7 — SPA `.rcfg` round-trip rides a namespaced `meta.app_document`; canonical §10 reinforcement[]
  mapping is deferred.** The web app's editable state is the UI-convenience `ElementDoc` (column|beam); the
  on-disk format is the canonical §10 `RcfgDocument`. The adapter `apps/web/src/engine/rcfgDoc.ts`
  (`docToRcfg`/`rcfgToDoc`) bridges them: it **populates the canonical fields faithfully** (region/codePack/
  seismic=null/units/element{type,geometry,material,cover,`As_req` per zone}/reinforcement{schemeId,mode}) AND
  carries the **verbatim `ElementDoc` under `meta.app_document`** so save→load restores the exact editable
  state without reverse-engineering the §10 `reinforcement.baseGroups[]` array back into a doc. The full
  `ReinforcingElement[]` population of `baseGroups`/`supplementalGroups` is **deferred to P6** (the SPA reloads
  from `app_document`; §10 forward-compat is preserved by the envelope index signature + the meta carry —
  `coupe_store.spec` asserts unknown top-level + unknown cut fields survive). A future file from another tool
  that wrote only canonical arrays (no `app_document`) loads as a no-op in the SPA today (`rcfgToDoc →
  undefined`) — also P6. **Convention default (spec §0), flagged, not a product/scope change.** Export glue
  (`apps/web/src/engine/exportActions.ts`): Blob/anchor download, jsdom-guarded (`downloadBlob` swallows
  jsdom's throwing `URL.createObjectURL` and reports `false`); the Navbar Export menu locks PDF/DXF on 🔴 but
  always allows BBS + `.rcfg` (a failing project must stay inspectable/persistable). **Coupe manager:** the
  store holds `cuts[]` with index 0 = the **auto-managed default representative coupe** (re-seeded via
  `defaultCoupeFor` on every solve, preserving user cuts; dropped on element/scheme switch — a cut's world
  position is meaningless against a different member). Cuts are perpendicular at a chosen `origin.y` station;
  **oblique/free orientation is engine-supported + persisted in `.rcfg` but the orientation control + the 3D
  drag-handle are P6** (numeric + keyboard placement ship now with full a11y parity). **Autosave**
  (`apps/web/src/ui/useAutosave.ts`) wires `AutosaveManager` over `indexedDbStore()` (falls back to in-memory
  headlessly → tests/SSR are no-ops): recover-on-mount + debounced save on every doc/cuts change.

- **D-P6-1 — Control-panel audit: 3 confirmed control defects + the owner-chosen fixes (specced, code pending).**
  A deep trace of every Sidebar control → store → engine found that *most* controls are distinct + used, but **three**
  are defective (the user's report "different parameters do the same thing / a param does nothing"):
  - **(a) Column face counts are redundant under the hidden `SYMMETRIC` principle.** The column shows 4 fields
    (`nTop/nBottom/nLeft/nRight`) but `longitudinal.principle` is hard-pinned `SYMMETRIC` (no UI), and `rect.ts`
    `faceCountsOf` coerces `nTop=nBottom=max(...)`, `nLeft=nRight=max(...)` → "haut"≡"bas", "gauche"≡"droite"
    (effective DOF = 2, not 4). **Owner decision: add a `SYMMETRIC`⇄`FREE` selector** (Géométrie tab) — Symmetric
    shows 2 distinct counts, Free shows 4 independent. (Spec §6.1#5 [REF-UI-815], §8.)
  - **(b) Beam top steel is scheme-gated + conflated.** Bottom (span) bars have a full control set; the top face count
    is **hardcoded `nTop=2`** ([solveDoc.ts:123](apps/web/src/engine/solveDoc.ts:123)) and only editable via chapeaux,
    and only when the scheme enables them. **Owner decision: a dedicated full-length top-bar control** (Ø+count) for
    montage/compression steel, **separate from the chapeaux** (top *support* overlay). Engine needs the chapeau zone to
    carry an **explicit provided-count** (not derived from the layout top face) so the two don't double-count. (§8 [REF-UI-720].)
  - **(c) `Brins` (tie legs) is a paper number.** `nLegs` (2–6) feeds `Asw` correctly but the 3D draws only the base
    2-leg tie and the BBS omits the extra legs — number, model, and schedule disagree. **Owner decision: auto-draw the
    legs** — `n_legs>2` materializes `(n_legs−2)/2` evenly-spaced cross-ties that render in 3D + get BBS marks; `n_legs`
    read back from resolved geometry. (Spec §7.5 [REF-UI-755].) *Spec §7.5 already INTENDED legs "derived from resolved
    geometry"; the free numeric field was the as-built divergence.* **All other controls confirmed distinct + used**
    (`continuedToSupport`→end-support anchorage, `supportZone`→curtailment, material `f_c28`/`f_e`, tie spacing/Ø/aswReq,
    geometry b/h/H/L/cover, exposure). Minor nit: column `h` and `H` both labeled "Hauteur" (clarity, not redundancy).
- **D-P6-2 — ViewCube view-orientation widget (new P6 feature; specced + planned, code pending).** Owner asked for an
  **AutoCAD/Revit-style ViewCube** in a viewport corner controlling the **camera view direction** (view, not model):
  **snap** by clicking a cube face/edge/corner + **free continuous rotation** by dragging the cube to any orientation
  (Revit-style), locked to `OrbitControls`. **Element-aware default**: 3/4 isometric with **column upright, beam
  horizontal** (supersedes the D-P3-6 "beam stands up" placeholder); a **home** resets to it. Separate **perspective ⇄
  orthographic** projection toggle. **a11y**: named views via a keyboard/list control. View is **session state** (NOT
  persisted in `.rcfg` v1.0). Camera-only — **no engine change**; the pure camera-state mapping (element→default
  quaternion, cube-face→direction) is unit-testable headlessly, but the widget itself needs a **GPU/browser to verify**.
  Defaults (iso angle, element→up-axis) are spec §14 item 18 (owner UX confirmation, no engineering sign-off). Spec
  §2.1/§8 [REF-SYS-810]/[REF-UI-810]; plan P6 steps 8–9.

- **D-P7-1 — Multi-element PROJECT model (owner-requested; spec+plan done, code not started).** Real projects have many
  element *types*; exporting one at a time isn't useful. Owner chose a **full project model** (not just batch export): the
  store will hold a **`Project` = ordered list of `ElementInstance`** (`{ mark, quantity, document }`), one **active** for
  editing; an **element manager** UI adds/duplicates/renames/reorders/removes types. **The engine stays a per-element pure
  function** — the project is a *container* of independent solves (no `if(elementType)`; no engine change). `quantity` scales
  steel **totals** only (one solve per type). Project-level = region/codePack/seismic/units/materials; per-instance =
  geometry/reinforcement/coupes. **`.rcfg` becomes a project envelope** (`rcfg_version "1.1"`, top-level `elements[]`); a
  **legacy 1.0 single-element file migrates to a 1-instance project**; forward-compat preserves unknown fields/kinds/instances
  (D-P0-2 extended). **Steel takeoff (owner-specified):** per type report **unit mass (kg)** + **steel density (kg/m³ =
  unit/concrete-vol)** + **total mass = quantity×unit**; plus **project grand totals** (steel kg, concrete m³, overall ratio)
  + per-Ø rollup. BBS marks **namespaced per type** (`P1-01`). **Exports:** PDF = **sheet per type + a project summary sheet**;
  DXF = one file per type; **export-lock is per project** (any 🔴 type blocks the combined export). Spec §3.2 [REF-DATA-250],
  §9.1 [REF-SYS-915], §9.3, §10; plan **Phase 7** (post-r3 addition). §14 items 19 (project conventions) + the file-version bump.
- **D-P7-2 — Elevation *fiche* is a shop drawing, not a bare projection (owner-requested full-fiche).** Audit of the exported
  PDF elevation (`drawElevation` in `packages/exporters/src/pdf.ts` ← `placeBars`): it projects to (length, height) dropping
  width — a legitimate **side elevation** (longitudinal bars as horizontal lines collapsed by height; ties as correct vertical
  lines at spacing) BUT **(1) always drawn horizontal** (a column should stand **upright**), **(2) zero annotations** (no bar
  marks/counts, no length/section dims, no tie-spacing callout). **Owner decision: full shop-drawing fiche** — element-aware
  orientation (column upright / beam horizontal, **shares the ViewCube up-axis map** D-P6-2), **bar marks + counts** (`3 Ø20`),
  **tie-spacing callout** (`Ø8 e=200`), **overall-length + section-depth dimensions**. Geometry still computed **once** in core
  (`placeBars`→2D projection) shared by DXF+PDF; marks/dims are an annotation layer. Applies to single-element export too. Spec
  §9.2 [REF-SYS-925]; plan Phase 7 step 3; §14 item 20 (detailing depth).

- **D-P6-3 — All 8 §3.1 elements + the seismic picker are now wired into the SPA (data-driven UI generalisation).** The
  SPA used to expose only `E-COL-01`/`E-BEM-01`; the engine already solved the other six. New
  `apps/web/src/engine/elementSpecs.ts` declares — ONCE — each non-rect element's geometry fields + reinforcement zones
  (GREEN-by-default values), consumed by BOTH the default-document factory and the Sidebar controls (the §0.1 "everything
  is data" thesis on the UI edge). `document.ts` gained a generic `GenericDoc`/`ZoneEdit` (circular/slab/joist/stair) +
  `defaultGenericDoc`; `solveDoc.ts` marshals it into `solveCircular`/`solveSlab`/`solveStair`/`solveJoist` (no engine
  change — the orchestrators already existed). **The viewport now consumes core's pure `placeBars` + `result.member`
  (the long-deferred D-P5-1 dedupe), so `rebarProps.buildScene` is element-agnostic and the concrete renders as a RECT box
  or a CIRCULAR cylinder by envelope.** A **seismic regime picker** (Projet tab) composes the RPS overlay on the
  column/beam via `solveDoc` (the engine seismic block existed). Full editable control panels per element, like
  column/beam. `Navbar` element/scheme pickers populate from the manifests automatically. Tests: `all_elements.spec`.
- **D-P7-3 — Multi-element PROJECT core shipped as an ADDITIVE "checkout" layer (no rewrite of single-element editing).**
  Implements D-P7-1's model without destabilising the working app: the store holds `instances: ElementInstance[]`
  (`{id, mark, quantity, doc, cuts}`) + `activeInstanceId`; the **active instance's doc/cuts ARE the existing live editing
  state** (top-level `doc`/`cuts`), so every single-element control + every prior test is unchanged. Project reads
  reconcile the live state back first (`syncActiveInstance`). Actions: add/duplicate/remove/rename/set-quantity/select.
  **Element manager + steel takeoff** (`ProjectPanel`, new bottom-dock tab): per type unit mass + total mass = qty×unit +
  steel density (kg/m³) + project grand totals (steel kg, concrete m³, ratio), via `projectTakeoff` (one `computeBBS` per
  type). **`.rcfg` v1.1 envelope** (`projectRcfg.ts`): top-level `elements[]` (each a full §10 doc + mark/quantity); top
  level mirrors the first element for legacy single-readers; a **legacy v1.0 file migrates to a one-instance project**;
  forward-compat preserves unknown fields/instances. Autosave persists the whole project; Navbar `.rcfg` export saves it.
  **Quantity scales TOTALS only — one pure solve per type (engine stays per-element).** Tests: `project_model.spec`.
  **Deliberately deferred → `v1.0.1-Spec.md` Feature C:** combined multi-sheet PDF/DXF, per-project export-lock UI,
  namespaced BBS marks (`P1-01`), the full elevation *fiche* (D-P7-2), reorder, and lifting region/code/seismic/units/
  materials to project level (today they are per-instance). The single-element exports (PDF/DXF/BBS of the active type)
  work as before.

## 9. Handoff log (newest first — APPEND your entry here before you stop)

### 2026-06-25 — P6 control fixes + ALL 8 elements + P7 project core + v1.0.1 spec — by **Zayd** (dev box)

**Context.** The owner asked (on his Windows PC) to *finalize implementing so he can test the app locally*, and chose the
scope: (B) expose all 8 elements + seismic picker with full controls, (A) control fixes 8b+8c, (C) the multi-element project
model, and (D) spec the deferred ViewCube + 3D coupe drag-handle into a new `v1.0.1-Spec.md`. Mid-session he refined (D): also
fold the **remaining** project work into the v1.0.1 spec. Delivery: commit + push to `feat/p1-m1-engine` (done — owner pulls
on Windows).

**What I did (all green, `npm run check` = 303 tests / 61 files, coverage 95.14% core, `build:web` ✓):**
1. **B — all 8 elements + seismic (D-P6-3).** Data-driven `elementSpecs.ts`; generic `GenericDoc`; `solveDoc` dispatch to the
   four existing section orchestrators; viewport refactored onto core `placeBars`/`member` (RECT box / CIRCULAR cylinder);
   seismic regime picker (column/beam). Full per-element controls. `all_elements.spec` (+11). **Pushed (d6b03df).**
2. **A — 8b + 8c.** **8b:** dedicated beam full-length top-bar control, separate from chapeaux; small backward-compatible
   engine add `ElementLongInput.providedCount` so the two TOP-face zones don't double-count. **8c:** a tie/stirrup with
   nLegs>2 materialises (nLegs−2)/2 cross-tie groups → they render in 3D AND hit the BBS (Asw was already correct from
   nLegs). `beam_top_bars.spec`, `tie_legs_geometry.spec`. **Pushed (ca5d326, 430c240).**
3. **C — P7 project core (D-P7-3).** Additive checkout-model project: instances + element manager + steel takeoff + `.rcfg`
   v1.1 envelope + legacy migration + whole-project autosave. `project_model.spec` (+8). **In the working tree — being
   committed with this handoff.**
4. **D — `v1.0.1-Spec.md`.** Detailed spec for **A·ViewCube** + **B·3D coupe drag-handle/cutting-line** (GPU-only, camera/
   interaction only, no engine/`.rcfg` change) **and (per the owner's mid-session refinement) C·the multi-element project
   completion** (combined exports, per-project lock, namespaced BBS, elevation *fiche*, reorder, optional project-level
   shared settings). §14 owner-confirmation items 19–20 added.

**State now: GREEN.** All work above committed+pushed to `feat/p1-m1-engine` (the P7 core + these docs in the same final
commit). The app is testable on Windows with the full 8-element catalog + multi-element projects + the P6 fixes.

**→ Next (for whoever picks up, likely on a GPU/Windows machine):** implement **`v1.0.1-Spec.md`** — Feature C first
(combined exports + namespaced BBS + elevation *fiche*, all headless-testable exporter work), then Features A+B (ViewCube +
3D coupe handle, GPU-verified). Still open from P6: a11y axe pass, the three authoring/user docs, and the **engineer
sign-offs** (G-BAEL/EC2/RPS/COUPE/TOL — the release-blocking people dependency). *Before coding: `git log`/diff; `npm run
check` + `coverage` + `build:web` GREEN; append a §9 entry.*

### 2026-06-25 — P7 specced: multi-element project model + elevation fiche (owner-requested) — by **Amer** (owner's Windows PC)

**What I did.** Per the owner's direction (study the exported PDF elevation; add a multi-element/project export capability),
**docs-first** again (no code): inspected the elevation render path and got the owner's design decisions (full-fiche
elevation; **full project model**; per-type **quantity**; steel **density + unit mass + total mass per element & per type**;
**sheet-per-type + project BBS** layout). Then updated:
- **Spec** `v1.0-Spec.md`: §2.1 (store holds a Project); **new §3.2 project model** [REF-DATA-250]; §8 element-manager UI;
  §9.1 **project BBS takeoff** [REF-SYS-915] (unit mass + density kg/m³ + total mass per type + project totals, namespaced
  marks); §9.2 **elevation *fiche*** [REF-SYS-925] (orientation + marks + spacing callout + dims); §9.3 sheet-per-type +
  summary + per-project export-lock; §10 **project envelope** (`rcfg_version 1.1`, `elements[]`, legacy migration); §14
  items 19–20.
- **Plan** `v1.0_imp_plan.md`: **new Phase 7** (project model + elevation fiche + combined exports) with 6 steps, 5 tests
  (`project_model`, `project_bbs`, `elevation_fiche`, `project_pdf`, `project_rcfg_roundtrip`), DoD, risks; 4 §V matrix
  rows; consistency-check note (Phase 7 = post-r3 addition, engine stays per-element pure).
- **current_state**: D-P7-1/D-P7-2 (above), §1 P7 row, this entry.

**State now: GREEN (docs only — no code touched).** `npm run check` / `coverage` / `build:web` remain green from the
prior entry (**276 tests / 57 files**). **No git commit** (owner-gated).

**→ Next.** Two tracks now queued, both code-not-started: **(A) finish the P6 control-panel fixes** 8b (beam top-bar
control) + 8c (brins auto-draw), and the **ViewCube**; **(B) Phase 7** (project model → element manager → elevation fiche →
project BBS → combined PDF/DXF → project `.rcfg` + migration). Suggested order: 8b/8c (small, headless-testable) →
elevation fiche (needed by every export) → project model + combined exports → ViewCube (GPU-verified). *Before coding:
`git log`/diff; `npm run check` + `coverage` + `build:web` GREEN; append a §9 entry.*

**What I did (in detail).** Two owner-directed tasks, **docs-first** (the owner asked to update spec + plan +
current_state *before* correcting code):

1. **Deep control-panel audit (Task 1).** Traced every Sidebar control → store action → `solveDoc` input → engine
   consumption. **Found 3 real defects** (column SYMMETRIC face-count redundancy; beam top steel hardcoded/scheme-gated;
   `Brins` a paper number not drawn/scheduled) and confirmed **all other controls are distinct + genuinely used**. Full
   detail + the owner's chosen fixes in **D-P6-1**. Got the owner's design decisions via 4 questions (symmetry selector;
   dedicated beam top-bar control; auto-draw legs).
2. **ViewCube feature (Task 2).** Captured the owner's design decisions (full clickable cube + Revit-style free rotate;
   element-aware iso default; perspective/orthographic user toggle) — **D-P6-2**.
3. **Docs updated (this entry's deliverable):**
   - **Spec** `v1.0-Spec.md`: §2.1 + §8 ViewCube ([REF-SYS-810]/[REF-UI-810]); §6.1#5 + §8 layout-principle selector
     ([REF-UI-815]); §7.5 + §8 leg-count⇄geometry consistency ([REF-UI-755]); §8 beam top-bar control ([REF-UI-720]);
     §14 item 18 (ViewCube convention defaults).
   - **Plan** `v1.0_imp_plan.md`: P6 objective + DoD + **steps 8 (control-panel correctness 8a/8b/8c) & 9 (ViewCube)**,
     new tests (`layout_principle`, `beam_top_bars`, `tie_legs_geometry`, `viewcube_orientation`), and 2 §V matrix rows.
   - **current_state**: this entry + D-P6-1/D-P6-2 + the §1 P6 row.

**Then implemented fix 8a (column symmetry selector).** Géométrie tab now has a `Disposition des barres` selector
(`Symétrique` ⇄ `Libre`); under SYMMETRIC the Schéma tab shows **two** merged-face counts (`verticalFaces` →
`nTop=nBottom`, `horizontalFaces` → `nLeft=nRight`), under FREE the **four** independent counts. Wired via the existing
`setLongitudinal` (carries `principle`); i18n `layout.*` keys added (FR/EN). New `apps/web/src/store/layout_principle.spec.tsx`
(4 tests: default SYMMETRIC; SYMMETRIC ties opposite face; FREE independent; UI renders 2 vs 4 fields). Updated the one
existing test that asserted the old "Barres haut" label (`beam_supplements.spec`). **No engine change** — the SYMMETRIC
coercion already lived in `rect.ts`; this just stops the UI exposing the redundant raw fields.

**State now: GREEN.** `npm run check` ✓ — **276 tests / 57 files** (+4) · `build:web` ✓ · `coverage` unaffected (UI-only).
**No git commit** (owner-gated; the owner paused a push to add these two tasks).

**→ Next (remaining Task-1 fixes + ViewCube):** **(8b) beam top-bar control** (add `beam.top` to the doc + an explicit
chapeau provided-count override in `ElementLongInput` so montage-top + chapeaux don't double-count — `beam_top_bars.spec`);
**(8c) brins auto-draw** (materialize `(n_legs−2)/2` cross-ties in `rebarProps.buildScene` + BBS + read back `n_legs` —
`tie_legs_geometry.spec`); then **(9) ViewCube** (pure camera-state module + tests headlessly; the 3D widget + visual check
on the owner's GPU via `vite dev`). Keep `npm run check` + `coverage` + `build:web` green; append a follow-up §9 entry.

**What I did (in detail).** Began **Phase 6** (hardening/sign-off/release) on the owner's local Windows box,
picking the slices that are **fully verifiable headlessly** (no GPU / no human signature needed), keeping the
gate green throughout. Concretely:

1. **Core coverage gate (§11 DoD).** Installed `@vitest/coverage-v8`; added a `coverage` config to
   `vitest.config.ts` (provider v8, `include: packages/core/src`, **excludes the type-only modules**
   `types/**` + `section/types.ts` so the % measures real solver/validation logic, not interfaces) with
   **thresholds statements/functions/lines = 90**, and a `npm run coverage` script (`vitest run --project core
   --coverage`). **Result: 95.14% statements · 99.05% functions · 95.14% lines** — comfortably over the bar
   (validation 94.8% · pipeline 97.8% · layout 96.1% · scheme 98.6% · section 94.8%). Branches 70% (advisory,
   ungated). Not folded into `npm run check` (instrumented run ~100 s) — it's a separate exit gate per the plan.
2. **i18n completeness (§8 DoD).** New `apps/web/src/i18n/i18n_complete.spec.ts`: asserts the **FR and EN
   bundles have identical key trees + zero empty leaves** (recursive key walk), and that **every UI-exposed
   manifest** (shapes/elements/schemes/supplements) carries non-empty `label_fr` + `label_en`. All bilingual
   today (verified: no manifest missing either label).
3. **Heavy-element performance (§2.2 DoD).** New `tests/perf_heavy.spec.ts`: best-of-15 pure-solve timing on the
   densest cases — a heavily-reinforced column with 50 mm ties (~80 transverse stations) and a joist slab with a
   75 mm topping mesh — both **< 16 ms** headlessly. Guards against a pathological O(n²) regression in placement;
   the web `perf_budget.spec` still guards the typical-element 16 ms target.
4. **Bundle code-split (§2.2 risk note).** (a) `exportActions.exportPdf` now **dynamically imports** `buildPdf`,
   so **pdf-lib (~0.5 MB) lands in a lazy chunk** loaded only when a PDF is actually exported — the exporters
   package is `sideEffects:false`, so the static DXF/BBS/`.rcfg` imports tree-shake pdf-lib out of the main
   chunk. (b) `vite.config` `manualChunks` puts **three + r3f + drei in their own long-cached vendor chunk**.
   Build now emits `app/engine ≈ 745 kB` + `three ≈ 998 kB` + lazy `pdf-lib ≈ 434 kB` instead of one ~2.18 MB
   blob.

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {13/8/10/7} · core typecheck ✓ ·
web typecheck ✓ · **272 tests / 56 files** (+5 / +2). `npm run coverage` ✓ (95% core, thresholds enforced).
`npm run build:web` ✓ (split chunks above). `vite dev` unaffected (port 5180).

**Decisions:** no new load-bearing architecture decision — these are test/config/build hardening. The coverage
exclude of type-only modules is the one convention call (flagged: it makes the % meaningful; types have no
runtime to cover).

**Open / deliberately deferred — the rest of P6 (be honest):**
- **Engineer sign-off gates UNSIGNED — the release blocker.** G-BAEL / G-EC2 / G-RPS / G-COUPE / G-TOL all still
  provisional (§6, §14). This is a *people* dependency on the critical path; **nominate the structural engineer**
  and ratify the constants tables + reference cases. No amount of coding closes this.
- **GPU / visual items not done** (this is a headless agent box — still no human has seen any 3D / PDF / coupe):
  the **3D coupe drag-handle + elevation cutting-line overlay**, and **wiring the 6 remaining elements
  (E-COL-02/E-FND-01/E-SLB-01/02/03/E-STR-01) + the seismic regime picker into the SPA** (engine already drives
  them). These need a browser to verify — do them on the owner's GPU machine via `cd apps/web && npm run dev`.
- **a11y audit** (axe pass + keyboard focus-order walkthrough) and **docs** (user guide FR/EN, manifest-authoring
  guide, code-pack authoring guide) — not started (§11 DoD).
- **Canonical §10 `reinforcement[]` mapping** (D-P5-7) + **dedupe `rebarProps.buildScene` ↔ core `placeBars`**
  still open. Branch coverage (70%) could be lifted with targeted profile/pipeline branch tests if desired.
- **No git commit** (owner-gated, §7.6) — all P5-SPA + P6 changes are in the working tree on `feat/p1-m1-engine`.

**→ Next agent: continue P6.** Highest-value remaining, in order: (a) **on a GPU machine**, build the 3D coupe
drag-handle + cutting-line overlay and wire the 6 remaining elements + seismic picker into the SPA (the engine
+ manifests already exist; this is UI forms + 3D + `rebarProps` generalisation); (b) **a11y audit** + the i18n is
already gated; (c) **docs** (the three authoring/user guides); (d) lift **branch coverage** + the canonical §10
`reinforcement[]` mapping + `buildScene`↔`placeBars` dedupe; (e) **chase the engineer signatures** (release-
blocking). *Before starting: `git log`/diff to confirm nothing moved; `npm run check` + `npm run coverage` +
`npm run build:web` GREEN; then append your own §9 entry.*

### 2026-06-25 — P5 / M5 SPA WIRING complete → **Phase 5 FULLY DONE** (code; G-COUPE unsigned) — by **Amer** (owner's Windows PC)

**What I did (in detail).** Picked up where the P5-engine handoff left off (confirmed baseline GREEN —
`npm run check` 247/50 + `build:web` ✓ — before touching anything) and built **the SPA half of P5**: the
`@rebarconfig/exporters` package is now consumed by `apps/web`, so the on-site deliverables + project I/O are
driveable from the UI. Concretely:

1. **Package wired (D-P5-7).** Added `@rebarconfig/exporters` to `apps/web/package.json` + to vite
   `optimizeDeps.exclude` (raw-TS workspace, same as core/codepacks; pdf-lib pre-bundles normally). `npm
   install` already had it linked from the engine session.
2. **doc↔rcfg adapter + export actions** — `apps/web/src/engine/rcfgDoc.ts` (`docToRcfg`/`rcfgToDoc`,
   lossless via `meta.app_document` + faithful canonical §10 fields — D-P5-7) and `exportActions.ts`
   (`exportPdf`/`exportDxf`/`exportBbsJson`/`exportRcfg` + a jsdom-guarded `downloadBlob`).
3. **Store: section cuts + project I/O** — `useStore` now holds `cuts[]` (default coupe auto-managed at
   index 0) + `activeCutId` + `bottomPanel`; actions `addCut`/`removeCut`/`updateCut`/`selectCut`/
   `setBottomPanel`/`loadProject`. Every solve re-seeds the default coupe and preserves user cuts; element/
   scheme switches drop them.
4. **Navbar Export menu + Import** — a `<details>` dropdown (Plan PDF / Dessin DXF / Nomenclature JSON /
   Projet .rcfg), drawing items disabled on 🔴 (export-lock §7.9), BBS + `.rcfg` always enabled; a hidden
   file input imports a `.rcfg` (`parseRcfg → loadProject`). Two navbar toggles open the bottom dock.
5. **BBS table + Coupe manager panels** — `BbsPanel` renders `computeBBS(result)` (rows merged by shape+Ø+
   dims, steel summary, WARN review stamp); `CoupePanel` lists cuts, adds/places/removes them by numeric
   station + look-behind + label (keyboard parity), and shows a **live 2D SVG preview** of the selected
   `sectionAt(result, cut) → CoupeView` (bars as circles at their (u,v), tie outline as lines, `n Ø d`
   annotations). New `BottomPanel` docks them under the viewport; `App` mounts `useAutosave`.
6. **IndexedDB autosave/recovery** — `useAutosave` recovers on mount + debounce-saves every doc/cuts change.
7. **Tests (4 new web suites, +20 tests):** `coupe_store` (cuts CRUD + `.rcfg` round-trip + forward-compat),
   `export_actions` (BBS/DXF/PDF bytes + export-lock on FAIL + rcfg round-trip + headless download no-op),
   `coupe_manager` (default coupe preview + numeric placement + remove), `export_menu` (menu targets +
   PDF/DXF locked on FAIL + BBS panel render).

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {13/8/10/7} · core typecheck ✓ ·
web typecheck ✓ · **267 tests / 54 files** (+20 / +4). `npm run build:web` ✓ (**~2.19 MB** — pdf-lib now in the
SPA bundle; code-split = P6). `vite dev` unaffected (port 5180).

**Decisions:** D-P5-7 in §8. Load-bearing: SPA `.rcfg` round-trip via `meta.app_document` with the canonical
§10 reinforcement mapping deferred (D-P5-7), and the auto-managed default coupe at `cuts[0]`.

**Open / deliberately deferred (be honest):**
- **3D coupe drag-handle + the elevation cutting-line overlay in the LIVE 3D viewport are NOT built.** Numeric
  + keyboard placement (full a11y parity) + the 2D SVG preview ship; the 3D handle needs a GPU to verify, so
  it is a P6 visual item. **Still no human has seen any 3D / a generated PDF/DXF/coupe rendered** (headless box).
- **Canonical §10 `reinforcement.baseGroups[]` is empty** (the SPA reloads from `meta.app_document`) — a faithful
  `ReinforcingElement[]` mapping (so other tools/a future server can read the rebar without `app_document`) is
  P6 (D-P5-7).
- **Coupe orientation is perpendicular-only in the UI** (`origin.y` station); oblique/free orientation is
  engine-supported + persisted in `.rcfg`, just not exposed yet (P6).
- **Bundle ~2.19 MB** (pdf-lib + three.js) — code-splitting / lazy-loading the exporters is a P6 perf item.
- **G-COUPE UNSIGNED** (near-parallel threshold / look-behind / tag style, §14 items 14–17) — the coupe
  previews inherit those provisional conventions; **G-BAEL / G-EC2 / G-RPS** also still unsigned.
- **The SPA still exposes only E-COL-01 / E-BEM-01** (the 6 P4 elements + the seismic regime picker are still
  engine-only — a separate P4-polish/P6 UI task). The `rebarProps.buildScene` still duplicates core `placeBars`
  (dedupe = P6). **No git commit** (owner-gated, §7.6) — changes are in the working tree on `feat/p1-m1-engine`.

**→ Next agent: P6 / M6 (hardening, sign-off, release).** Phase 5 is fully closed (engine + SPA). The
highest-value P6 work, roughly in order: (a) the **3D coupe drag-handle + elevation cutting-line overlay** and
**wire the 6 remaining elements + the seismic regime picker** into the SPA (the engine already drives them);
(b) **≥90% core coverage** + the i18n missing-key + a11y audits (§11); (c) **code-split** the bundle (lazy
pdf-lib/three); (d) the canonical §10 `reinforcement[]` mapping (D-P5-7) + dedupe `buildScene`↔`placeBars`;
(e) chase the **G-BAEL / G-EC2 / G-RPS / G-COUPE / G-TOL** engineer signatures (the release-blocking people
dependency). *Before starting: `git log`/diff to confirm nothing moved; `npm run check` GREEN + `npm run
build:web`; then append your own §9 entry.*

### 2026-06-25 — P5 / M5 CODE-COMPLETE: BBS + DXF + PDF + `.rcfg` I/O (steps 2–6) — by **Amer** (owner's Windows PC)

**What I did (in detail).** Continued **Phase 5** on the owner's local Windows box (confirmed the P5-step-1
baseline GREEN — `npm run check` 209/41 + `build:web` ✓ — before touching anything). Implemented **plan P5
steps 2–6**: the three on-site export deliverables + project persistence, all consuming the step-1
Section/Coupe engine. Everything lives in a **new pure workspace package `@rebarconfig/exporters`** (D-P5-4),
golden-tested headlessly. Concretely:

1. **BBS engine (step 2, §9.1)** — `packages/exporters/src/bbs.ts`: `computeBBS(result)` → the §9.1 record
   (one line per *distinct* bar, identical shape+Ø+dims **merged**, stable Ø-ordered marks, `cutLength`/count/
   length/weight), steel-quantity **summary** (weight per Ø + ratio kg/m³ over the member envelope), and
   `unitMass(φ)=0.006165·φ²`. Optional **`nestCuts`** (FFD, default 12 m stock, waste %). Transverse counts
   reuse `transverseStations`; a continuous spiral counts as 1 bar (D-P5-5).
2. **DXF (step 3, §9.2)** — `dxf.ts`: a hand-rolled deterministic **R12 (AC1009)** writer (`DxfBuilder`) on the
   four strict layers; `buildDxf1` (elevation + default coupe = the release bar) and `buildDxfCoupes` (DXF-2:
   multiple/oblique coupes + per-coupe cutting-line/tag). Geometry written once in core (`placeBars` + `sectionAt`).
3. **PDF (step 4, §9.3)** — `pdf.ts` (pdf-lib): `buildPdf(result, meta?)` → cartouche + vector elevation + coupe
   view boxes + BBS table + **global status stamp**; **🔴 hard-locks export** (`export-lock.ts`:
   `ExportLockedError`/`canExport`/`assertExportable`). Deterministic when a `date` is supplied.
4. **`.rcfg` I/O (step 5, §10)** — `rcfg.ts`: `serializeRcfg`/`parseRcfg` (+`migrateRcfg`, `CURRENT_RCFG_VERSION
   ="1.0"`) preserving unknown fields/kinds/cut-fields; **`section_cuts[]`** persisted (D-P5-6) with
   `sectionCutsOrDefault` seeding the default coupe when absent; **IndexedDB autosave/recovery** via
   `AutosaveManager` over an injectable `KeyValueStore` (`memoryStore()` for tests, `indexedDbStore()` for the
   browser).
5. **WARN review stamp (step 6, §7.9/§7.12)** — `statusStamp` ("Conforme" / "À vérifier") on the PDF cartouche
   AND on the BBS fiche (`BarBendingSchedule.reviewRequired`/`status`).
6. **Tests (10 new core suites, all in `tests/`):** `bbs_golden`, `unit_mass`, `cut_nesting`, `dxf1_golden`,
   `dxf_coupe_golden`, `pdf_smoke`, `rcfg_roundtrip`, `coupe_persist`, `autosave_recovery` (+ the step-1
   `section_geometry`). Shared fixture `tests/bbs-helpers.ts` (the reference beam, solved through the pipeline).

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {13/8/10/7} · core typecheck ✓ ·
web typecheck ✓ · **247 tests / 50 files** (+38 / +9 vs P4b). `npm run build:web` ✓ (~1.72 MB; the SPA does NOT
import the exporters yet, so the bundle is unchanged). `npm install` added `pdf-lib` + linked the new workspace.

**Decisions:** D-P5-4…D-P5-6 in §8. Load-bearing: exporters as a separate pure package (D-P5-4), hand-rolled
deterministic DXF (D-P5-5), `.rcfg` forward-compat + `section_cuts` with no core-contract change + export lock
(D-P5-6).

**Open / deliberately deferred (be honest):**
- **SPA export buttons NOT wired.** The exporters are headless + fully tested, but `apps/web` does not yet
  import `@rebarconfig/exporters`; the Navbar **Export** button is still the P2 export-lock stub (D-P2-5). Wiring
  it (PDF/DXF/`.rcfg` download via a Blob/anchor, an on-screen BBS table, the **coupe-manager UI** — 3D drag
  handle + numeric field + keyboard parity + live preview) is the **P5 UI half** and the top follow-up. No human
  has seen a generated PDF/DXF/coupe rendered.
- **G-COUPE UNSIGNED** (near-parallel threshold / look-behind / tag style, §14 items 14–17), alongside the still-
  unsigned **G-BAEL / G-EC2 / G-RPS**. The export *visuals* inherit those provisional conventions.
- **Honest export limits:** DXF-2 label-collision solver is templated (deferred, §9.2). Slab-family coupes show
  distribution bars indicatively (D-P5-3). `nestCuts` assumes pieces ≤ stock (lapping out of v1.0 scope). The PDF
  cartouche fields (project/engineer) are the §14 placeholders. The SPA `rebarProps.buildScene` still duplicates
  the core `placeBars` (dedupe = P6).
- **No git commit** (owner-gated, §7.6) — changes are in the working tree on `feat/p1-m1-engine`.

**→ Next agent: P5 UI wiring → then P6.** P5 *engine* work is done (every export deliverable + `.rcfg` I/O is
pure, deterministic, golden-tested). The highest-value next step is the **SPA half of P5**: add
`@rebarconfig/exporters` to `apps/web` (+ `optimizeDeps.exclude`), wire the **Export** button to download the
PDF/DXF/`.rcfg`, render the **BBS table**, and build the **coupe-manager UI** (the §9.5 UI: add/name/place
multiple cuts via a 3D drag handle + numeric field + keyboard parity, seeded with `defaultCoupeFor`, live
preview + cutting-line on the elevation). Then **P6** (hardening, ≥90% core coverage, i18n/a11y, and the
**G-BAEL/G-EC2/G-RPS/G-COUPE** sign-offs). *Before starting: `git log`/diff to confirm nothing moved; `npm run
check` GREEN + `npm run build:web`; then append your own §9 entry.*

### 2026-06-24 — P5 / M5 STARTED: Section/Coupe engine (`sectionAt`) complete — by **Amer** (owner's Windows PC)

**What I did (in detail).** Picked up **Phase 5** on the owner's local Windows box (pulled Zayd's
`feat/p1-m1-engine` branch, confirmed the P4b baseline GREEN: `npm run check` 200/40 + `build:web` ✓
before touching anything). Implemented **plan P5 step 1 — the Section/Coupe engine** (`v1.0_imp_plan.md`
Phase 5; spec §9.5, [REF-SYS-950]), the explicitly **"build-first"** sub-project that the DXF and PDF
exporters consume. It is **pure core, deterministic, browser-safe** — the same `CoupeView` feeds the 3D
preview + DXF + PDF (written once). Concretely:

1. **`MemberPlacement` on `SolveResult` (D-P5-1).** Added the 3D placement descriptor to
   `types/layout.ts` and a **required** `member` field to `SolveResult`; populated it in all five
   orchestrators (`element`/`circular`/`slab`/`stair`/`joist` — `solveColumn` inherits via the shim).
   Unifies all 8 elements as axial prisms (slab-family → RECT envelope, bars along the span).
2. **Pure world placement** `section/place.ts` (`placeBars`) — reconstructs each bar's world centreline
   (longitudinal runs along +Y, transverse loops instanced at spacing, supplements centred) — the
   core-side twin of the SPA's `rebarProps.buildScene` (to be deduped in P6).
3. **`sectionAt` + types + conventions (D-P5-2).** `section/sectionAt.ts` (`sectionAt`, `defaultCoupeFor`),
   `section/types.ts` (`SectionCut`, `CoupeView` + sub-types, forward-compat index signature on
   `SectionCut`), `section/convention.ts` (provisional coupe conventions → **G-COUPE**). Concrete polygon
   via plane∩box / sampled cylinder; circle-vs-line by crossing angle; look-behind with the "nearest
   transverse set" guarantee; `n Ø d` annotations; templated dims; elevation cutting-line/tag. Exported
   from the core barrel (`section/index.ts`).
4. **Tests:** new `tests/section_geometry.spec.ts` (9 tests) — perpendicular column coupe (300×600 rect +
   6 Ø20 circles at the exact (u,v) + tie outline + `n Ø d`), oblique cut (convex polygon + projected
   centres), near-parallel → lines, look-behind nearest-set, determinism, circular-column coverage.

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {13/8/10/7} · core typecheck
✓ · web typecheck ✓ (the new required `member` field didn't break the SPA) · **209 tests / 41 files**
(+9). `npm run build:web` ✓ (~1.72 MB; the section engine is browser-safe — it has to be, it feeds the 3D
preview). `vite dev` unaffected (port 5180).

**Decisions:** D-P5-1…D-P5-3 in §8. Load-bearing: world placement moved into core as `SolveResult.member`
(D-P5-1), `sectionAt` as pure plane∩geometry with provisional convention data (D-P5-2).

**Open / deliberately deferred (be honest):**
- **P5 steps 2–6 NOT started:** BBS (§9.1), DXF-1/DXF-2 (§9.2), PDF sheet + status stamp (§9.3), `.rcfg`
  I/O + IndexedDB autosave (§10), WARN→"À vérifier" stamp (§7.9). The coupe engine (step 1) is the
  prerequisite for DXF/PDF and is done.
- **Coupe UI not built:** `sectionAt` is headless. The coupe manager (3D drag handle + numeric field +
  keyboard/index parity, live preview, cutting-line on the elevation) is the UI half of §9.5 — not yet
  wired. No human has seen a coupe rendered (headless + the SPA still only exposes E-COL-01/E-BEM-01).
- **G-COUPE UNSIGNED** — near-parallel threshold, default look-behind, tag/cutting-line style are
  provisional (§14 items 14–17), alongside the still-unsigned **G-BAEL / G-EC2 / G-RPS**.
- **Slab-family coupes are representative** (distribution bars along the span; D-P5-3); oblique circular
  cuts are sampled ellipses. The SPA `rebarProps.buildScene` still exists in parallel with the new core
  `placeBars` (dedupe = P6).
- **No git commit** (owner-gated, §7.6) — changes are in the working tree on `feat/p1-m1-engine`, ready
  to push when the owner asks.

**→ Next agent: P5 / M5 steps 2–6.** The coupe engine is ready to consume. Suggested order matching the
plan: **BBS** first (§9.1 — from each group's `cutLength`/count/Ø, already emitted by the engine; add
`unitMass(φ)=0.006165·φ²`, auto-marks, identical-bar merge, steel-quantity summary, optional 12 m
cut-nesting) since it needs no new geometry; then **DXF-1** (elevation `fiche` 2D projection + the default
`CoupeView`, four strict layers `COFFRAGE/ARMATURES/COTATION/TEXTE`) — the release bar; then **PDF** (cartouche
+ vector views + BBS + global status stamp, **🔴 hard-locks export** per §7.9); then **`.rcfg` I/O**
(save/load + IndexedDB autosave; **persist `section_cuts[]`**; preserve unknown fields/kinds/cut-fields —
D-P0-2 already tested). Golden tests per plan §11: `bbs_golden`, `unit_mass`, `cut_nesting`, `dxf1_golden`,
`dxf_coupe_golden`, `pdf_smoke`, `coupe_persist`, `rcfg_roundtrip`, `autosave_recovery`. *Before starting:
`git log`/diff to confirm nothing moved; `npm run check` GREEN + `npm run build:web`; then append your §9
entry.* Highest-value non-P5 follow-ups: wire the **coupe manager UI** + the 6 unwired elements into the
SPA, and chase the **G-BAEL/G-EC2/G-RPS/G-COUPE** signatures.

### 2026-06-24 — P4b / M4b complete → **Phase 4 DONE** (code; G-RPS unsigned) — by **Zayd** (dev box)

**What I did (in detail).** Implemented **the second half of Phase 4** per `v1.0_imp_plan.md` Phase 4b:
the two disproportionately-hard remaining geometries (**straight-flight stair `E-STR-01`**, **hollow-block
joist slab `E-SLB-03`**) and the **RPS-2011 seismic overlay** — the composable parasismic module that rides on
**either** BAEL or EC2. This closes the §3.1 element catalog: **all 8 elements now solve + validate headlessly.**

1. **Seismic overlay contract + RPS pack (D-P4b-1).** New frozen `SeismicOverlay` interface
   (`packages/core/src/types/seismic.ts`) — a second injectable contract parallel to `CodePack`. RPS impl:
   `packages/codepacks/src/seismic/` (`makeRpsOverlay(regime)` + `rps-2011.json`, all cells `"_provisional": true`,
   gate **G-RPS**). Re-exported from the codepacks barrel.
2. **Overlay validation + seismic/stair predicates (D-P4b-2/4).** `validation/seismic.ts` (`applySeismicOverlay`:
   END_*/MIDDLE segment injection per §5.1.1, per-segment critical-zone spacing, crit tie-ø, 135°/10φ hooks,
   `confinement_required`). `validation/predicates.ts` += `stairReentrantCornerPullout` (🔴/PASS),
   `lapInCriticalZone` (🔴 ND2/3 · 🟠 ND1), `crosstieEngagement` (🟠 ND2 · 🔴 ND3).
3. **Stair + joist pipelines + profiles (D-P4b-3).** `pipeline/stair.ts` (`solveStair`) + `pipeline/joist.ts`
   (`solveJoist`); profiles `STAIR` + `JOIST_SLAB` in `validation/profiles.ts` (reuse `slabZoneChecks` +
   `slabDistributionMin`; stair adds the re-entrant predicate via `StairContext`).
4. **Seismic wired into `solveElement`/`solveColumn` (D-P4b-2/5).** Optional `seismic` block; ties gained
   `hookAngle`/`hookExtFactor`; supplements gained `catalogId`; `SolveResult.seismic = {l_c, segments}`. No
   element branching; the gravity path is byte-identical (all 163 prior tests unchanged).
5. **Manifests (integrity-green {13/8/10/7}):** shape `marche_palier` (generic polyline — no new generator);
   elements `E-STR-01` + `E-SLB-03`; one scheme each (`STAIR_STD`, `JOIST_STD`).
6. **Tests:** 7 new core suites — `rps_segment_injection`, `seismic_hooks`, `lap_in_critical_zone`,
   `confinement_required`, `stair_reentrant`, `joist_slab`, `rps_reference` (⚠ G-RPS provisional).

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {13/8/10/7} · core typecheck ✓ ·
web typecheck ✓ · **200 tests / 40 files**. `npm run build:web` ✓ (~1.72 MB; new engine code browser-safe, no
`node:*`). `vite dev` unaffected (port 5180).

**Decisions:** D-P4b-1…D-P4b-5 in §8. Load-bearing: the seismic overlay as a second injectable contract
(D-P4b-1), overlay-composes-after-profile with no element branching (D-P4b-2), and stair/joist reusing the slab
per-metre seam (D-P4b-3).

**Open / deliberately deferred (be honest):**
- **G-RPS UNSIGNED** — every RPS cell (`l_c`, per-ND critical-zone spacing, min tie ø, required confinement,
  engagement, zone→a_g) is provisional; `rps_reference` is flagged. P4b *code* done; *acceptance* waits on the
  engineer (§6, §14.6). G-BAEL + G-EC2 also still unsigned.
- **Seismic edge facts are inputs, not yet UI-driven (D-P4b-5).** Hook angle/ext, bars-engaged, confinement-present,
  and lap extents are passed into the solve; the SPA does not yet collect them (no seismic regime picker wired).
  The headless engine + tests fully exercise the overlay.
- **New P4b elements are engine + manifests only — NOT in the SPA UI** (same as the P4a four). `apps/web/src/
  engine/manifests.ts` still imports only E-COL-01/E-BEM-01. Wiring the six new elements (forms + 3D + seismic
  picker) is a UI task for P4-polish/P6.
- **Stair/joist are slab-family/representative:** waist treated as a per-metre flat plate (slope geometry not
  modelled in 3D); joist bottom steel is smeared per-metre; topping mesh 3D is the panel outline (D-P4a-6). The
  re-entrant predicate is topological (not a 3D collision). Disclosed.
- **No human has seen stair/joist/seismic 3D** (headless box). No git commit (owner-gated, §7.6).

**→ Next agent: P5 / M5 (exports BBS/DXF/PDF + `.rcfg` I/O + Section/Coupe engine).** Phase 4 is fully closed:
every §3.1 element is solvable + validating, both packs swap as data, the RPS overlay composes on either. The
P5 prerequisites: build the **Section/Coupe engine first** (`sectionAt(solveResult, cut) → CoupeView`, pure core,
§9.5) since DXF/PDF consume it; then BBS (from each group's `cutLength`/count/Ø — already emitted), DXF (staged
DXF-1/DXF-2), PDF (export locked on 🔴, §7.9). `.rcfg` I/O must preserve unknown fields/kinds (D-P0-2, already
tested). *Before starting: `git log`/diff to confirm nothing moved; `npm run check` GREEN + `npm run build:web`;
then append your own §9 entry.* Highest-value gap-closing if you don't start P5: **wire the 6 new elements + the
seismic regime picker into the SPA**, and chase the **G-BAEL / G-EC2 / G-RPS** signatures (all three unsigned).

### 2026-06-24 — P4a / M4a complete (code; G-EC2 unsigned) — by **Zayd** (dev box)

**What I did (in detail).** Implemented **the first half of Phase 4** per `v1.0_imp_plan.md` Phase 4a:
the remaining "regular" geometries (circular column, drilled-shaft pile, 1-way + 2-way slabs), the two
bespoke geometry generators (helix + mesh), the **full second code pack (EC2)** behind the same `code.*`
names, and the slab topological predicates. Proves the data-driven thesis a second way: a new section/
element = new layout solver + a registered profile + manifests, and a new code = swap the pack only.

1. **EC2 code pack (D-P4a-4)** — `packages/codepacks/src/ec2/` (`makeEc2Pack` + `ec2-constants.json`,
   all cells `"_provisional": true`, gate **G-EC2**). Same `CodePack` interface + extras as BAEL; the
   barrel re-exports both packs (selective, to avoid the same-named `PackExtras` collision). Added
   `slabSpacingMax` + `distMinFraction` to **both** packs + core `CodePackExtras`.
2. **Shape registry seam + bespoke generators (D-P4a-1/6)** — `geometry/registry.ts` (`generateShape`
   dispatch), `geometry/bespoke/helix.ts` (`SPIRALE_HELICE`) + `mesh.ts` (`TREILLIS_MESH`). The whole
   pipeline now goes through `generateShape`.
3. **Circular + slab layout solvers (§6.1)** — `layout/circular.ts` (EQUAL_PERIMETER pitch circle,
   `s_arc`, min 6) + `layout/slab.ts` (per-metre provided steel, computed `d`, 1-D bar lines).
4. **New validation profiles + predicates (D-P4a-3/5)** — `CIRCULAR_COLUMN`, `SLAB_ONEWAY`, `SLAB_TWOWAY`
   in `validation/profiles.ts`; `validation/predicates.ts` (`slabDistributionMin` 🔴,
   `twowayCornerTorsionMissing` 🟠). `ProfileContext` extended (optional `section`/`circular`/`slab`); the
   P1/P3 rect path is byte-identical.
5. **Section pipelines (D-P4a-2)** — `pipeline/circular.ts` (`solveCircular`) + `pipeline/slab.ts`
   (`solveSlab`); both share the shape + profile registries. No element branching anywhere.
6. **Manifests (integrity-green {12/6/8/7}):** shapes `spirale_helice` + `treillis_mesh`; elements
   `E-COL-02`, `E-FND-01`, `E-SLB-01`, `E-SLB-02`; one scheme each.
7. **Tests:** 6 new core suites — `helix_geometry`, `mesh_geometry`, `circular_layout`, `ec2_reference`
   (⚠ G-EC2), `pack_swap`, `slab_rules`.

**State now: GREEN.** `npm run check` end-to-end ✓ — purity ✓ · manifests ✓ {12/6/8/7} · core typecheck ✓ ·
web typecheck ✓ · **163 tests / 33 files**. `npm run build:web` ✓ (~1.72 MB; new engine code is browser-safe,
no `node:*`). `vite dev` unaffected (port 5180).

**Decisions:** D-P4a-1…D-P4a-6 in §8. Load-bearing: the shape registry seam (D-P4a-1), section dispatch
without element branching (D-P4a-2), and pack-agnostic profiles proven by `pack_swap` (D-P4a-3/4).

**Open / deliberately deferred (be honest):**
- **G-EC2 UNSIGNED** — every EC2 number is provisional (mirrors G-BAEL). P4a *code* done; *acceptance* waits
  on the engineer (§6, §14). The `ec2_reference` suite is explicitly flagged provisional.
- **New elements are engine + manifests only — NOT wired into the SPA UI.** `apps/web/src/engine/
  manifests.ts` uses explicit imports (the new JSON is intentionally not imported there yet), so the SPA
  still exposes only E-COL-01/E-BEM-01. Wiring the catalog dropdown + per-element sidebar forms + 3D for
  circular/slab is a UI task (do it in P4b or a P6 polish pass). The headless engine + tests fully drive all
  six elements.
- **Slab model is per-metre/representative:** one representative strip, no two-way moment-field nuance; the
  TOP/CHAPEAU slab zone is supported by the profile but the test focuses on main/dist + corner-torsion.
  Mesh 3D render is the panel outline only (D-P4a-6). `EC2 α₁..α₆` coefficients default to 1.0 (disclosed),
  like BAEL.
- **Profile legacy naming:** `BAEL_COLUMN`/`BAEL_BEAM` keys are pack-agnostic despite the prefix (D-P4a-3) —
  not renamed to avoid churn. The §14.7-style numeric discrepancies (e.g. EC2 l_bd ≈ 40φ) are honest
  computed values pending G-EC2.
- **No git commit** (owner-gated, §7.6). No human has seen circular/slab 3D (headless box).

**→ Next agent: P4b / M4b (stair `E-STR-01` + joist slab `E-SLB-03` + RPS-2011 seismic overlay).** The seams
are ready: the stair `MARCHE_PALIER` is a planar polyline (generic generator) + a new profile + the
`stair_reentrant_corner_pullout` predicate; the joist slab is another section/profile. **RPS overlay**
composes onto either pack as keyed overrides (§7.10): inject `END_*` `l_c` segments into transverse
distribution, tighten limits per ND class, force 135°/10φ hooks, promote confinement supplements to required,
add `lap_in_critical_zone` + `crosstie_engagement` predicates. Gate **G-RPS** blocks the *phase close*; ship
provisional flagged. *Before starting: `git log`/diff to confirm nothing moved; `npm run check` GREEN +
`npm run build:web`; then append your own §9 entry.* Highest-value P4a follow-ups if you close gaps first:
**wire the four new elements into the SPA** and chase **G-EC2 / G-BAEL** signatures.

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
