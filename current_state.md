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
| **v1.0.2** — F1 roll · F2 cross-ties rebuilt · F3 sticky per-zone readout · F4 right-column layout · F5 user transverse regions · F6 façonnage editor · F7 2D section picker | 🟡 **SPEC + PLAN done, PUSHED (`d0c66f1`); NOT YET IMPLEMENTED** (D-V102) | Amer, 2026-06-27 |

**Where things stand (2026-06-27).** The app is **feature-complete through v1.0.1 and pushed** to
`origin/feat/p1-m1-engine`: the whole 8-element catalog, multi-element projects, combined/elevation exports,
the ViewCube and the 3D coupe handle. **v1.0.2 is specced + planned but not coded** — seven targeted
fixes/features in `v1.0.2-Spec.md` + `v1.0.2_impl_plan.md`. The single-element engine/exporters are unchanged
under all of it. New agents: read `core_logic.md` (product) + `architecture_breakdown.md` (structure) first.

**Last green gate (v1.0.1, 2026-06-25):** `npm run check` ✓ — purity ✓, manifests ✓ (13 shapes / 8 elements /
10 schemes / 7 supplements), core+web typecheck ✓, **327 tests / 66 files**; `npm run build:web` ✓ (app ≈
801 kB + three ≈ 1045 kB + lazy pdf-lib ≈ 436 kB); `npm run coverage` 95.14% core. **The headless gate can't
see WebGL** — the ViewCube gizmo, persp⇄ortho camera, and 3D coupe handle are code-complete but await a visual
pass on the owner's Windows GPU (`cd apps/web && npm run dev`, port 5180); their pure logic is headless-tested.

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
- **D-V102** v1.0.2 specced + planned (NOT coded): F1 in-plane view roll · F2 column cross-ties rebuilt on real bar engagement (+ Auto-code, real `longBarsEngaged`) · F3 sticky per-zone readout · F4 expandable right-column layout (Verif+Project+BBS) · F5 user transverse regions (per-region spacing) · F6 façonnage editor (catalog + params + end-hooks + Z/double-crank/stepped) · F7 2D section picker (replaces raw index binding). Build order **F7→F2→F3→F4→F5→F6→F1**. F2+F5 add core capability via existing seams (placement anchor; transverse segments) — no element branching. No new sign-off gate (F2-Auto/F5-seismic ride G-RPS). Owner decisions recorded in `v1.0.2-Spec.md`; phases/tests/DoD in `v1.0.2_impl_plan.md`.

---

## 9. Handoff log (newest first — APPEND your entry here before you stop)

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
