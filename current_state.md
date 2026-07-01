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
| **P0–P4b / M0–M4b** — pure engine + 8 elements + segment-grammar + BAEL/EC2 packs + RPS seismic overlay (headless) | ✅ **DONE** (code) · ⏳ G-BAEL/EC2/RPS/TOL unsigned | Zayd, 2026-06-24 |
| **P5 / M5** — Section/Coupe engine + BBS + DXF + PDF + export-lock + `.rcfg` I/O + autosave + SPA wiring | ✅ **DONE** (code) · ⏳ G-COUPE unsigned | Amer/Zayd, 2026-06-25 |
| **P6 / M6** — hardening (coverage 95% · i18n · perf · code-split) + control fixes 8a/8b/8c + all 8 elements + seismic picker in the SPA | ✅ **CODE DONE** · ⏳ a11y axe · docs · sign-off pending | Zayd, 2026-06-25 |
| **P7** — multi-element project model (instances + takeoff + `.rcfg` v1.1 + migration) | ✅ **CORE DONE** (code) | Zayd, 2026-06-25 |
| **v1.0.1** — Feature C (namespaced BBS · combined PDF + per-project lock · DXF batch · elevation *fiche* · reorder) + A (ViewCube + persp/ortho + a11y views) + B (3D coupe handle) | ✅ **CODE DONE + tested + PUSHED** (`d27a950`) · ⏳ A/B GPU widgets need the owner's browser to verify (D-V101-1/2) | Amer, 2026-06-25 |
| **v1.0.2 P1 (F7)** — 2D section picker + face-relative bar labels + 3D bar pickability; Supplements rebound onto the picker | ✅ **CODE DONE + tested** (D-V102-1) · ⏳ owner GPU pass (3D click + picker feel) | Zayd, 2026-06-27 |
| **v1.0.2 P2 (F2)** — column/beam cross-ties rebuilt on real bar engagement (anchored épingles, Auto/presets, element-level hook angle, real `longBarsEngaged`, legacy migration) | ✅ **CODE DONE + tested** (D-V102-2) · ⏳ owner GPU pass · G-RPS | Zayd, 2026-06-27 |
| **v1.0.2 P3 (F3)** — sticky per-zone verification readout (pinned As,prov/As,req/d per zone + overall chip; pure `perZoneReadout` selector; all 8 elements) | ✅ **CODE DONE + tested** (D-V102-3) | Zayd, 2026-06-27 |
| **v1.0.2 P4 (F4)** — workspace re-layout: Verif+Project+BBS as one collapsible/expandable right column; Coupes stays in the bottom dock | ✅ **CODE DONE + tested** (D-V102-4) | Zayd, 2026-06-27 |
| **v1.0.2 P5 (F5)** — user transverse regions (per-region cadre spacing via the transverse-segment seam; 3D/coupe/BBS/fiche reflect them; seismic WARN-tightens end zones; legacy→1 region) | ✅ **CODE DONE + tested** (D-V102-5) · ⏳ owner GPU pass (region table feel) · G-RPS | Zayd, 2026-06-27 |
| **v1.0.2 P6 (F6)** — façonnage editor + shape catalog (Z/double-crank/stepped manifests + per-group shape/params/end-hooks → 3D/coupe/BBS/DXF; cutLength invariant guarded; legacy default) | ✅ **CODE DONE + tested** (D-V102-6) · ⏳ owner GPU pass (sketch feel) | Zayd, 2026-06-28 |
| **v1.0.2 P7 (F1)** — in-plane view roll (pure `rollUpVector`; session `rollRad` not in `.rcfg`; ↺/↻ buttons + roll slider; Home/named-view re-level) | ✅ **CODE DONE + tested** (D-V102-7) · ⏳ owner GPU pass (roll feel) | Zayd, 2026-06-28 |
| **v1.0.3 P1 (G1)** — true bar geometry: `placeBars` renders each longitudinal bar's real bent `centerline3D` (façonnage/cranks/relevés), the spiral as ONE member-length coil, the stair main bar along waist+landing; straight `DROITE` byte-identical | ✅ **CODE DONE + tested** (D-V103-1) · ⏳ owner GPU pass | Amer, 2026-06-30 |
| **v1.0.3 P2 (G6)** — stirrup cadence continuity across region boundaries (no short stub) + coupe section dims & cover on both faces (PDF now draws `view.dimensions`) + elevation region-length dims | ✅ **CODE DONE + tested** (D-V103-2) | Amer, 2026-06-30 |
| **v1.0.3 P3 (G5)** — cross-tie/épingle unification: ONE cross-tie model (épingle dropped from scheme catalogs), the épingle hook now rendered in the centreline (open shapes), legacy supplement-épingles migrate to `crossTies`, no centred épingle anywhere | ✅ **CODE DONE + tested** (D-V103-3) · ⏳ owner GPU pass | Zayd, 2026-06-30 |
| **v1.0.3 P4 (G2)** — addressable bars: per-bar overrides (shape/hooks/Ø/unique length+axial pos/remove), independent extra bars + section levels, façonnage editor targets a specific bar; flows to 3D/coupe/PDF/DXF + BBS via a pipeline `longBars[]` channel (gated on presence → legacy byte-identical) | ✅ **CODE DONE + tested** (D-V103-4) · ⏳ owner GPU pass · per-bar As is group-based (note) | Zayd, 2026-06-30 |
| **v1.0.3 P5 (G3)** — beam **two supports V1/V2** (asymmetric chapeaux + per-support anchorage + width, each a validated zone), **first-class relevés** (bent-up bottom bars via the G2 addressable channel — rendered + scheduled), **auto-seeded editable stirrup regions** from the supports; legacy single-`chapeau` beam migrates to symmetric V1=V2 | ✅ **CODE DONE + tested** (D-V103-5) · ⏳ owner GPU pass · G-BAEL · representative render note | Zayd, 2026-07-01 |
| **v1.0.3 P6 (G4)** — **lap splices / couplers**: pure `spliceBar` (segments incl. `code.l0` overlap, cutLength invariant preserved) + `autoSplice` (stock-length), doc `splices?`/`autoSplice?` on column-long/beam-span, BBS schedules **segments + coupler tally**, `lap_stagger` WARN + seismic `lap_in_critical_zone`; legacy unspliced byte-identical | ✅ **CODE DONE + tested** (D-V103-6) · ⏳ owner GPU pass · G-BAEL/EC2 (provisional `l0`) | Zayd, 2026-07-01 |
| **v1.0.3 P7 (G7)** — **shop-drawing PDF/DXF**: a pure `shopDrawing()` annotation model (leader lines `mark·nØd·l=`, per-element sequential marks, coupe markers A-A, stirrup-zone `count×spacing` notation, support labels V1/V2) + a **bending table** (one row per distinct shape · sketch · Ø · cut · count/element · ×quantity total), shared by PDF + DXF; existing render goldens held (structural) | ✅ **CODE DONE + tested** (D-V103-7) · ⏳ owner GPU pass | Zayd, 2026-07-01 |

**Where things stand (2026-06-28).** The app is feature-complete through v1.0.1, **plus the first six v1.0.2
phases are now implemented (NOT yet pushed — awaiting the owner's "push")**: **P1/F7** (the 2D section picker +
face-relative bar labels + 3D bar pickability), **P2/F2** (column **and** beam cross-ties rebuilt on real bar
engagement — anchored épingles, Auto/presets, element-level hook angle, real seismic `longBarsEngaged`,
legacy-`nLegs` migration), **P3/F3** (the sticky per-zone verification readout; pure `perZoneReadout`; UI-only),
**P4/F4** (the workspace re-layout — Verification + Project + BBS as one collapsible/expandable **right column**;
Coupes in the bottom dock; layout-only), **P5/F5** (user-defined **transverse spacing regions** via the
transverse-segment seam — 3D/coupe/BBS/fiche reflect them; seismic WARN-tightens end zones; legacy → one uniform
region), and **P6/F6** (the **façonnage editor + shape catalog** — three new multi-bend shape manifests
(Z-bar/double-crank/stepped), and each longitudinal group can pick a shape + edit params + set start/end hooks
with a live 2D sketch + cutLength, flowing to 3D/coupe/BBS/DXF; the `cutLength` invariant is guarded; legacy →
DROITE default, byte-identical). The remaining one v1.0.2 feature (**F1 — in-plane view roll**) is specced +
planned but not coded. New agents: read `core_logic.md` (product) + `architecture_breakdown.md` (structure)
first, then `v1.0.2_impl_plan.md`. **All seven v1.0.2 features (F1–F7) are now code-complete.**

**v1.0.3 in progress (2026-06-30).** The first three v1.0.3 phases are now implemented (NOT pushed): **P1/G1**
(true bar geometry — `placeBars` renders every longitudinal bar's real bent `centerline3D`, the spiral as ONE
continuous coil, the stair main bar along the waist+landing; a straight `DROITE` is byte-identical so every
existing golden held — no re-baseline needed), **P2/G6** (stirrup cadence now continues across a region
boundary instead of resetting to `from`, so there's no short stub; the PDF coupe now draws section width/height +
enrobage **cover on both faces**, and the elevation gains per-region length dims), and **P3/G5** (ONE cross-tie
model — the épingle is dropped from the scheme catalogs and added only via the `CrossTieEditor`; its **hook now
renders** in the centreline (open shapes); legacy supplement-épingles migrate to `crossTies`; no centred épingle
anywhere), and **P4/G2** (addressable bars — per-bar overrides, independent extra bars + section levels, and a
per-bar façonnage editor; the pipeline emits an explicit `longBars[]` consumed by `placeBars` + the BBS, gated on
presence so legacy is byte-identical). See **D-V103-1/2/3/4**. **P5/G3 + P6/G4 now landed too** (2026-07-01):
**P5/G3** (the beam **two-support model** — V1/V2 with asymmetric chapeaux + per-support anchorage + width,
each a validated zone; **first-class relevés** as bent-up bottom bars riding the G2 addressable-bar channel so
they render bent + schedule; **auto-seeded editable stirrup regions** from the supports; a legacy single-`chapeau`
beam migrates to symmetric V1=V2) and **P6/G4** (**lap splices / couplers** — a pure `spliceBar` helper whose
segments carry the `code.l0` lap overlap and preserve the cutLength invariant, `autoSplice` at stock length, the
BBS scheduling segments + a coupler tally, a `lap_stagger` WARN, and the seismic `lap_in_critical_zone` fed by the
real lap extents). See **D-V103-5/6**. **P7/G7 now landed too** (2026-07-01): the exported PDF/DXF are proper
**shop drawings** — a pure `shopDrawing()` layer (built once over the fiche + BBS + `sectionAt`, shared by PDF
**and** DXF so they agree) emitting **per-bar leader lines** (`mark · nØd · l=`), **per-element sequential marks**
(the BBS ordinals, separate from the project `markPrefix`), **coupe markers** (A-A…), **stirrup-zone `count×spacing`
notation** per region, and **support labels V1/V2** (+ optional bearing width/anchorage), plus a **bar-bending
(façonnage) table** (one row per distinct scheduled shape: mark · centreline sketch · Ø · cut · count/element ·
**total = count × element quantity**). See **D-V103-7**. New agent: read `v1.0.3_spec.md` + `v1.0.3_impl_plan.md`;
the remaining phases are **P8 (G8 — 3D concrete edges + stepped stair)** + **P9 (G9 — camera roll/cube/pan)** —
both viewport-only (owner GPU-verified).

