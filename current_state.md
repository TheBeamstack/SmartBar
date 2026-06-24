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
| P2 / M2 — SPA shell + 3D viewport | ⛔ not started | — |
| P3 / M3 — Scheme catalog + supplements + advanced builder + `E-BEM-01` | ⛔ not started | — |
| P4 / M4 — Full element set + EC2 pack + RPS seismic | ⛔ not started | — |
| P5 / M5 — Exports (BBS, DXF, PDF) + `.rcfg` I/O | ⛔ not started | — |
| P6 / M6 — Hardening, sign-off, release | ⛔ not started | — |

**Test status (P1):** `npm run check` green — purity ✓, manifest integrity ✓ (**5 shapes** / 1
element / 1 scheme / 1 supplement), typecheck ✓, **64 tests passed** across 14 files. New P1
suites: `segment_grammar`, `layout_corner_sharing`, `effective_depth`, `leg_count_asw`,
`anchorage_reduction`, `validity_tiers`, `determinism`, `bael_reference` (⚠ provisional —
G-BAEL unsigned).

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
npm run check          # FULL gate: purity → manifests → typecheck → tests  (use before handoff)
npm run test           # vitest only
npm run check:manifests# JSON-Schema + cross-ref validation of apps/web/manifests
npm run check:purity   # engine-purity scan of packages/core
npm run typecheck      # tsc --noEmit on the whole repo
```

There is **no app to launch yet** (the SPA is P2). Everything in P0 is headless TS + JSON.

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
  src/validation/         # P1: validation engine + validity tiers (validateColumn, tierFor, …)
  src/pipeline/           # P1: solve.ts — solveColumn orchestrator (layout→shape→validate)
  src/index.ts            # public surface: types + integrity + geometry/layout/validation/pipeline
packages/codepacks/       # @rebarconfig/codepacks — packs behind core's CodePack iface (P1)
  src/bael/bael-constants.json  # ⚠ PROVISIONAL BAEL constants, "_provisional": true (G-BAEL)
  src/bael/index.ts       # makeBaelPack(): BaelPack — code.* impls + PackExtras (bands, ls, …)
apps/web/                 # @rebarconfig/web — SPA placeholder (built in P2)
  manifests/              # the real data: shapes/ (5: +attente,+baionnette) elements/ schemes/ supplements/
tests/                    # P0 contract tests + P1 engine suites + fixtures (valid/ + invalid/)
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
2. **`@rebarconfig/core` `main`/`types` point at `src/index.ts` (raw TS).** This works because
   vitest/tsx transpile on the fly and npm-workspaces symlinks the package into `node_modules`. It
   means **no build step exists yet** — fine for P0–P1 (headless). When the SPA (P2) or a Node
   consumer needs compiled JS, add a `dist` build (tsup/tsc) and point `exports` at it. Not needed
   yet; don't add prematurely.
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

---

## 9. Handoff log (newest first — APPEND your entry here before you stop)

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