**Last green gate (v1.0.3 P1–P7, 2026-07-01):** `npm run check` ✓ — purity ✓, manifests ✓ (**16 shapes** / 8
elements / 10 schemes / 7 supplements), core+web typecheck ✓, **463 tests / 93 files** (+15/+2 over the P1–P6
baseline of 448/91); `npm run build:web` ✓ (13.2s); `npm run coverage` **93.88% stmts** (≥90% threshold; core-only
scope — the new P7 code lives in `packages/exporters`, outside the coverage include).
The standing engineer sign-offs (G-BAEL/EC2/RPS/COUPE/TOL) + the owner GPU/visual passes remain open (acceptance,
not code).
**The headless gate can't see WebGL** — the ViewCube/persp⇄ortho/coupe handle (v1.0.1) **and the new F7 3D bar
click + the live 2D section-picker feel + the anchored cross-tie 3D render (F2)** are code-complete but await a
visual pass on the owner's Windows GPU (`cd apps/web && npm run dev`, port 5180); their pure logic is
headless-tested (`bar_labels`, `section_picker`, `tie_legs_geometry` [F2 anchored/Asw/seismic/migration],
`epingle_hook_angle`).

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
6. **Work lives on branch `feat/p1-m1-engine`** (tracks `origin/feat/p1-m1-engine`), pushed through
   v1.0.1 + the v1.0.2 docs (latest `d0c66f1`). Per `cross_projects_policy.md` §10, **commit/push only
   when the owner asks.**

---


## 8. Key decisions ledger (don't re-litigate; one line each — full rationale is in git history + the specs)

**Standing invariants (the load-bearing ones — break these and the architecture breaks):**
- **D-P0-2** `.rcfg` forward-compat via JSON-Schema if/then: unknown `kind`s + unknown fields are preserved on round-trip. **Never tighten to reject unknown kinds.** Every later persisted field (section_cuts, project elements[], v1.0.2 cross-ties/regions/shapes) rides this.
- **D-P1-1** `cutLength = Σ schedule legs + Σ hookExt − Σ bendDeduction` (NOT the polyline sum / rounded centreline); the generator cross-checks vs `totalLengthExpr` and **throws on disagreement**. Don't "simplify" it (v1.0.2 F6 must keep this).
- **D-P1-3** code pack is dependency-injected; **`packages/core` never imports `@rebarconfig/codepacks`**. PackExtras read through an optional `CodePackExtras` surface.
- **D-P1-5** effective depth `d`/`d'` is a first-class per-zone output (`computeZoneGeometry`), area-weighted from real bar centroids — never `0.9h`.
- **D-P3-1 / D-P4a-2** one generic `solveElement` + a validation-profile registry; section dispatch (rect/circular/slab) + profile id, **never `if (elementType===…)`** in core. `solveColumn`/circular/slab/stair/joist are thin shims.
- **D-P3-4** supplements/cross-ties bind by **STABLE bar indices, never coordinates** (`nearestBarIndex` backs both 3D-click and keyboard); a base change re-solves them.
- **D-P4a-1** the shape registry is the single geometry seam; only `SPIRALE_HELICE` + `TREILLIS_MESH` are bespoke; everything calls `generateShape`. New shape = new manifest, no pipeline change.
- **D-P4b-1** the seismic overlay is a SECOND injectable contract (`SeismicOverlay`), parallel to `CodePack`; `makeRpsOverlay` rides on either base pack. **Don't fold seismic constants into the base packs.** Constants provisional → G-RPS.
- **D-P5-1** world placement is a first-class core output (`SolveResult.member` = axial prism); `placeBars` is the single source for 3D + coupes + the fiche.
- **D-P5-4** the export engines are a separate pure package `@rebarconfig/exporters` (only `pdf.ts` pulls pdf-lib, lazy; `rcfg.ts` touches IndexedDB behind an injected `KeyValueStore`). Keep core lean.

**Shipped-phase decisions (terse; superseded notes inline):**
- **D-P0-1/3/4/5** distribution-mode vs placement-principle split · `isBarGroup` guard · `code.*` arg shapes (goodBond/asReqOverProv/d/NEd/fire) · archetype expr symbols ∈ params ∪ math ∪ ENGINE_GLOBALS (extend in `integrity/index.ts` only).
- **D-P1-2** `code.bendDeduction` is a provisional geometric model (→ G-BAEL); `l_s` computes ≈44φ vs tabulated 40φ — a flagged gap.
- **D-P2-1** integrity gate is a Node-only subpath `@rebarconfig/core/integrity`; the runtime barrel stays browser-pure. **D-P2-2** no `dist` build of core — Vite transpiles raw TS. **D-P2-3** the SPA is a dumb renderer; `rebarProps` is a pure mapper. **D-P2-4** the store always re-solves on commit; `dragMode` only degrades render + defers alerts. **D-P2-5** superseded (all 8 elements now wired, D-P6-3).
- **D-P3-2** beam = one representative cross-section (span-bottom / top-support / shear); left/right support split deferred. **D-P3-3** `computeCurtailment` feeds chapeau cutLength. **D-P3-5** UI = `ElementDoc`, two-pass supplement solve, scheme switch preserves geometry/material/cover/exposure. **D-P3-6** supplement 3D placement was centred-for-presence — **expanded by v1.0.2 F2/F7 (anchored at the engaged bars)**.
- **D-P4a-3** profiles pack-agnostic (`BAEL_` prefix is legacy naming); families CIRCULAR_COLUMN / SLAB_ONEWAY / SLAB_TWOWAY. **D-P4a-4** EC2 pack behind the same `code.*` names (G-EC2). **D-P4a-5** slabs per-metre + spacing-driven; topological predicates pure. **D-P4a-6** helix/mesh closed-form; 3D mesh render indicative.
- **D-P4b-2** overlay composes AFTER the base profile in `solveElement`; seismic segments (END/MIDDLE) are DATA, column/beam only. **D-P4b-3** stair + joist are slab-family sections. **D-P4b-4** `MARCHE_PALIER` is a generic polyline; re-entrant-corner risk is a predicate. **D-P4b-5** hook/lap/engagement facts are overlay INPUTS; `longBarsEngaged` was a placeholder — **made real by v1.0.2 F2**.
- **D-P5-2** `sectionAt` is pure plane∩geometry; coupe conventions provisional (G-COUPE). **D-P5-3** coupe exact for axial members, representative for slab-family. **D-P5-5** DXF is a hand-rolled deterministic R12 writer on the 4 strict layers. **D-P5-6** `.rcfg` forward-compat + `section_cuts[]` need no core-contract change; export lock on 🔴 FAIL. **D-P5-7** SPA `.rcfg` round-trips via `meta.app_document`; canonical §10 `reinforcement[]` mapping deferred.
- **D-P6-1** 3 control defects fixed (8a column symmetry selector · 8b beam full-length top bars · 8c brins auto-draw — **8c's centred cross-tie is the bug v1.0.2 F2 replaces**). **D-P6-2** ViewCube specced → shipped (D-V101-2). **D-P6-3** all 8 elements + seismic picker wired into the SPA; the viewport consumes core `placeBars`/`member` (RECT box / CIRCULAR cylinder).
- **D-P7-1/2/3** multi-element project model: `Project` = ordered `ElementInstance[]` with a checkout model, `quantity` scales TOTALS only (one solve per type), quantity-aware steel takeoff, `.rcfg` v1.1 envelope + legacy-1.0→1-instance migration; elevation *fiche* specced → shipped.
- **D-V101-1** v1.0.1 Feature C is pure exporter/UI: `computeBBS markPrefix` (namespaced); shared `exporters/fiche.ts` (orientation + marks + tie callout + dims) drives PDF **and** DXF; `buildProjectPdf` = sheet-per-type + summary + per-project export-lock; `exportProject{Pdf,Dxf,BbsJson}` + Navbar "Projet complet"; `moveInstance` reorder. Project-level shared settings deferred.
- **D-V101-2** v1.0.1 Features A/B are camera/interaction only — NO engine/`.rcfg`/validation change. `viewport/cameraState.ts` (26 named views + element-aware member rotation), `ViewCube.tsx` (drei gizmo + persp⇄ortho + Home + a11y named-view list), `coupeHandle.ts` + `CoupeOverlay.tsx` (drei `DragControls` handle → `updateCut`). View/roll state is **session-only, not in `.rcfg`**. Filename note: widget is `CoupeOverlay.tsx`, pure helpers `coupeHandle.ts` (case clash on Windows). **GPU widgets need the owner's visual pass.**
- **D-V102** v1.0.2 specced + planned: F1 in-plane view roll · F2 column cross-ties rebuilt on real bar engagement (+ Auto-code, real `longBarsEngaged`) · F3 sticky per-zone readout · F4 expandable right-column layout (Verif+Project+BBS) · F5 user transverse regions (per-region spacing) · F6 façonnage editor (catalog + params + end-hooks + Z/double-crank/stepped) · F7 2D section picker (replaces raw index binding). Build order **F7→F2→F3→F4→F5→F6→F1**. F2+F5 add core capability via existing seams (placement anchor; transverse segments) — no element branching. No new sign-off gate (F2-Auto/F5-seismic ride G-RPS). Owner decisions in `v1.0.2-Spec.md`; phases/tests/DoD in `v1.0.2_impl_plan.md`. **P1(F7)+P2(F2) now implemented — see D-V102-1/2.**
- **D-V102-1** (P1/F7 — 2D section picker, implemented) Bindings are still **stable bar indices** (D-P3-4); F7 adds only the missing UI. Pure `engine/barLabels.ts` labels each bar **face-relative** `T1/B2/L1/R3` (owner choice: TOP/BOTTOM ranked left→right by `u`, LEFT/RIGHT bottom→top by `v`). `ui/SectionPicker.tsx` draws SVG dots (+ a keyboard/a11y button list — both call the same `onPick`); `ui/useBarLink.ts` keeps the pending first-pick **local** to each editor (so the supplement picker and the cross-tie picker never cross-fire) while mirroring it to the store's new `selectedBars` for the 3D highlight. `PlacedBar.barIndex` (new, core) + `buildScene(..., selectedBars)` give **per-bar** 3D highlight; `Rebar` longitudinal meshes take an `onPick` (pointer addition — GPU-verified). `SupplementsPanel` dropped the `bar1/bar2` number inputs for the picker (rebind now re-binds to the 2 selected bars). Tests: `bar_labels`, `section_picker`; `binding_keyboard`/`leg_count_asw` (core, unchanged) stay green.
- **D-V102-2** (P2/F2 — cross-ties rebuilt, implemented) The broken `nLegs`/`crossTieZones` (épingles centred at the section centre) is **replaced**. A column tie / beam stirrup now carries `crossTies: {barA,barB,diameter?}[]` + an **element-level `crossTieHookAngle`** (owner choice: user types/picks one angle 90/135/180, applied to ALL the element's cross-ties). **Core seam, no element branching:** `MemberPlacement.transverse[]` + `ElementTransInput` gained an optional `anchor {u,v,angleDeg}`; `placeLoop`/`placeBars` rotate+translate an anchored loop to the bar-pair midpoint (non-anchored groups byte-identical → goldens safe). The adapter (`solveDoc`, web — `isColumnDoc?tie:stirrup` lives HERE not in core) builds one anchored épingle per cross-tie via `resolveBarPairPlacement` (now returns `angleDeg`), recomputes **Asw leg count = 2 + 2·nCrossTies**, and feeds the **real `longBarsEngaged`** (4 corners + distinct engaged bars; no-cross-tie case = 4). The épingle **hook angle is param-driven**: the generator applies an optional `params.hook_angle` override (additive; `epingle.json` gained a `hook_angle` param) keeping the `cutLength`/`totalLengthExpr` cross-check (D-P1-1). **Auto (code)** = engage **every intermediate bar** (owner choice) via pure `engine/crossTies.ts autoCrossTies`; per-direction presets filter by orientation. **Seismic engagement is WARN-only, never blocks export** (owner: "indicate but don't block" — `crosstieEngagement` ND3 changed FAIL→WARN; rides provisional **G-RPS**). **Legacy `nLegs` migrates** to `(nLegs−2)/2` auto-engaged cross-ties in `migrateDoc` (applied at the `rcfgToDoc` chokepoint → covers file-load + autosave-restore; idempotent; no data loss). Scope note: **supplement** épingles still render centred (presence-only) — anchoring them is a small D-P3-6 follow-up; F7 only changed how they're *bound*. Tests: `tie_legs_geometry` (anchored-not-centred + Asw + seismic-engaged + migration), `epingle_hook_angle`, updated `confinement_required`.
- **D-V102-7** (P7/F1 — in-plane view roll, implemented) **Camera/interaction-only, no engine/`.rcfg` change** (spec §1.3, approach a). Pure headless helper `viewport/cameraState.ts rollUpVector(viewDir, rollRad) → Vec3`: the level up = world-up projected ⟂ the view axis (Z-fallback when near-vertical), rotated about the view axis by `rollRad` (Rodrigues). Store gained session `rollRad` + `setRoll`/`rollBy` (**NOT** in `.rcfg`, like `projection`/`viewRequest`); **`requestView`/`homeView` re-level it to 0** (roll is a temporary tweak on top of an orientation), and `reset()` clears it. `viewport/Viewport.tsx RollController` (a `useFrame` at priority 1, i.e. AFTER drei OrbitControls' update) post-multiplies the rolled `camera.up` + re-`lookAt(target)` when `rollRad≠0`, and restores world-up **once** when the roll clears — orbit (X/Y) + zoom untouched. UI (`ViewCube.tsx ViewControls`, the HTML overlay = a11y/keyboard path): **↺/↻ buttons (±90°, Shift = fine ±5°)** + a **roll slider** (−180..180°). The drei curved drag-ring around the gizmo is deferred GPU polish; the buttons+slider are the testable/keyboard equivalents. Tests: `view_roll.spec` (pure `rollUpVector` 0/90°/360°/near-vertical + RTL buttons→`rollRad`, Shift fine-step, Home/named-view re-level). GPU feel verified on the owner's machine.
- **D-V102-6** (P6/F6 — façonnage editor + shape catalog, implemented) **Data-driven, minimal core change** (spec §6). Three new **shape manifests** (`zbar`/`double_crank`/`stepped`, registered in `SHAPES`) — pure segment-grammar, pass the integrity gate, 16 shapes total. Each **longitudinal group** gains an optional `faconnage {shapeParams?, hooks?}` (column `longitudinal` + beam `span` wired; chapeau/montage/generic are a follow-up); `solveDoc` passes the user `shapeParams` (else the computed default) + maps `hooks` to the generator → flows to 3D/coupe/BBS/DXF/PDF unchanged (the engine already accepts any shape+params). **Hooks independent of base shape:** `generateBarShape`/`generateShape` gained an optional `opts.hooks` (per-end `UserHook` = `"none" | {angle:90|135|180, extFactor?}`) that OVERRIDES the manifest `endHooks`; absent → byte-identical to pre-F6. To let any open shape accept user hooks, the open longitudinal manifests' `totalLengthExpr` were migrated to the hook-agnostic `… + hookAllowances − bendDeductions` form — **byte-identical** when no user hooks (verified: all BBS/DXF/fiche/unit-mass goldens green). **cutLength invariant (D-P1-1) guarded:** the generator's `totalLengthExpr` cross-check throws on an impossible shape; `ui/FaconnageEditor.tsx` catches it (and rejects a non-positive/non-finite cutLength), shows a clear error, and **never commits invalid params** (a local edit buffer keeps the field; the store/solve only ever sees a valid shape). The editor: a catalog `<select>` (DROITE/CROCHET_L/U_BAR/BAIONNETTE/RELEVE/ATTENTE/Z_BAR/DOUBLE_CRANK/STEPPED), param `NumberField`s seeded from geometry, start/end hook selects, a live SVG centreline sketch + cutLength. `.rcfg` round-trips for free (`faconnage` rides `meta.app_document`; legacy → DROITE default). **Deferred (spec §6.6):** lap-splice/coupler scheduling between elements. Tests: `tests/facade_shapes` (3 manifests valid + cutLength==totalLengthExpr + hook override), `apps/web/.../faconnage` (adapter + hooks + legacy byte-identical + rcfg), `ui/faconnage_editor` (RTL pick/edit/hook/sketch + invalid rejected).
- **D-V102-5** (P5/F5 — user transverse regions, implemented) Added via the **transverse-segment seam, no element branching** (spec §5.3). New core type `TransverseRegion {from,to,spacing}`; `ElementTransInput`, `MemberPlacement.transverse[]` and `solveColumn`'s tie gained an optional `regions?`. Pure `regionStations(regions, length)` (place.ts) emits stations region-by-region with the global end margins, **de-duping shared boundaries**; a single full-length region **delegates to `transverseStations` → byte-identical** (goldens safe). `regionStationCounts` gives per-region totals. `placeBars` instances loops per region; **BBS** `groupCount` sums region stations; the **elevation fiche** emits one `Ø e=spacing` callout per region (uniform set unchanged); **coupe snap stations** (`coupeHandle`) are region-aware. **Seismic reconciliation is WARN-only** (`region_crit_spacing:{zone}` in `applySeismicOverlay`): a user region overlapping an end critical zone but looser than `s_crit` warns — it **tightens/indicates, never silently overrides**, never blocks export (rides provisional **G-RPS**, consistent with F2's "indicate but don't block"); absent regions → no item (existing seismic goldens untouched). Web: `document.ts` adds `regions?` to `tie`/`stirrup`/generic transverse `ZoneEdit`; `solveDoc` threads them onto the cadre **and the cross-tie épingles** (they densify together); pure `engine/regions.ts` (`normalizeRegions` contiguity auto-fill over 0..L, `symmetricEndsRegions` quick-fill, `uniformRegions`, `memberAxisLength`); `ui/RegionEditor.tsx` (a contiguous from→to+spacing table with add/remove, a uniform reset, and a symmetric-ends quick-fill seeded from the seismic `l_c`) wired under the column tie + beam stirrup controls. **`.rcfg` round-trips for free** (regions ride `meta.app_document`; legacy files have none → uniform). **Scope:** the Asw/clear-spacing checks still use the representative `tz.spacing` (per-region Asw verification deferred); boundary **drag** on the elevation is deferred — numeric table is the a11y baseline (owner GPU follow-up). Tests: `tests/transverse_regions` (stations/counts, placement, BBS totals, fiche callouts, seismic WARN), `apps/web/.../transverse_regions` (helpers + adapter + legacy byte-identical + rcfg round-trip), `ui/region_editor` (RTL). Kept `rps_segment_injection`, `bbs_golden`, `elevation_fiche` green.
- **D-V102-4** (P4/F4 — workspace re-layout, implemented) **UI/layout-only, no engine/`.rcfg` change** (spec §4.3). The right strip (was a single always-on `AlertsPanel`) is replaced by `ui/RightColumn.tsx` — a flex column stacking **three collapsible, independently-scrollable sections**: **Verification** (`AlertsPanel`), **Project** (`ProjectPanel`), **BBS** (`BbsPanel`). Each section has a header button (caret, `aria-expanded`) toggling its body; the **same** open/collapse state is driven from the navbar (the BBS/Project/Vérifications buttons now call `toggleRightPanel`, not the old bottom-dock toggle). New store state: `rightPanels {verification,project,bbs}` (default `verification:true`, others collapsed — preserves "checks always visible") + `expandPanels` (an **Expand** toggle that widens the column to 60% over the 3D via the `.right-column.expanded` class; the 3D stays mounted, just narrower). **The bottom dock now hosts only Coupes** (`BottomPanel` → `CoupePanel`; `bottomPanel` narrowed `"coupes"|"bbs"|"project"|null` → `"coupes"|null`). `AlertsPanel` lost its own `.alerts-head` chrome (the section header supplies the title; the deferred "… recalcul" badge moved into the body). Layout prefs are **session-only** (not reset on element `reset()`, not in `.rcfg`). New i18n `workspace {expand,collapse,expandHint}` (note: `layout` was already taken by the layout-principle group). Tests: `workspace_layout` (3 sections render + collapse, expand sets flag/class, Coupes-only bottom dock); `export_menu`/`smoke` kept green (the latter renders `AlertsPanel` standalone — its header-less refactor is transparent to it).
- **D-V103-1** (P1/G1 — true bar geometry, implemented) `placeBars` (core, `section/place.ts`) no longer draws longitudinal bars as straight 2-point axis lines. **Longitudinal:** each bar now renders the group's real bent `centerline3D` oriented onto the member frame at the bar's `(u,v)` — convention `worldX = u`, `worldY = axisStart + localX`, `worldZ = v + localY` (the generator emits a flat `[localX, localY, 0, …]`; `localX` = run along u+, `localY` = lateral in v). **A straight `DROITE` is byte-identical** (`localY≡0`, `localX` 0..L) → **every existing render/BBS/fiche/DXF golden held, no re-baseline was needed** (the goldens are structural, not byte-snapshots). A bent shape (baïonnette/relevé/Z) now bends into the section **depth** plane (±Z). `axisStart` is plumbed (default 0) for G2 unique-length bars. **Continuous coil:** a transverse set whose shape carries `coilLength` (the bespoke helix) is detected via `isContinuousCoil` (mirrors `bbs.ts`) and placed **ONCE** as a single member-length helix (`placeCoil` maps the helix frame `[u, axis, w]` straight to world `[X,Y,Z]`, axis 0..length) — never instanced per station + flattened. **Stair:** the `MARCHE_PALIER` main bar rides the same longitudinal mapping automatically (flight→axis, landing bend→depth). A short-polyline fallback keeps a straight run when a group has no centreline. The coupe engine + elevation fiche + PDF/DXF consume `placeBars`, so true geometry flows everywhere for free. Tests: `tests/{true_geometry,coil_placement,stair_bars}.spec.ts` + `perf_heavy` extended with two `placeBars` perf cases (dense 120-turn helix + heavy column, both < 16 ms). **No core branching, purity held.**
- **D-V103-2** (P2/G6 — cadence continuity + coupe/elevation dims, implemented) **(a) Cadence continuity:** `regionStations` (core, `section/place.ts`) multi-region path now **carries the running station across a boundary** — a new region's first cadre is placed ONE new-spacing step past the previous region's last cadre, NOT reset to `region.from` (the `from` only marks where the new spacing takes over) — removing the illogical short stub (e.g. a 2 cm gap) at a boundary. The single-full-length-region path still delegates to `transverseStations` → **byte-identical** (goldens safe); `regionStationCounts` still partitions by containing region. **(b) Coupe dims (PDF):** `sectionAt` `buildDimensions` now emits **WIDTH + HEIGHT + an enrobage COVER on EACH face** (measured from the concrete face to the nearest bar centroid in that half, from the real section circles; falls back to the first zone's `d'` when the cut crosses no bars). `pdf.ts drawCoupe` now **renders `view.dimensions`** (it previously ignored them — the gap); the DXF coupe (`coupeToDxf`) already drew them, so PDF + DXF now agree. **(c) Elevation region dims:** `fiche.ts buildElevationFiche` adds one `FicheDim` per stirrup **region length** under the overall-length line (drawn by both `pdf.drawElevation` + `dxf.elevationToDxf`, which already iterate `fiche.dims`). Tests: `tests/{region_cadence,coupe_dims}.spec.ts`; existing `transverse_regions`/`elevation_fiche`/`dxf_coupe_golden`/`dxf1_golden`/`pdf_smoke` stayed green. **BBS/cutLength goldens unchanged** (rendering doesn't change cut lengths).
- **D-V103-4** (P4/G2 — addressable bars, section levels & per-bar façonnage, implemented) **Per-bar detailing via a pipeline `longBars[]` channel** (spec §2, [REF-SYS-530]). **Architecture (lowest-risk):** `ElementSolveInput` gained `longOverrides?`/`extraBars?`; `solveElement` emits a new `SolveResult.longBars[]` — an explicit per-bar list (each bar's own shape/Ø/axial start/removed + appended extra bars) — **only when overrides/extra bars exist** (else `undefined` → the grouped fast path, **byte-identical**, every golden held). `placeBars` (3D/coupe/PDF/DXF via the shared placement) and `computeBBS` (schedule) read `longBars` when present (skip longitudinal-role groups), so a façonné / unique-length / removed / independent bar appears everywhere + on the schedule. **The bar→group shape mapping mirrors `placeBars`** (zone match, else rect TOP/main); no `if(elementType)`. **G2a section levels** = an addressable bar at a chosen section depth `v` (incl. an intermediate U-bar level) — no separate level registry. **G2b overrides** + **G2c extra bars** are DATA on the doc (`barOverrides` on the column `longitudinal` / beam `span`; `extraBars` on the column/beam) → the adapter (`solveDoc.buildLongOverrides`/`buildExtraBars`) passes the FULL resolved shape+params (group default merged with the user edit + optional unique `L`). **G2d** `ui/AddressableBars.tsx`: a section picker selects ONE bar; the existing `FaconnageEditor` is reused for its shape/hooks, plus Ø/length/axial-pos/remove NumberFields, plus an independent-bars list (picker **and** numeric, a11y parity). New store actions `setBarOverrides`/`setExtraBars`. **`.rcfg` round-trips for free** (rides `meta.app_document`; additive; legacy → none). **Scope/limitation (engineer-gate, principle 7):** override/extra/removed bars are **detailing add-ons** — they change the render + schedule but **NOT the validation layout/As** (the count-group still drives the §7 checks); per-bar mixed-diameter As-weighting + per-bar `d` are a deferred refinement (not changed silently). `length` maps to the shape's `L` param (straight unique-length bars). Tests: `tests/{bar_overrides,independent_bars,section_levels}.spec.ts` (core: override/removed/unique-length/extra/levels + legacy `longBars` undefined), `apps/web/.../addressable_bars.spec.ts` (adapter + .rcfg + As-untouched), `ui/addressable_bars_ui.spec.tsx` (RTL pick→remove→extra). BBS/cutLength goldens unchanged.
- **D-V103-5** (P5/G3 — beam two-support model + relevés + auto-seeded regions, implemented) **Two supports V1/V2, data-driven, no core branch** (spec §3). `BeamDoc.chapeau{supportZone}` is **replaced** by `supports:{left,right}` where `SupportZone={chapeau{enabled,diameter,nTop,asReq,length},anchorage,width}` + `chapeauShapeId` + `releves?:ReleveZone[]`. The adapter (`beamInput`) emits **two chapeau longitudinal zones** `As_top_support_left/right`, each its own §7.7 `computeCurtailment(length)` → **asymmetric lengths are just data**, each independently validated (`provided_area`/`ratio_limits`/`clear_spacing` — the beam profile already iterates zones). **Representative section:** the layout TOP face carries `montage + max(nChapeauL,nChapeauR)` (the two supports never share a cross-section) — NOT the sum (which crammed 4 top bars into a 300 mm beam → clear-spacing FAIL). **Relevés ride the G2 `extraBars` channel** (a `RELEVE`-shaped bottom bar per `count`, `axisStart` near its support) so they **render bent (G1) + schedule** with their own cutLength, without touching the layout/As (detailing add-on). **`buildLongBars` fix (core, general):** the per-bar longBars enumeration now **distributes layout bars across the zones that share a face** (declaration order, by each zone's provided count) and **emits any under-seated zone** (the second support's chapeau, when relevés/overrides trigger the longBars path) as addressable bars — so both chapeaux always schedule; a single-zone face (column) is byte-identical. **Auto-seed:** pure `supportSeededRegions(L, leftZone, rightZone, spacing)` (dense ends ½·spacing, looser mid) + a store `seedStirrupRegions()` + a "Densifier aux appuis" button writes editable `stirrup.regions` — **solve path unchanged unless seeded** (goldens safe). **Legacy migration** (`migrateBeamSupports` at the `rcfgToDoc` chokepoint, BEFORE `beamLayoutBars` reads `supports`): a v1.0.2 `chapeau{supportZone}` → symmetric `left=right` + default anchorage 400/width 300 + no relevé; idempotent, lossless. UI: `SupportControls` (V1/V2) + `ReleveEditor` + the seed button in `Sidebar.BeamSchemeControls`. **Scope/limitation:** the second support's chapeau + the relevés render at a **representative axial position** (the precise per-support axial offset of the grouped-path chapeau is a rendering nicety, not a schedule/validation gap); the member-level `end_support_anchorage` check stays single (per-support anchorage is stored + drawn, G7). Tests: `apps/web/.../beam_supports.spec.ts` (asymmetric cutlengths + both validated, relevé bent+scheduled, region seeding densifies, legacy migration). Updated `element_catalog`/`beam_top_bars`/`per_zone_readout`/`beam_supplements` for the `As_top_support_left/right` zone split. **BBS/cutLength goldens unchanged.**
- **D-V103-6** (P6/G4 — lap splices / couplers, implemented) **Full lap/coupler scheduling** (spec §4). Pure core `geometry/splice.ts`: `spliceBar(run, splices[], code, {diameter,material,fractionLapped}) → {segments[], couplerCount, lapLength, totalCutLength}` — a **lap** extends the segment before it by `l_r = code.l0(...)`, a **coupler** adds no length but is counted; **the D-P1-1 accounting is preserved** (`Σ segment cuts = run + #laps·l_r`). `autoSplices(run, stock=12000)` splits an over-length run. Exported from `index.ts`. **Doc:** the column `longitudinal` + beam `span` groups gain `splices?:Splice[]` + `autoSplice?` (additive; absent → unspliced). **Pipeline:** `ElementLongInput` gains `splices?`/`autoSplice?`; `solveElement` splices each longitudinal group off its `shape.cutLength`, attaches `SolvedGroup.splice`, collects **lap extents** for the seismic overlay, and pushes a `lap_stagger:<zone>` **WARN** (group-level laps coincide → not staggered). **BBS:** a spliced group is scheduled as its **segments** (each × the group count) + a **`couplers` total** on the schedule; the seismic `lap_in_critical_zone` now fires off the real lap extents (FAIL under ND2/ND3 in `l_c`). **UI:** `Sidebar.SpliceEditor` (auto-split toggle + a station/kind list, picker AND numeric — a11y) on column + beam, riding the existing `setLongitudinal`/`setSpan` setters; `.rcfg` round-trips for free. **Scope:** splices are **group-level** (all bars of a group splice at the same station — hence the stagger WARN); per-bar splices via the addressable channel are a later refinement. Lap length rides the **provisional** BAEL/EC2 `code.l0` (G-BAEL/G-EC2). Tests: `apps/web/.../lap_splice.spec.ts` (spliceBar invariant + coupler + autoSplices; doc→schedule segments + coupler tally + stagger WARN; seismic lap-in-`l_c` FAIL; legacy unspliced byte-identical). **BBS/cutLength goldens unchanged** (no splices on the default docs).
- **D-V103-3** (P3/G5 — cross-tie / épingle unification + anchoring, implemented) **ONE cross-tie model** (spec §5). (a) **Catalog:** dropped `SUPP_EPINGLE_CROSSTIE` from the 4 scheme `supplementalCatalog`s — épingles are added only via the `CrossTieEditor` (F2); the supplement **manifest is kept** (core `resolveSupplement`/`placement_resolve`/`binding_keyboard`/`supplement_rebind` tests still load it; 7 supplements unchanged). (b) **Hook geometry (the D-V103-1 follow-up):** `generateBarShape` now appends/prepends the end-hook **return leg** to `centerline3D` for **OPEN** shapes (the join becomes a filleted bend), so the épingle crochet renders in 3D/coupe/PDF/DXF and reflects the resolved `hook_angle`; **CLOSED shapes (cadre/étrier) skip it** (welded loop, byte-identical), and the `cutLength`/`totalLengthExpr` cross-check is computed BEFORE the vertices are extended → **invariant untouched** (only `geomLength`/render change). A no-hook end (DROITE) is byte-identical. (c) **Anchored-only:** `placeBars` skips the centred-supplement fallback for `shape.archetypeId === "EPINGLE"` — épingles are *only* the anchored cross-tie on the bar-pair line (D-V102-2). (d) **Migration:** `migrateDoc` folds legacy `SUPP_EPINGLE_CROSSTIE` supplements into `crossTies` (dropped from `supplements`) at the `rcfgToDoc` chokepoint — idempotent, lossless, alongside the `nLegs` migration. Defaults already ship `crossTies:[]`. **Render goldens stayed green (structural, not byte-snapshots); BBS/cutLength unchanged.** Tests: `tests/epingle_anchored.spec.ts` (hook-in-centreline + anchored + no centred épingle), `tie_legs_geometry` (default-zero + supplement migration), `scheme_switch`/`beam_supplements` updated.
- **D-V103-7** (P7/G7 — shop-drawing PDF/DXF, implemented) **A pure `shopDrawing(result, opts) → {leaders, marks, coupeMarkers, stirrupZones, supportLabels, bendingTable}` annotation model** (`packages/exporters/src/shopDrawing.ts`, spec §7 [REF-SYS-930]) built ONCE over `buildElevationFiche` + `computeBBS` + `sectionAt` and **shared by PDF and DXF** so the two agree by construction. **Leaders:** one per distinct longitudinal group (aggregated from `placeBars`, mirroring the fiche marks), joined to its BBS line for the mark + cut length → `mark nØd l=cut` (e.g. `1 3Ø20 l=6000`), with a **basic anti-overlap** label column fanned along the member's drawing axis. **Sequential marks** = the BBS ordinals (bare `1,2,3…`; a project `markPrefix` still namespaces `P1-01`, §7.2 — both coexist). **Coupe markers** via `cuttingLineFiche` (default `defaultCoupeFor` + any user coupes → A-A/B-B on the elevation). **Stirrup-zone notation** `count×spacing` per region (uniform → `transverseStations`, regions → `regionStationCounts`, from G6). **Support labels V1/V2** derived from the presence of the G3 `As_top_support_left/right` chapeau zones on the result; bearing **width + bottom-bar anchorage** are optional drawing data supplied via `opts.supports` (NOT on the pure `SolveResult` — the beam-doc carries them, threaded through `PdfMetadata.supports`), so the labels emit regardless, annotated when supplied. **Bending table** = one row per distinct scheduled shape (= the BBS lines): mark · **2D centreline sketch** (from the source group's `shape.centerline3D`, flat `[x,y,0,…]`, looked up via the BBS `groupIds`, splice `#seg` suffix stripped) · Ø · cut length · **count/element** · **total = count × `opts.quantity`** (default 1; `buildProjectPdf` passes each type's fabrication quantity). **Wiring:** `pdf.ts` `drawElevation` now renders the shop overlay (leaders/coupe markers/zone notation/support labels, fit-bbox expanded over the annotation anchors) + a new `drawBendingTable` (with the mini sketch) below the BBS table; `dxf.ts` `shopDrawingToDxf` emits leaders (COTATION+TEXTE) + zone/support labels (TEXTE) + a `bendingTableToDxf` (TEXTE rows + ARMATURES **polyline** sketch — **no CIRCLE**, so the coupe-circle-count golden is untouched) into `buildDxf1`/`buildDxfCoupes` (coupe cutting-lines stay in `elevationToDxf`, not duplicated). **Purity held** (no DOM/three, no `if(elementType)` — support labels key off the zone name, data-driven); the render goldens are structural (4-layer/entity/regex checks) so **`dxf1_golden`/`dxf_coupe_golden`/`elevation_fiche`/`bbs_golden`/`pdf_smoke`/`project_pdf` all held — no re-baseline needed**; **BBS/cutLength goldens unchanged**. **Scope/limitation:** support width/anchorage need the caller to pass `opts.supports` (the web `exportActions` don't yet thread the beam doc's supports → a small follow-up; V1/V2 labels + positions render without it); the bending-table sketch is the group's centreline (spliced-segment rows fall back to no sketch). Tests: `tests/shop_drawing.spec.ts` (leaders `mark nØd l=`, sequential + prefixed marks, anti-overlap, coupe markers, uniform + per-region stirrup-zone notation, V1/V2 labels + width/anchorage, none for single-support, determinism), `tests/bending_table.spec.ts` (row-per-distinct-shape = BBS lines, count/element, ×quantity total, default quantity 1).
- **D-V102-3** (P3/F3 — sticky per-zone readout, implemented) **UI-only, no engine/`.rcfg`/validation change** (spec §3.3): the per-zone provided area + `ZoneGeometry.d` already exist on `SolveResult`. New pure selector `ui/derived.ts perZoneReadout(result, doc, lang) → ZoneReadoutRow[]` — **one row per flexural zone** (`As,prov` vs `As,req`, `ok`, `d`, `perMetre`), driven off the validation `provided_area[:zone]` items + `result.zones` (the column's lone un-suffixed `provided_area` maps onto `result.zones[0]`; slab zones flagged `perMetre` → cm²/m). **Generic over all 8 elements**, no `if(elementType)`. The old single-aggregate `Badges` is **replaced** by `ZoneReadout` (`position: sticky; top:0` inside the scrolling `.sidebar`, full-width via negative margins; `role="status" aria-live="polite"`; per-zone rows green/red + an overall 🟢/🟠/🔴 status chip from `result.status`). Zone labels: generic zones use the doc's own `label_fr/_en`; column/beam use a new `i18n readout.zones` map (`As_total`/`As_span_bottom`/`As_top_support`/`As_top_montage`). Old `derived.ts` helpers (`asProvidedMm2` etc.) kept (still used by `store_resolve.spec`). Tests: `per_zone_readout` (column/beam/slab rows + FAIL flip + per-metre); `smoke` updated (queries `.readout`, readout survives a tab switch).

---

## 9. Handoff log (newest first — APPEND your entry here before you stop)

### 2026-07-01 — v1.0.3 Phase 7 (G7 — shop-drawing PDF/DXF) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 7 (G7)** of `v1.0.3_impl_plan.md` (spec §7, [REF-SYS-930]), after reading
`cross_projects_policy.md` (one level up), `core_logic.md`, `v1.0.3_spec.md`, the plan, and this file; confirmed
the P1–P6 baseline GREEN first (`npm run check` = 448/91). Full detail in **D-V103-7**.

- **The exports are now real shop drawings.** A single pure `shopDrawing(result, opts)` layer
  (`packages/exporters/src/shopDrawing.ts`) — built once over `buildElevationFiche` + `computeBBS` + `sectionAt`
  and **shared by both the PDF and the DXF** so they agree — produces the full reference-drawing annotation set:
  **per-bar leader lines** `mark · nØd · l=` (basic anti-overlap), **per-element sequential marks** (BBS ordinals,
  separate from the project `markPrefix`), **coupe markers** (A-A/B-B), **stirrup-zone `count×spacing` notation**
  per region (from G6), **support labels V1/V2** (+ optional bearing width/anchorage), and a **bar-bending
  (façonnage) table** (one row per distinct scheduled shape: mark · 2D centreline **sketch** · Ø · cut · count per
  element · **total = count × element quantity**).
- **Wired into both exporters.** `pdf.ts` renders the shop overlay on the elevation (fit-bbox expanded over the
  annotation anchors) + a new façonnage table beside the BBS table; `dxf.ts` `shopDrawingToDxf` emits the leaders
  + zone/support labels + a bending table (TEXTE rows + an **ARMATURES polyline** sketch — no CIRCLE, so the
  coupe-circle golden is untouched). `buildPdf`/`buildProjectPdf` thread the fabrication `quantity` (per type) and
  an optional `PdfMetadata.supports` (bearing width/anchorage) through to the model.

**State now: GREEN, NOT pushed** (policy §10 — push only when the owner asks). `npm run check` ✓ (**463 tests /
93 files**, +15/+2 over the P1–P6 baseline), `npm run build:web` ✓ (13.2s), `npm run coverage` **93.88% stmts**
(≥90; core-only include — P7 code is in `packages/exporters`, outside the coverage scope). New files:
`packages/exporters/src/shopDrawing.ts`, `tests/{shop_drawing,bending_table}.spec.ts`. Touched exporters
`{index,pdf,dxf}.ts`. **No new `if(elementType)` (support labels key off the zone name, data-driven); engine purity
held (pure exporter, no DOM/three); `.rcfg` untouched; the structural render goldens held (no re-baseline);
BBS/cutLength goldens unchanged.**

**Open / not done (NONE block P7 code-completeness).** (a) **Owner GPU/visual pass** on the leadered elevation +
the façonnage table (headless can't see the rendered PDF/DXF; the pure model is headless-tested). (b) **Support
width/anchorage threading:** the V1/V2 labels + positions render off the result's chapeau zones, but the bearing
width + bottom-bar anchorage annotations need the caller to pass `opts.supports` — the web `engine/exportActions.ts`
don't yet forward the beam doc's `supports.{left,right}.{width,anchorage}` into `PdfMetadata.supports` (a small,
mechanical follow-up; the model + PDF/DXF plumbing already accept it). (c) The bending-table **sketch** is the
source group's centreline; a spliced-segment row falls back to no sketch (per-segment sketch is a later refinement).
(d) The remaining phases **P8 (G8 — 3D concrete edges + stepped stair) → P9 (G9 — camera roll/cube/pan)** are
unbuilt — both are **viewport-only** (`apps/web/src/viewport/Viewport.tsx`, owner GPU-verified per the plan).
**→ Next agent:** implement `v1.0.3_impl_plan.md` **Phase 8 (G8 — transparent concrete crisp edges + stepped stair
mesh)**, then **Phase 9 (G9 — kill the ViewCube auto-spin, on-demand roll + auto-level on orbit, toolbar hand-pan)**.
Before coding: `git log`/diff; `npm run check` + `build:web` GREEN; append a §9 entry.

### 2026-07-01 — v1.0.3 Phase 5 (G3 — beam two-support model + relevés) + Phase 6 (G4 — lap splices / couplers) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented the **next two v1.0.3 phases** (`v1.0.3_impl_plan.md` P5→P6), after reading
`cross_projects_policy.md`, `core_logic.md`, `v1.0.3_spec.md`, the plan, and this file; confirmed the P1–P4
baseline GREEN first (`npm run check` = 434/89). Full detail in **D-V103-5** (G3) and **D-V103-6** (G4).

- **P5 / G3 — beam two supports (V1/V2) + relevés + auto-seeded stirrup regions** (spec §3, [REF-SYS-260]). The
  beam's single collapsed `chapeau` became **two independent supports** (`supports:{left,right}` — each an own
  chapeau length/Ø/count + anchorage + width), so **asymmetric chapeaux** are validated + scheduled distinctly
  (`As_top_support_left/right`). **Relevés are first-class** (bent-up `RELEVE` bottom bars) via the **G2
  addressable-bar channel** so they render bent (G1) + schedule. **Defining supports auto-seeds editable stirrup
  regions** (dense ends). A legacy single-`chapeau` beam **migrates to symmetric V1=V2** at the `rcfgToDoc`
  chokepoint. The one general core change is in `buildLongBars`: it now **distributes section bars across the
  zones sharing a face** and **emits any under-seated zone** (the second support's chapeau) so both chapeaux
  always schedule — a column (single zone) stays byte-identical.
- **P6 / G4 — lap splices / couplers** (spec §4, [REF-SYS-770]). New pure core `spliceBar`
  (segments carry the `code.l0` lap overlap; the **cutLength invariant is preserved**) + `autoSplices` (stock
  length). Column-long / beam-span groups gain `splices?`/`autoSplice?`; the pipeline attaches `SolvedGroup.splice`
  + feeds lap extents to the seismic overlay; the **BBS schedules segments + a coupler tally**; a `lap_stagger`
  WARN fires (group-level laps coincide) and the seismic `lap_in_critical_zone` FAILs a lap inside `l_c`. A minimal
  `SpliceEditor` (auto toggle + station/kind list) wires it in the Sidebar.

**State now: GREEN, NOT pushed** (policy §10 — push only when the owner asks). `npm run check` ✓ (**448 tests /
91 files**, +14/+2 over the P1–P4 baseline), `npm run build:web` ✓ (12.8s), `npm run coverage` **93.88% stmts**
(≥90). New files: `packages/core/src/geometry/splice.ts`, `apps/web/src/engine/{beam_supports,lap_splice}.spec.ts`.
Touched core `pipeline/element.ts` (buildLongBars face-distribution + shortfall emission; splice plumbing; lap
extents + stagger WARN), `geometry/index.ts`; exporters `bbs.ts` (segments + `couplers`); web
`engine/{document,solveDoc,crossTies,regions,rcfgDoc}.ts`, `store/useStore.ts`, `ui/Sidebar.tsx`, `i18n/strings.ts`;
+ updated 4 existing beam tests for the `As_top_support_left/right` zone split. **No new `if(elementType)`; engine
purity held; `.rcfg` additive + legacy-migrated; BBS/cutLength goldens unchanged.**

**Open / not done (NONE block P5/P6 code-completeness).** (a) **Owner GPU/visual pass** on the two-support cage +
the relevés + the spliced-bar drawing. (b) **Representative-render notes** (documented, not gaps): the second
support's chapeau + the relevés render at a representative axial position; the member-level `end_support_anchorage`
check stays single (per-support anchorage is stored + will be **drawn in G7**). (c) **Group-level splices** (all
bars of a group splice at the same station → the stagger WARN); per-bar splices are a later refinement. (d) Lap
length + support anchorage ride the **provisional** BAEL/EC2 packs (**G-BAEL/G-EC2**). (e) Remaining phases **P7
(G7 — shop-drawing PDF/DXF) → P8 (G8 — 3D concrete/stair fidelity) → P9 (G9 — camera roll/cube/pan)** are unbuilt.
**→ Next agent:** implement `v1.0.3_impl_plan.md` **Phase 7 (G7 — shop-drawing PDF/DXF)** — it consumes P5's
supports (V1/V2 labels + widths + anchorage), P6's splice marks, P2's coupe/elevation dims and P4's bar marks into
a `shopDrawing()` annotation layer + a per-distinct-shape bending table, shared by PDF + DXF. Before coding:
`git log`/diff; `npm run check` + `build:web` GREEN; append a §9 entry.

### 2026-06-30 — v1.0.3 Phase 4 (G2 — addressable bars, section levels & per-bar façonnage) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 4 (G2)** of `v1.0.3_impl_plan.md` (spec §2, [REF-SYS-530]) — the largest v1.0.3
phase — after confirming the P3 baseline GREEN (`npm run check` = 419/84). Full detail in **D-V103-4**.

- **The bar model is now addressable.** Beyond "a group = N identical bars", a user can: shape **one** bar
  (its own shape + start/end hooks), give it a **unique length + axial position**, change its **Ø**, **remove**
  it, add **independent extra bars**, and place bars on an **intermediate section level** (a U-bar level at a
  chosen depth `v`). All of it renders in 3D/coupe/PDF/DXF **and** appears on the schedule.
- **Lowest-risk architecture.** The engine emits a new `SolveResult.longBars[]` (explicit per-bar geometry)
  **only when overrides/extra bars are present** — absent → the grouped fast path, **byte-identical** (every
  existing render/BBS/cutLength golden held; the gate proves it). `placeBars` + `computeBBS` consume `longBars`;
  the **validation layout/As is untouched** (overrides/extra bars are detailing add-ons — a deliberate
  engineer-gate scope choice, see the limitation in D-V103-4).
- **Adapter + doc + UI + .rcfg.** `barOverrides`/`extraBars` are additive doc data; `solveDoc` threads them into
  `longOverrides`/`extraBars`; `ui/AddressableBars.tsx` drives them (picker + numeric, a11y parity), reusing the
  F6 `FaconnageEditor` per-bar; `.rcfg` round-trips via `meta.app_document`.

**State now: GREEN, NOT pushed** (policy §10 — push only when the owner asks). `npm run check` ✓ (**434 tests /
89 files**, +15/+5 over the P3 baseline), `npm run build:web` ✓ (13s), `npm run coverage` **95.54% core** (≥90).
New: core `tests/{bar_overrides,independent_bars,section_levels}.spec.ts` (+ `g2-helpers.ts`); web
`engine/addressable_bars.spec.ts`, `ui/addressable_bars_ui.spec.tsx`, `ui/AddressableBars.tsx`. Touched core
`pipeline/element.ts` + `section/place.ts`, exporters `bbs.ts`, web `engine/{solveDoc,document}.ts`,
`store/useStore.ts`, `ui/Sidebar.tsx`. **No new `if(elementType)`; purity held; `.rcfg` additive; BBS/cutLength
goldens unchanged.**

**Open / not done (NONE block P4 code-completeness).** (a) **Owner GPU/visual pass** on the new per-bar
geometry + the editor feel. (b) **Per-bar validation/As is group-based** by design (principle 7 — engineer
gate): a removed/extra/per-Ø override changes the render + schedule but NOT the §7 As/`d` checks; per-bar
mixed-diameter As-weighting + per-bar `d` are a deferred refinement (do NOT change them silently — flag to the
engineer). (c) `length` override maps to the shape `L` param (straight unique-length bars); a non-DROITE
unique-length shape uses its own params. (d) Remaining phases **P5 (G3) → P6 (G4) → P7 (G7) → P8 (G8) → P9 (G9)**
unbuilt.
**→ Next agent:** implement `v1.0.3_impl_plan.md` **Phase 5 (G3 — beam two-support model V1/V2 + relevés +
auto-seeded editable stirrup regions)**. It depends on P4 (relevés/per-support chapeaux are addressable shaped
bars) + P2 (stirrup regions). Before coding: `git log`/diff; `npm run check` + `build:web` GREEN; append a §9 entry.

### 2026-06-30 — v1.0.3 Phase 3 (G5 — cross-tie / épingle unification + anchoring) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 3 (G5)** of `v1.0.3_impl_plan.md` (spec §5, [REF-SYS-756b]), after reading
`cross_projects_policy.md`, `core_logic.md`, `v1.0.3_spec.md`, the plan, and this file; confirmed the baseline
GREEN first (`npm run check` = 411/83). Full detail in **D-V103-3**.

- **One cross-tie model.** Épingles are now *only* cross-ties (the F2 model). Removed `SUPP_EPINGLE_CROSSTIE`
  from the four scheme catalogs that offered it (`col-ties-crosstie`, `col-ties`, `beam-span-simple`,
  `beam-span-chapeaux-releves`) — épingles are added solely via the `CrossTieEditor`. The supplement **manifest
  file is kept** (still loaded by the core `resolveSupplement` tests; counts unchanged at 7 supplements).
- **Hook visibility (the G1 follow-up flagged in D-V103-1).** The segment-grammar generator now renders end-hook
  geometry in `centerline3D` for **OPEN** shapes (a short return leg + the filleted bend), so an épingle's crochet
  is finally **visible** in 3D/coupe/PDF/DXF and reflects the `hook_angle`. **Closed shapes (cadre/étrier) and the
  `cutLength`/`totalLengthExpr` guard are untouched**; a no-hook end (DROITE etc.) is byte-identical.
- **Anchored-only placement.** `placeBars` skips the legacy centred-supplement fallback for any épingle-archetype
  group (`shape.archetypeId === "EPINGLE"`) — every épingle is the anchored cross-tie placed on the bar-pair line.
- **Legacy migration.** `migrateDoc` (at the `rcfgToDoc` chokepoint) now folds any `SUPP_EPINGLE_CROSSTIE`
  supplement into the tie/stirrup `crossTies` and drops it from `supplements` (idempotent, lossless), alongside
  the existing `nLegs` migration.

**State now: GREEN, NOT pushed** (policy §10 — push only when the owner asks). `npm run check` ✓ (**419 tests /
84 files**, +8/+1 over the P2 baseline), `npm run build:web` ✓ (12.6s), `npm run coverage` **95.47% core** (≥90).
New file `tests/epingle_anchored.spec.ts`; touched core `geometry/segment-grammar.ts` + `section/place.ts`, web
`engine/{crossTies,…}` + the 4 scheme manifests; updated `tie_legs_geometry`/`scheme_switch`/`beam_supplements`
tests. **No new `if(elementType)`; engine purity held; `.rcfg` untouched (additive migration); BBS/cutLength
goldens unchanged** (hook geometry changes `geomLength`/render only, not cut lengths — render goldens are
structural, none needed re-baselining).

**Open / not done (NONE block P3 code-completeness).** (a) **Owner GPU/visual pass** on the now-visible épingle
hooks + anchored placement (headless can't see WebGL; pure geometry is headless-tested). (b) A **180° hook**
folds flat along the bar axis, so in the current flat-projection render it overlaps the body (no distinct lateral
return) — physically correct, but a 3D out-of-plane hook is a later refinement. (c) The remaining v1.0.3 phases
**P4 (G2) → P5 (G3) → P6 (G4) → P7 (G7) → P8 (G8) → P9 (G9)** are unbuilt.
**→ Next agent:** implement `v1.0.3_impl_plan.md` **Phase 4 (G2 — addressable bars, section levels & the
façonnage editor)** — the largest phase; stage it a→d and keep the grouped fast path byte-identical when no
overrides/levels/extraBars are present. Before coding: `git log`/diff; `npm run check` + `build:web` GREEN; append
a §9 entry.

### 2026-06-30 — v1.0.3 Phase 1 (G1 — true bar geometry) + Phase 2 (G6 — cadence + coupe/elevation dims) IMPLEMENTED — by **Amer** (owner's Windows PC)

**What I did.** Implemented the **first two v1.0.3 phases** (`v1.0.3_impl_plan.md` P1→P2, the spec §10 build-order
start G1→G6), after reading `core_logic.md`, `v1.0.3_spec.md`, the plan, and this file; confirmed the baseline
GREEN first (`npm run check` = 387/78). Full detail in **D-V103-1** (G1) and **D-V103-2** (G6).

- **P1 / G1 — true bar geometry** ([REF-SYS-960], spec §1). The single change is in core's `placeBars`
  (`section/place.ts`): longitudinal bars now render their real bent `centerline3D` (mapped `worldX=u`,
  `worldY=axisStart+localX`, `worldZ=v+localY`), a continuous spiral is placed ONCE as a member-length coil
  (detected via `coilLength`), and the stair main bar follows the waist+landing automatically. A straight `DROITE`
  is **byte-identical** to the old straight line, so **no golden needed re-baselining** — every existing
  render/BBS/fiche/DXF golden held. Because the coupe engine + fiche + PDF/DXF all consume `placeBars`, façonnage /
  cranks / relevés / the coil / the stair now appear in 3D + coupe + PDF + DXF for free. `axisStart` is plumbed
  (default 0) for the G2 unique-length work.
- **P2 / G6 — cadence continuity + dims** ([REF-SYS-757b/925c], spec §6). (a) `regionStations` now carries the
  running cadre station across a region boundary (no short stub; the single-region path stays byte-identical).
  (b) `sectionAt` populates the coupe `dimensions` with WIDTH/HEIGHT + an enrobage **cover on each face**, and
  `pdf.ts drawCoupe` finally **renders `view.dimensions`** (the DXF coupe already did) so PDF + DXF agree.
  (c) the elevation fiche gains per-region **length dims** under the overall length.

**State now: GREEN, NOT pushed** (policy §10 — push only when the owner asks). `npm run check` ✓ (**411 tests /
83 files**, +24/+5 over baseline), `npm run build:web` ✓ (57s), `npm run coverage` **94.92% core** (≥90). New
files: `tests/{true_geometry,coil_placement,stair_bars,region_cadence,coupe_dims}.spec.ts`; touched core
`section/{place,sectionAt}.ts`, exporters `{fiche,pdf}.ts`, `tests/perf_heavy.spec.ts`. **No new `if(elementType)`;
engine purity held; `.rcfg` untouched; BBS/cutLength goldens unchanged.**

**Open / not done (NONE block P1/P2 code-completeness).** (a) **Owner GPU/visual pass** on the new 3D geometry
(bent bars / one coil / stair) — the headless gate can't see WebGL; the pure placement is headless-tested. The
spec's "bent endpoints visibly EXIT the concrete" depends on G8's concrete edges and on hooks being part of the
centreline — **note:** the segment-grammar currently keeps end-hooks in the `fiche`/cutLength but NOT in the
rendered `centerline3D`, so a pure end-hook (no body bend) does not yet add a visible return in 3D; body bends
(cranks/relevés/Z/stair) do render. Surfacing hook geometry in the centreline is a follow-up (relevant to G5's
"visible épingle hook" in P3). (b) The remaining v1.0.3 phases **P3 (G5) → P4 (G2) → P5 (G3) → P6 (G4) → P7 (G7)
→ P8 (G8) → P9 (G9)** are unbuilt.
**→ Next agent:** implement `v1.0.3_impl_plan.md` **Phase 3 (G5 — cross-tie / épingle unification + anchoring)**.
It depends on P1 (anchored loops + hooks now render): remove the centred-supplement fallback for épingle-role
groups in `placeBars`, route épingles through the anchored F2 cross-tie path, and migrate legacy
supplement-épingles into `crossTies` at the `rcfgToDoc` chokepoint. Before coding: `git log`/diff; `npm run check`
+ `build:web` GREEN; append a §9 entry.

### 2026-06-28 — v1.0.2 Phase 7 (F1 — in-plane view roll) IMPLEMENTED — **v1.0.2 FEATURE-COMPLETE** — by **Zayd** (Hetzner dev box)

**What I did.** Implemented the **final phase, F1** (`v1.0.2_impl_plan.md` Phase 7). With it, **all seven v1.0.2
features (F1–F7) are code-complete.** Full detail in **D-V102-7**.

- **P7 / F1 — in-plane view roll** ([REF-SYS-811], spec §1). Camera/interaction-only. Pure
  `rollUpVector(viewDir, rollRad)` (level up ⟂ the view axis, rotated about it — Rodrigues; headless-tested).
  Session `rollRad` in the store (**not** in `.rcfg`); Home + every named-view snap re-level it to 0.
  `RollController` (`useFrame` after OrbitControls) applies the rolled `camera.up` and restores world-up when the
  roll clears — orbit + zoom untouched. UI: ↺/↻ buttons (±90°, Shift = ±5°) + a roll slider in the ViewControls
  overlay (the a11y/keyboard path); the curved drag-ring on the gizmo is deferred GPU polish.

**State now: GREEN, NOT pushed** (policy §10). `npm run check` ✓ (**387 tests / 78 files**, +7/+1 over P6),
`build:web` ✓ (app ≈ 816 kB), `coverage` 95.05% core (≥90). New file: `apps/web/src/viewport/view_roll.spec.tsx`;
touched `viewport/{cameraState,Viewport,ViewCube}.tsx/.ts`, `store/useStore.ts`, `i18n/strings.ts`, `styles.css`.

**Open / not done (NONE block v1.0.2 code-completeness).** (a) **Owner's push** — the whole v1.0.2 stack
(P1–P7) is unpushed on `feat/p1-m1-engine`, awaiting the owner's "push". (b) **Owner GPU/visual pass** on the new
interactions: F7 picker, F2 cross-ties, F5 region table, F6 façonnage sketch, F1 roll feel — plus the still-open
v1.0.1 ViewCube/persp⇄ortho/coupe-handle pass. (c) Deferred polish: F6 façonnage on chapeau/montage/generic
groups + a PDF BBS façonnage sketch column; F5 per-region Asw verification + boundary drag; F1 curved gizmo
drag-ring; supplement épingles still render centred (D-P3-6). (d) **Standing engineer sign-offs**
(G-BAEL/EC2/RPS/COUPE/TOL) + a11y axe + authoring/user docs — these gate *acceptance/release*, not the code.
**→ Next agent:** v1.0.2 is **feature-complete** — there is no Phase 8. If the owner says "push", commit the
P1–P7 work + the doc updates and push `feat/p1-m1-engine`. Otherwise await the owner's GPU pass / next directive
(likely a v1.0.3 spec or the engineer sign-off campaign). Before any new coding: `git log`/diff; keep the gate
GREEN; append a §9 entry.

### 2026-06-28 — v1.0.2 Phase 6 (F6 — façonnage editor + shape catalog) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 6 (F6)** of `v1.0.2_impl_plan.md`. Full detail in **D-V102-6**.

- **P6 / F6 — façonnage editor + shape catalog** ([REF-SYS-520], spec §6). Three new **shape manifests**
  (Z-bar / double-crank / stepped — pure segment-grammar data, registered, integrity-clean → 16 shapes). Each
  **longitudinal group** (column `longitudinal` + beam `span`) gains an optional `faconnage {shapeParams?,
  hooks?}`; `solveDoc` passes the chosen shape's user params + maps hooks through to the generator → the choice
  flows to 3D/coupe/BBS/DXF/PDF (the engine already accepts any shape+params — minimal core change). **Hooks work
  on any shape:** `generateBarShape`/`generateShape` gained an optional `opts.hooks` per-end override (byte-
  identical when absent); the open longitudinal manifests' `totalLengthExpr` were migrated to the hook-agnostic
  `… + hookAllowances − bendDeductions` form (byte-identical with no user hooks — all goldens green). The
  `cutLength` invariant (D-P1-1) is guarded: the generator throws on an impossible shape, `FaconnageEditor`
  catches it + rejects non-positive cutLength, shows a clear error, and **never commits invalid params** (local
  edit buffer → the solve only ever sees a valid shape). UI: catalog select + param fields seeded from geometry +
  start/end hook selects + a live SVG sketch + cutLength. `.rcfg` round-trips for free; legacy → DROITE default.

**State now: GREEN, NOT pushed** (policy §10). `npm run check` ✓ (**380 tests / 77 files**, +17/+3 over P5),
`build:web` ✓ (app ≈ 815 kB), `coverage` **95.05% core** (≥90). New files: `apps/web/manifests/shapes/{zbar,
double_crank,stepped}.json`, `apps/web/src/ui/{FaconnageEditor.tsx,faconnage_editor.spec.tsx}`,
`apps/web/src/engine/faconnage.spec.ts`, `tests/facade_shapes.spec.ts`; touched core
`geometry/{segment-grammar,registry}.ts`, `pipeline/element.ts`, the 7 open longitudinal shape manifests
(totalLengthExpr migration), web `engine/{document,solveDoc,manifests}.ts`, `ui/Sidebar.tsx`, `i18n/strings.ts`,
`styles.css`.

**Open / not done.** (a) Façonnage is wired for the **column longitudinal + beam span** groups; chapeau/montage
(curtailment-coupled) + generic longitudinal zones are a straightforward follow-up using the same `faconnage`
plumbing. (b) BBS already carries the real `fiche` (legs/bends/hooks) per scheduled bar — a dedicated façonnage
**sketch column** in the PDF BBS is optional polish (not built). (c) **Lap-splice/coupler scheduling between
elements is deferred** (spec §6.6). (d) Owner GPU pass on the live sketch feel (+ the carried F7/F2/F4/F5/v1.0.1
visual passes). (e) The last phase **P7 (F1 — in-plane view roll)** is unbuilt.
**→ Next agent:** implement `v1.0.2_impl_plan.md` **Phase 7 (F1 — in-plane view roll)** — the FINAL v1.0.2 phase.
Camera/interaction-only: a pure `rollUpVector(viewDir, rollRad)` helper, a session-only `rollRad` store field
(**NOT** in `.rcfg`), a roll-ring + ↺/↻ buttons on the ViewCube, Home/named-views reset it. Mirror the v1.0.1
ViewCube pattern (`viewport/cameraState.ts` + `ViewCube.tsx`). Before coding: `git log`/diff; `npm run check` +
`build:web` GREEN; append a §9 entry. After F1, all seven v1.0.2 features are code-complete (awaiting the owner's
push + GPU pass).

### 2026-06-27 — v1.0.2 Phase 5 (F5 — user transverse regions) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 5 (F5)** of `v1.0.2_impl_plan.md` — the first v1.0.2 phase that **adds core
capability** (the others were UI). Full detail in **D-V102-5**.

- **P5 / F5 — user-defined transverse regions** ([REF-SYS-757], spec §5). A column tie / beam stirrup now carries
  an ordered, contiguous `{from,to,spacing}` region list (over 0..L) so cadre/stirrup spacing varies along the
  member (dense ends, looser middle). Added **through the existing transverse-segment seam — no element
  branching**: new core `TransverseRegion` + `regions?` on `ElementTransInput`/`MemberPlacement.transverse[]`/
  `solveColumn.tie`; pure `regionStations`/`regionStationCounts` (a single full region delegates to
  `transverseStations` → **byte-identical**, goldens safe); `placeBars`, **BBS** counts, the **elevation fiche**
  callouts, and the **coupe snap stations** all region-aware. **Seismic is WARN-only** (`region_crit_spacing` —
  an end region looser than `s_crit` warns; never silently overrides, never blocks; rides provisional G-RPS).
  Web: doc fields on tie/stirrup/generic-transverse; `solveDoc` threads regions onto the cadre **and** the
  cross-tie épingles; pure `engine/regions.ts` (contiguity + symmetric quick-fill); `ui/RegionEditor.tsx` (table +
  symmetric-ends seeded from `l_c` + uniform reset) under the column/beam controls. `.rcfg` round-trips for free
  (rides `meta.app_document`; legacy → one uniform region).

**State now: GREEN, NOT pushed** (policy §10). `npm run check` ✓ (**363 tests / 74 files**, +17/+3 over P4),
`build:web` ✓ (app ≈ 811 kB), `coverage` **95.03% core** (≥90; F5 added core lines, coverage held). New files:
`tests/transverse_regions.spec.ts`, `apps/web/src/engine/{regions.ts,transverse_regions.spec.ts}`,
`apps/web/src/ui/{RegionEditor.tsx,region_editor.spec.tsx}`; touched core `types/layout.ts`,
`section/place.ts`, `pipeline/{element,solve}.ts`, `validation/seismic.ts`, exporters `bbs.ts`/`fiche.ts`, web
`engine/{document,solveDoc}.ts`, `viewport/coupeHandle.ts`, `ui/Sidebar.tsx`, `i18n/strings.ts`, `styles.css`.

**Open / not done.** (a) **Per-region Asw verification** is deferred — the Asw/clear-spacing checks still use the
representative `tz.spacing`; F5 affects placement/BBS/fiche/seismic-WARN, not the Asw formula. (b) Boundary
**drag** on the elevation is deferred — the numeric region table is the a11y baseline (owner GPU follow-up,
alongside the still-pending F7 picker / F2 cross-ties / F4 expand feel / v1.0.1 ViewCube passes). (c) F5 seismic
rides provisional **G-RPS**. (d) The remaining phases **P6 (F6 — façonnage editor) → P7 (F1 — in-plane roll)**
are unbuilt.
**→ Next agent:** implement `v1.0.2_impl_plan.md` **Phase 6 (F6 — façonnage editor + shape catalog)** next. It
adds **new shape manifests** (Z-bar / double-crank / stepped — data, register in the shape registry) + lets each
longitudinal group choose `shapeId`/`shapeParams`/`hooks`, flowing through `solveDoc` to 3D/coupe/BBS/DXF/PDF.
**The trap is the `cutLength` invariant (D-P1-1)** — reuse the generator's existing `totalLengthExpr`
cross-check, never "simplify" cutLength to the polyline sum. Before coding: `git log`/diff; `npm run check` +
`build:web` GREEN; append a §9 entry.

### 2026-06-27 — v1.0.2 Phase 4 (F4 — expandable right column) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 4 (F4)** of `v1.0.2_impl_plan.md` (build-order P4, the next phase after
P3/F3), continuing the same session. Full detail in **D-V102-4**.

- **P4 / F4 — workspace re-layout** ([REF-UI-830], spec §4). **Layout-only, no engine change.** Replaced the
  always-on right `AlertsPanel` strip with `ui/RightColumn.tsx`: **Verification + Project + BBS** as three
  **collapsible, independently-scrollable** sections (each a header button + `overflow-y:auto` body), plus an
  **Expand** toggle that widens the whole column to 60% leftward over the 3D (`.right-column.expanded`). The
  **bottom dock now holds only Coupes** (`BottomPanel`→`CoupePanel`). Navbar BBS/Project/Vérifications buttons now
  toggle their right-column section (`toggleRightPanel`); Coupes still toggles the bottom dock. New store state
  `rightPanels` + `expandPanels` (session-only, **not** in `.rcfg`, not reset on element `reset()`). `AlertsPanel`
  shed its own header (the section header supplies the title). New i18n group `workspace` (the obvious name
  `layout` was already used by the layout-principle group — watch for that).

**State now: GREEN, NOT pushed** (policy §10). `npm run check` ✓ (**346 tests / 71 files**, +4/+1 over P3),
`build:web` ✓ (app ≈ 810 kB), `coverage` 94.93% core (≥90; F4 is layout-only so core coverage is unchanged). New
files: `ui/RightColumn.tsx`, `ui/workspace_layout.spec.tsx`; touched `App.tsx`, `ui/{BottomPanel,Navbar,AlertsPanel}.tsx`,
`store/useStore.ts`, `i18n/strings.ts`, `styles.css`. **F4 is fully jsdom-testable**; the *feel* of the
expand-over-3D + the per-section scroll split want a quick owner GPU/eye pass (`npm run dev`, port 5180) but
nothing is blocked.

**Open / not done.** (a) Carried-over owner GPU passes: F7 picker + F2 cross-ties + the v1.0.1
ViewCube/coupe-handle, and now the F4 expand/scroll feel. (b) Supplement épingles still render centred
(D-P3-6 follow-up); F2 Auto/seismic ride provisional **G-RPS**. (c) The remaining v1.0.2 phases **P5 (F5) → P6
(F6) → P7 (F1)** are unbuilt.
**→ Next agent:** implement `v1.0.2_impl_plan.md` **Phase 5 (F5 — user-defined transverse regions: per-region
cadre spacing)** next. This one **adds core capability** via the transverse-segment seam (regions on the
transverse group; `transverseStations`/`placeBars`/BBS counts per region; seismic *tightens within* end regions,
never replaces them) — keep `[{0,L,s}]` byte-identical to today to protect the goldens, and it depends on the
P2/F2 cross-tie refactor that already landed. Before coding: `git log`/diff; `npm run check` + `build:web` GREEN;
append a §9 entry.

### 2026-06-27 — v1.0.2 Phase 3 (F3 — sticky per-zone readout) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented **Phase 3 (F3)** of `v1.0.2_impl_plan.md` (build-order P3, the next phase after the
already-implemented P1/F7 + P2/F2), after re-reading `cross_projects_policy.md`, `current_state.md`, the v1.0.2
spec §3 + plan Phase 3. Confirmed baseline GREEN first (`8af7b40`, 337/69). Full detail in **D-V102-3**.

- **P3 / F3 — sticky per-zone verification readout** ([REF-UI-820], spec §3). **UI-only, no engine change** — the
  per-zone provided area + `ZoneGeometry.d` already live on `SolveResult`. Added a pure selector
  `ui/derived.ts perZoneReadout(result, doc, lang)` returning **one row per flexural zone** (As,prov vs As,req,
  `ok`, `d`, `perMetre`), read off the validation `provided_area[:zone]` items + `result.zones` — **generic over
  all 8 elements** (the column's bare `provided_area` rule maps onto `result.zones[0]`; slab zones are per-metre
  → cm²/m). Replaced the old single-aggregate `Badges` with a sticky `ZoneReadout` (`position:sticky;top:0`
  inside the scrolling `.sidebar`, `role="status" aria-live="polite"`, per-zone green/red rows + an overall
  🟢/🟠/🔴 chip). New `i18n readout` block (fr/en) for the column/beam zone labels; generic zones reuse the doc's
  own labels.

**State now: GREEN, NOT pushed** (policy §10). `npm run check` ✓ (**342 tests / 70 files**, +5/+1 over baseline),
`build:web` ✓ (app ≈ 810 kB), `coverage` 94.93% core (≥90; F3 is UI-only so core coverage is unchanged). New
files: `ui/per_zone_readout.spec.ts`; touched `ui/derived.ts`, `ui/Sidebar.tsx`, `i18n/strings.ts`, `styles.css`,
`ui/smoke.spec.tsx`. **F3 is fully jsdom-testable — no GPU pass needed** (unlike the still-pending F7/F2 visual
pass).

**Open / not done.** (a) The F4 layout phase will move the panels into a right-hand column — **F3's sticky bar
should survive that** (verify it still pins after the re-layout). (b) Still pending from earlier phases: the owner
GPU pass on F7 picker + F2 cross-ties + the v1.0.1 ViewCube/coupe-handle; supplement épingles still render centred
(D-P3-6 follow-up); F2 Auto/seismic ride provisional **G-RPS**. (c) The remaining v1.0.2 phases **P4 (F4) → P5
(F5) → P6 (F6) → P7 (F1)** are unbuilt.
**→ Next agent:** implement `v1.0.2_impl_plan.md` **Phase 4 (F4 — expandable right column: Verif+Project+BBS)**
next (layout-only). Before coding: `git log`/diff; `npm run check` + `build:web` GREEN; append a §9 entry. Keep
F3's sticky readout pinned through the re-layout.

### 2026-06-27 — v1.0.2 Phase 1 (F7) + Phase 2 (F2) IMPLEMENTED — by **Zayd** (Hetzner dev box)

**What I did.** Implemented the **first two phases** of `v1.0.2_impl_plan.md` (build-order P1=F7, P2=F2), after reading `cross_projects_policy.md`, `core_logic.md`, the v1.0/1.0.1/1.0.2 specs + plan, and this file; pulled latest (`8af7b40`). Confirmed **4 design decisions** with the owner via AskUserQuestion first (see below). Full detail in **D-V102-1** (F7) and **D-V102-2** (F2).

- **P1 / F7 — 2D section picker + usable bar binding.** New pure `engine/barLabels.ts` (face-relative `T1/B2/L1/R3`), `ui/SectionPicker.tsx` (SVG dots + a11y button list), `ui/useBarLink.ts` (two-click link, pending-pick local per editor → no cross-fire, mirrored to store `selectedBars`). Core `PlacedBar.barIndex` + `buildScene(…, selectedBars)` + `Rebar onPick` give per-bar 3D highlight/click. `SupplementsPanel` rebuilt onto the picker (dropped the raw `bar1/bar2` inputs).
- **P2 / F2 — cross-ties rebuilt on real bar engagement (columns AND beams).** Removed `nLegs`/`crossTieZones`; the tie/stirrup now carries `crossTies[]` + `crossTieHookAngle`. Core gained an optional `anchor {u,v,angleDeg}` on the transverse seam so `placeBars` puts each épingle BETWEEN its two bars (rotated to the A→B line) instead of centred — **no element branching in core** (the `tie`/`stirrup` choice is in the web adapter). Asw = 2+2·nTies; real `longBarsEngaged`; param-driven épingle hook angle (keeps the `cutLength` invariant); Auto = every intermediate bar + per-direction presets (`engine/crossTies.ts`); legacy `nLegs` migrates losslessly in `migrateDoc` (at the `rcfgToDoc` chokepoint). Seismic engagement is **WARN-only (never blocks)** per the owner — `crosstieEngagement` ND3 FAIL→WARN.

**Owner design decisions (this session).** (1) Bar labels = **face-relative** (`T1/B2/L1/R3`). (2) Auto cross-ties = engage **every intermediate bar**, and an RPS/EC8 engagement shortfall **warns but does not block**. (3) Cross-ties apply to **both columns and beams** this phase. (4) Hook angle: the user **assigns one angle** (presets 90/135/180 or free entry) applied to **all** the element's cross-ties → modelled as an element-level `crossTieHookAngle`.

**State now: GREEN, NOT pushed** (per policy §10, push only when the owner asks). `npm run check` ✓ (337 tests / 69 files), `build:web` ✓, `coverage` 94.93% core (≥90). Working tree on `feat/p1-m1-engine`; new files: `engine/{barLabels,crossTies}.ts`, `ui/{SectionPicker,CrossTieEditor,useBarLink}.tsx/.ts`, specs `bar_labels`/`section_picker`/`epingle_hook_angle`. **Headless box can't verify WebGL** — the 3D bar click, the live 2D picker feel, and the anchored cross-tie 3D/coupe render need the owner's GPU pass (`npm run dev`, port 5180).

**Open / not done.** (a) Owner GPU/visual pass on F7 picker + F2 cross-ties (and the still-open v1.0.1 ViewCube/coupe-handle pass). (b) **Supplement épingles still render centred** (presence-only) — anchoring them like cross-ties is a small D-P3-6 follow-up. (c) F2 Auto/seismic ride the provisional **G-RPS** overlay (unsigned). (d) The other v1.0.2 phases **P3 (F3) → P4 (F4) → P5 (F5) → P6 (F6) → P7 (F1)** are unbuilt.
**→ Next agent:** implement `v1.0.2_impl_plan.md` **Phase 3 (F3 — sticky per-zone readout)** next (UI-only). Before coding: `git log`/diff; `npm run check` + `build:web` GREEN; append a §9 entry. The F4 layout phase will move the panels — F3's sticky bar should survive it.

### 2026-06-27 — v1.0.2 specced + planned; v1.0.1 implemented + pushed — by **Amer** (owner's Windows PC)

**What I did.**
1. **Implemented v1.0.1** (Features A/B/C — see the entry below), gate GREEN (`npm run check` = 66 files / 327 tests; `build:web` ✓; coverage 95.14% core).
2. On the owner's **"push"** instruction, committed it and the new docs and **pushed to `origin/feat/p1-m1-engine`**: `d27a950` (v1.0.1 implementation) + `d0c66f1` (docs).
3. From the owner's **7 directives**, after a deep code trace + **8 confirmed design decisions** (AskUserQuestion), authored **`v1.0.2-Spec.md`** (F1 view roll · F2 column cross-ties rebuilt · F3 sticky per-zone readout · F4 expandable right-column · F5 user transverse regions · F6 façonnage editor · F7 2D section picker) and **`v1.0.2_impl_plan.md`** (7 feature-phases, build order F7→F2→F3→F4→F5→F6→F1, with steps/tests/DoD + the plan↔spec matrix). Added `core_logic.md` + `architecture_breakdown.md` (product/architecture overviews). See **D-V102**.

**State now: GREEN, pushed.** v1.0.2 is **spec + plan only — no code yet.**
**Open:** (a) the owner's GPU/visual pass on the v1.0.1 ViewCube + persp⇄ortho + 3D coupe handle; (b) the cosmetic owner confirmations in `v1.0.2-Spec.md` §9 (Auto-rule, lap-splice deferral, F4 expand width, bar-label scheme…); (c) the long-standing engineer sign-offs (G-BAEL/EC2/RPS/COUPE/TOL) + a11y axe + authoring/user docs.
**→ Next agent:** implement `v1.0.2_impl_plan.md` **Phase 1 (F7 — the 2D section picker)** first (it underpins F2). Before coding: `git log`/diff; `npm run check` + `build:web` GREEN; append a §9 entry.

### 2026-06-25 — v1.0.1 IMPLEMENTED: Feature C + A (ViewCube) + B (3D coupe handle) — by **Amer**

Implemented all three v1.0.1 feature groups (gate GREEN, 66 files / 327 tests, `build:web` ✓, core coverage 95.14%; details in **D-V101-1/2**):
- **C — project completion:** namespaced BBS (`markPrefix`); a shared `exporters/fiche.ts` elevation fiche (element-aware orientation + bar marks + tie callout + dims) consumed by **both** PDF and DXF; `buildProjectPdf` (sheet-per-type + project summary) + per-project export-lock; web glue + Navbar "Projet complet"; instance reorder. New suites: `elevation_fiche`, `project_pdf` + reorder/menu cases.
- **A — ViewCube:** pure `cameraState.ts` (26 named views + element-aware member rotation, fixes the beam-stands-up placeholder) + `ViewCube.tsx` (drei gizmo + perspective⇄orthographic + Home + a11y named-view list). Suites: `viewcube_orientation`, `view_controls`.
- **B — 3D coupe handle:** pure `coupeHandle.ts` (clamp/snap/extents) + `CoupeOverlay.tsx` (cut-plane + cutting-line + tag + draggable handle → `updateCut`). Suite: `coupe_handle`.

The cube gizmo, the orthographic camera, and the drag-handle are **code-complete but await the owner's GPU pass** (the headless box can't render WebGL); their pure logic is headless-tested.

### Earlier history (condensed, newest → oldest; all on `feat/p1-m1-engine`)
- **2026-06-25 — P6 fixes + all 8 elements + P7 project core + v1.0.1 spec (Zayd):** control fixes 8a/8b/8c; wired all 8 elements + seismic picker into the SPA (D-P6-3); shipped the P7 project core (instances + takeoff + `.rcfg` v1.1 + migration, D-P7-3); authored `v1.0.1-Spec.md`. Commits d6b03df/ca5d326/430c240/66cfdb7.
- **2026-06-25 — P7 specced (Amer):** docs-first — multi-element project model + elevation fiche written into the spec/plan (D-P7-1/2).
- **2026-06-25 — P6 hardening (Amer):** coverage-95% gate, i18n completeness test, heavy-element perf test, bundle code-split (lazy pdf-lib + a `three` chunk).
- **2026-06-25 — P5 SPA wiring (Amer):** Export/Import menu + BBS table + coupe manager + IndexedDB autosave wired into the SPA; Phase 5 fully done.
- **2026-06-25 — P5 engine (Amer):** BBS + DXF (hand-rolled R12) + PDF + export-lock + `.rcfg` I/O in the new `@rebarconfig/exporters` package, golden-tested (D-P5-4…7).
- **2026-06-24 — P5 start (Amer):** Section/Coupe engine — `MemberPlacement` + `placeBars` + `sectionAt` (D-P5-1/2).
- **2026-06-24 — P4b (Zayd):** stair `E-STR-01` + joist `E-SLB-03` + RPS-2011 seismic overlay (D-P4b-*; G-RPS).
- **2026-06-24 — P4a (Zayd):** circular/pile/slab geometries + helix/mesh generators + EC2 pack + slab predicates (D-P4a-*; G-EC2).
- **2026-06-24 — P3 (Zayd):** scheme catalog + supplements + advanced builder + beam `E-BEM-01` (D-P3-*).
- **2026-06-24 — P2 (Zayd):** SPA shell + R3F 3D viewport (D-P2-*).
- **2026-06-24 — P1 (Zayd):** headless engine + `E-COL-01` + BAEL pack (D-P1-*; G-BAEL).
- **2026-06-24 — P0 (Zayd):** six core contracts + JSON Schemas + fixtures + manifest-integrity gate (D-P0-*).
