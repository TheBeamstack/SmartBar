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
| **v1.0.3 P7 (G7)** — **shop-drawing PDF/DXF**: a pure `shopDrawing()` annotation model (leader lines `mark·nØd·l=`, per-element sequential marks, coupe markers A-A, stirrup-zone `count×spacing` notation, support labels V1/V2) + a **bending table** (one row per distinct shape · sketch · Ø · cut · count/element · ×quantity total), shared by PDF + DXF; existing render goldens held (structural); **support width/anchorage now wired into the app PDF/DXF exports** (D-V103-7b, Amer) | ✅ **CODE DONE + tested** (D-V103-7 · 7b) · ⏳ owner GPU pass | Zayd · Amer, 2026-07-01 |
| **v1.0.3 P8 (G8)** — **3D fidelity**: transparent concrete now carries a crisp `<Edges>` outline (box + cylinder) so the volume reads as a solid block; **E-STR-01 renders a stepped stair** concrete (per-step boxes from `g`/`r`/`n_steps`/`flight_width`) instead of the flat rect box — viewport-only, no engine/core change | ✅ **CODE DONE + tested** (D-V103-8) · ⏳ owner GPU pass | Amer, 2026-07-01 |
| **v1.0.3 P9 (G9)** — **camera fixes**: killed the ViewCube auto-spin (roll is now an on-demand effect, not a per-frame `useFrame` loop) + **roll auto-levels on orbit-start**; added a **toolbar hand-pan toggle** (`navMode`, LEFT-drag pans when active, orbit on RIGHT-drag, zoom always) — session-only, not in `.rcfg` | ✅ **CODE DONE + tested** (D-V103-9) · ⏳ owner GPU pass | Amer, 2026-07-01 |
| **v1.0.4 spec — COMPLETE single-tenant product** — `v1.0.4_spec.md` restructured: façonnage (H1–H19) + Tracks A–E (A compliance truthfulness · B detailing depth · C site-ready output · D 3D fidelity · E data/interop). Vertical/multi-tenant (Track H) deferred. Split of duties: `v1.0.4_owner_tasks.md` (owner manual work) · `roadmap_directions.md` trimmed to F/G/H | 🟡 **SPEC DRAFTED** (docs only, not pushed) | Zayd, 2026-07-05 |
| **v1.0.4 prep phase executed** — baseline+severity verified (H1 crash + H2 no-op confirmed live), adapter safety net (characterization + `coverage:adapter` 96%), manifest-data table, design spikes, fixture inventory, `v1.0.4_impl_plan.md` (façonnage phasing) | ✅ **PREP DONE** · ⏳ owner design decisions (`owner_tasks §A`) · ⏳ engineer sign-off program (`owner_tasks §B`) | Zayd, 2026-07-03/05 |
| **v1.0.4 Phase 1 (H1, H3, H4)** — façonnage crash + data-loss fixes: per-bar override inherits the group façonnage (no more BAIONNETTE crash) + axial/removed-only edits skip regen; store `withDoc` keep-last-good guard + non-blocking solve-error banner (owner A-6); core-level `cutLength>0` guard in `generateBarShape` (BBS/DXF/splice protected); FaconnageEditor buffer resync on `[shapeId, memberLength, committedKey]`. Owner decisions A-2/A-4/A-5/A-6/A-7 recorded in `owner_tasks §A` | ✅ **CODE DONE + tested** · NOT pushed | Zayd, 2026-07-05 |
| **v1.0.4 Phase 2 (H11, H9, H2)** — façonnage capability: manifest `default`s for every open-shape param + shared `defaultParams` (drops the positional seed guess); guarded `pickShape` (validates the seed before committing); `totalLengthParam` (A-2 legs) on the 9 open shapes + adapter `applyUniqueLength` inverts `totalLengthExpr` so a unique `length` drives the principal leg → `cutLength == length` on EVERY open shape (was DROITE-only). New `ShapeArchetype.totalLengthParam` + integrity guard. | ✅ **CODE DONE + tested** · NOT pushed | Amer, 2026-07-06 |
| **v1.0.4 Phase 3 partial (H15, H6)** — backend↔frontend parity: independent extra bars now expose the full model (shape + reused FaconnageEditor + length + axial pos, not just u/v/Ø); collision-free `x{n}` extra-bar ids. Audit confirmed splices/supports/relevés/ties/regions/seismic all already wired — remaining gaps are H7 (extras on picker/coupe) + A3/H13 (EC2 picker). | ✅ **CODE DONE + tested** · NOT pushed | Amer, 2026-07-06 |
| **v1.0.4 Phase 3 done (H7) + A3/H13** — extras selectable on the SectionPicker (distinct marker + keyboard list) via a new `selectedExtraId` channel, editor highlights on pick; coupe already showed them (confirmed). **EC2 now reachable:** `doc.codePack` (BAEL/EC2, additive + `.rcfg` round-trip), `packFor()` threads the active pack through solveDoc/applyUniqueLength/FaconnageEditor, BAEL↔EC2 picker in the Projet/Code tab. BAEL↔EC2 = same structure, different numbers (tie-Ø verdict flips). Closes the last backend-ahead-of-frontend gaps. | ✅ **CODE DONE + tested** (green gate below) · NOT pushed | Amer, 2026-07-06 |
| **v1.0.4 Phase 4 (H8)** — geometric validity for the **addressable channel** (per-bar overrides + independent extra bars), core-only: pure `validateAddressableBars` (`validation/predicates.ts`) with three tiered predicates over the resolved `longBars[]` — `addressable_axial_extent` 🔴 (bar leaves `[0, memberLength]`), `addressable_section_bounds` 🔴 (extra `(u,v)` breaks the `cover+Ø/2` envelope → out of concrete), `addressable_clear_spacing` 🔴 below `max(Ø, dg+5, 20)` / 🟠 if merely tight (owner **A-5 tiered**, dg=20/k1=1/k2=5). Wired in `pipeline/element.ts` after `buildLongBars` (a `runExtent` reads the local-frame run); self-gates to real addressable content so a legacy doc + a benign Ø-only override are byte-identical. **Note:** the (outdated) `impl_plan` Phase 4 said spacing WARN-only; as-built follows the owner's A-5 **tiered** ruling. | ✅ **CODE DONE + tested** · NOT pushed | Zayd, 2026-07-06 |
| **v1.0.4 A2 review + verdict-fixes + B2 + B3(first slice)** — Amer's adversarial review of A2/H8 found two reachable wrong-🟢 in the addressable channel + fixed them: **Finding 1** (removals below the column minimum now FAIL `min_bars`/`face_min_bars` — real placed count/faces threaded, corner-aware; was: nominal layout → a 3-bar column exported green) + **Finding 2** (`addressable_section_bounds` now judges Ø-overrides, so an oversized override that eats the cover → 🔴; was: extras-only). **B2** (beam two supports): per-support **axial placement** (right chapeau at `L−extension` via `ElementLongInput.axisStart`) + per-support **anchorage** (`support_anchorage:left/right` vs hooked `l_bd`; `hooked?` on `AnchorageArgs`, BAEL 0.4 / EC2 0.7). **B3** (supplement anchoring, first slice): `resolveSupplement` now anchors SIDE_FACES/CORNER_DIAGONAL/INTERIOR_DIAMOND (+`angleDeg`) → `placeBars` renders them in-position (skin/diagonal longitudinal, diamond rotated 45°) instead of centred at origin; SKIN multi-bar fanout + supplement→A2 accounting deferred to the next slice. All legacy byte-identical; extra→zone convention + supplement 3D fidelity flagged for A1/owner-GPU. | ✅ **CODE DONE + tested** · NOT pushed | Amer, 2026-07-07 |
| **v1.0.4 A2 steel accounting (+H5)** — every steel add/remove now feeds §7. `pipeline/element.ts` reconciles each longitudinal zone's **As,prov = Σ(π/4)·Øᵢ²** and area-weighted-centroid **d** over the REAL placed set (per-bar Ø overrides, removed bars, standalone extras) via new `computeZoneGeometryWeighted` (`layout/rect.ts`); exact for mixed Ø + mixed levels. **Owner decision 2026-07-06:** an independent extra is real steel — it contributes to As,prov of the zone whose tension region it sits in (region rule) + enters `d` (re-baselined `independent_bars` + `addressable_bars` intentionally). Column threads exact As via optional `ColumnZoneInputs.asProvExact` (grouped → byte-identical). **A2 finalized:** per-region **Asw** checked on the governing (widest) tie/stirrup region (`governingAswSpacing`, D-V102-5) + clear-spacing **fold** (H8's predicate now judges every FOCUS bar — standalone extra OR Ø-override — vs the real placed set, so an override's enlarged Ø crowding the grid FAILs where the face check passed). `per_region_asw` + `clear_spacing_addons` green. | ✅ **A2 COMPLETE + tested** · NOT pushed | Zayd, 2026-07-06 |
| **v1.0.4 B3 (2nd slice) + C2 + C1 (station-aware slice)** — **B3:** SKIN multi-bar **fanout** (`resolveSupplement` → `anchors[]` = `count_per_side` × both lateral faces; adapter emits one input/anchor → N rendered+scheduled skin bars) + supplements now feed **A2 accounting** (a SKIN bar's steel joins the zone's As,prov; an interior DIAMANT tie adds Asw/m to the transverse zones at the derived `cos(45°)` orientation factor — ⚠ leg-crossing convention flagged G-BAEL/EC2). **C2:** spliced-segment BBS rows now draw the segment's OWN centreline (`segmentArcBounds` + `sliceCenterline2D`, not the whole-bar fallback) + robust leader anti-overlap (rail stretched to a legible min-pitch, no stacking at density); flows through pdf/dxf unchanged. **C1:** `defaultCoupeFor` **station-aware** — seeds the default cut at the richest station (most longitudinal bars), gated to the addressable channel so grouped docs keep mid-length byte-identical; new pure `suggestCoupeStations`. All legacy byte-identical (no golden moved). | ✅ **CODE DONE + tested** · NOT pushed | Zayd, 2026-07-07 |
| **v1.0.4 façonnage Phase-6 (H16/H17/H18/H19/H12) + H14 + B1** — **Phase-6 UI batch:** H16 FaconnageEditor honours manifest `max`/`step` (new `ShapeParam.step`); H17 rich invalid feedback (real reason + retained last-valid sketch + `aria-invalid`); H18 AddressableBars on the shared i18n bundle (`t(lang).addressable`, not inline `tr()`); H19 per-leg `min>0` (core generator rejects a non-positive leg + UI floors at 1 mm); H12 DROITE length coupled to member (read-only) with a custom-length toggle (owner **A-7**). **H14+B1 (per-bar splices):** overrides/extras carry `splices?`/`autoSplice?`; `buildLongBars` computes each bar's `SpliceResult` (explicit + H14 auto-split at PROVISIONAL 12000 stock); BBS schedules segments + shop-drawing slices each; new pure `evaluateLapStagger` (sourced EC2 §8.7.2 ≤½/section within 0.3·l0) → per-zone `lap_stagger` PASS/WARN; per-bar seismic laps. UI auto-split toggle. Two pre-existing test assertions updated (H3↔H19 message; the new H12 checkbox); no golden moved. | ✅ **CODE DONE + tested** · NOT pushed | Zayd, 2026-07-07 |
| **v1.0.4 B3 (3rd slice) + E1 + E2 (canonical `.rcfg` + migration)** — **B3:** the A2 supplement-accounting fold now credits an OPEN along-member add-on — SKIN **or** CORNER-DIAGONAL — to the zone's As (was skin-only); closed diamond → Asw unchanged. **E1:** new `reinforcementFromResult(result)` (exporters) maps the solved `groups[]` → canonical §10 `ReinforcingElement[]` (element-agnostic: role→distribution/placement); `SolvedGroup` carries `params`/`supplementId`; `docToRcfg` now **populates** `baseGroups`/`supplementalGroups` (was empty) by solving the doc (try/catch → empty fallback); `.rcfg` bumped to **v1.2** (additive, idempotent version migration). **E2:** `migration_chain` corpus (every fixture migrates + idempotent + future-version pass-through + unknown-kind survival). **Validated all 8 elements** doc→rcfg→recover round-trip (backend↔frontend lossless). **C1 slab-exactness DEFERRED** (needs a geometry re-model + G-COUPE acceptance — flagged). No golden moved. | ✅ **CODE DONE + tested** · NOT pushed | Zayd, 2026-07-07 |
| **v1.0.4 C1 slab-coupe exactness + D1/D2 (3D fidelity) + H10 + cover WARN tier** — **C1 (slab re-model):** a slab/stair-waist DISTRIBUTION linear bar now runs ACROSS the width at SPAN stations (`solveSlabDistributionBars` + `BarPosition.across`/`axial`; `placeBars` cross-width line; `sectionAt` §9.5.3 nearest-behind generalised to the distribution layer → transverse coupe = main dots + true distribution line). Welded MESH keeps the representative panel (`isDistributionLinear` gate); per-metre As unchanged; **no golden moved** (BBS distribution count kept — reconciliation flagged for sign-off). **D1:** pure `steppedStairSpec` + the top `landing_L` slab modelled (was ignored). **D2:** welded MESH renders as its true wire grid (`meshGridBars`) not a mis-oriented outline. **H10:** hook edit validated/committed against last-valid params (never dropped mid-invalid-param). **Cover:** §7.12 comfort-target WARN tier (`coverItem`, pack band, uniform across validators). +32 tests. | ✅ **CODE DONE + tested** · NOT pushed | Amer, 2026-07-08 |

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
**total = count × element quantity**). See **D-V103-7**. **P8/G8 + P9/G9 now landed too** (2026-07-01) —
**v1.0.3 is FEATURE-COMPLETE** (all nine phases G1–G9 coded): **P8/G8** (3D fidelity — the transparent concrete
gains a crisp `<Edges>` outline so it reads as a solid block, and E-STR-01 renders a **stepped stair** concrete
built from `g`/`r`/`n_steps`/`flight_width` instead of the flat rect box; viewport-only, no engine change) and
**P9/G9** (camera — the ViewCube **auto-spin is killed** (roll is now an on-demand `useEffect`, not the per-frame
`useFrame(…,1)` loop) and **roll auto-levels the moment the user starts an orbit/drag**; a **toolbar hand-pan
toggle** (`navMode`) maps LEFT-drag to pan when active, orbit falls back to RIGHT-drag, zoom always works — all
session-only, not in `.rcfg`). See **D-V103-8/9**. New agent: v1.0.3 code is done; remaining work is the **owner
GPU/visual passes** + the standing **engineer sign-offs** (acceptance, not code).

**Last green gate (v1.0.3 P1–P9 + P7b, 2026-07-01):** `npm run check` ✓ — purity ✓, manifests ✓ (**16 shapes** / 8
elements / 10 schemes / 7 supplements), core+web typecheck ✓, **470 tests / 95 files** (+7/+2 over the P1–P7
baseline of 463/93 — the new `nav_mode` + `export_supports` web suites); `npm run build:web` ✓ (35.7s); `npm run
coverage` **93.88% stmts** (≥90% threshold; core-only scope — P8/P9/P7b are `apps/web`+`exporters` code, outside
the core-only coverage include). **PUSHED to `origin/feat/p1-m1-engine`.**

**Current green gate (v1.0.4 through C1-slab-exactness + D1/D2 + H10 + cover-WARN, 2026-07-08 — local, pending owner push):**
`npm run check` ✓ — **657 tests / 129 files**; `npm run coverage` core **95.12%** (≥90; now hits the 95 target);
`npm run coverage:adapter` **96.76%** (no regression); `npm run build:web` ✓ (50.7s). Backend↔frontend validated
(prior): all 8 elements round-trip doc→`.rcfg`(canonical + `app_document`)→recover losslessly. History: v1.0.4 Phase 1
(H1/H3/H4) then Phase 2 (H11/H9/H2), Phase 3 (H15/H6/H7), A3/H13 (EC2 reachable) — Amer — Phase 4 (H8) + **A2**
(steel accounting As/d/H5 + per-region Asw + clear-spacing fold) — Zayd — then the **A2 adversarial review + two
verdict-fixes + B2 + B3 (first slice)** — Amer — then **B3 2nd/3rd slices + C2 + C1 (station-aware coupe) + E1 + E2** —
Zayd, 2026-07-07 — then **C1 slab-coupe exactness (slab/stair distribution re-model) + D1 (stair landing) + D2 (mesh
grid) + H10 + the §7.12 cover comfort-target WARN tier** — Amer, 2026-07-08. See the §9 entries. Two goldens
re-baselined **intentionally** at A2 (extras count toward As — owner decision); **no other golden moved** — C1's slab
re-model is render/coupe-only (BBS distribution count unchanged, byte-identical) and the only status flip is one
`pack_swap` cover assertion PASS→WARN (the new comfort band, not a golden). The standing engineer sign-offs
(G-BAEL/EC2/RPS/COUPE/TOL) + the owner GPU/visual passes remain open (acceptance, not code).
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
- **D-V103-8** (P8/G8 — 3D fidelity: concrete edges + stepped stair, implemented) **Viewport-only, no engine/core/`.rcfg` change** (spec §8, [REF-UI-840]). (a) **Crisp concrete edges:** `viewport/Viewport.tsx ConcreteVolume` now renders a drei `<Edges threshold={15}>` outline (light `#9aa3b2`) over both the RECT box and the CIRCULAR cylinder, so the transparent (opacity 0.3) volume reads as a solid block and the cage + G1's exiting endpoints stay legible — fixing the "half-empty" look. The shared transparent material was factored into a `concreteMaterial()` helper. (b) **Stepped stair:** a new `SteppedStair` component replaces the flat rect box **for E-STR-01 only** (a UI-level `doc.element === "E-STR-01"` check — this is the *adapter/viewport*, NOT `packages/core`, so the no-`if(elementType)` rule doesn't apply; the plan explicitly scopes it "UI, not core"). It builds `n_steps` **disjoint boxes** from the stair geometry (`g` going · `r` riser · `n_steps` · `flight_width` — read straight off the GenericDoc `geometry` map), each box spanning one going range along the member axis (+Y) and rising to its tread over the section-depth axis (+Z), solid-to-base → an unmistakable staircase silhouette; centred on the member frame to match the box it replaces. Each step carries its own `<Edges>`. **Scope/limitation (representative, owner-GPU-verified):** the true rise (`n·r`) far exceeds the flat-slab envelope `waist_t`, so the stepped mesh extends well beyond the old box in the depth plane and the waist bars (placed in the flat member frame) sit low in it — a faithful representative read, refined later if the owner wants the bars lofted onto the treads; the top **landing** (`landing_L`) is not modelled (kept aligned with the bar frame). Tests: none added (pure GPU render — build:web proves the drei `Edges` import bundles; the stair box math is trivial + owner-verified).
- **D-V103-9** (P9/G9 — camera fixes: roll / ViewCube / hand-pan, implemented) **Camera/interaction-only, session state, NOT in `.rcfg`** (spec §9, [REF-UI-811b/850]). (a) **Killed the auto-spin:** the F1 `RollController` (`viewport/Viewport.tsx`) no longer runs a per-frame `useFrame(…, 1)` that mutated `camera.up` + `lookAt` every frame (which, with `OrbitControls enableDamping`, precessed/auto-rotated the ViewCube). Roll is now a **discrete on-demand `useEffect`** keyed on `[rollRad, camera, controls]` — it applies `rollUpVector` (unchanged pure helper) once when the roll changes and re-levels `camera.up` to world-up when it clears (the camera-dep re-applies it after a perspective⇄ortho swap). (b) **Auto-level on orbit:** a second effect subscribes to OrbitControls' `"start"` event and **resets `rollRad` to 0** the moment the user begins any drag (removes the up-vector conflict; the cube stops rotating). (c) **Hand-pan tool:** new session store state `navMode: "orbit"|"pan"` + `toggleNavMode`/`setNavMode` (added to init + `reset()`, **not** persisted). The `Scene` derives `OrbitControls mouseButtons` from it — pan mode = `LEFT:PAN, RIGHT:ROTATE` (so orbit stays reachable), orbit mode = `LEFT:ROTATE, RIGHT:PAN`; MIDDLE dollies and the wheel zoom always. A toolbar **✋ toggle** in `ViewCube.tsx ViewControls` (`aria-pressed`, bilingual `view.pan`/`view.orbit` labels) flips it; keyboard-arrow pan is OrbitControls' built-in no-pointer path. Tests: `apps/web/src/viewport/nav_mode.spec.tsx` (default orbit; the button toggles navMode + aria-pressed; `setNavMode`/`toggleNavMode` store paths); `view_roll.spec` stays green (pure `rollUpVector` + roll buttons unchanged). The frame-loop removal + orbit auto-level + the actual pan feel are **owner-GPU-verified** (headless can't drive OrbitControls events).
- **D-V103-7b** (P7/G7 follow-up — beam support width/anchorage wired into the app exports, implemented) Closes D-V103-7 open item (b): the shop-drawing model already accepted `opts.supports` (bearing `width` + bottom-bar `anchorage` → the `V1 b=… l.a=…` labels), but the **web app never forwarded them**, so real PDF/DXF exports showed the V1/V2 tag with blank width/anchorage. Fixed end-to-end: (i) **DXF plumbing** — `dxf.ts buildDxf1`/`buildDxfCoupes` now accept `supports` and thread it into `shopDrawingToDxf` (previously hard-coded to none); (ii) **PDF per-type** — `ProjectPdfType` gained `supports?` and `buildProjectPdf` uses `t.supports ?? meta.supports` (per-beam, not one global set); (iii) **web adapter** — new pure `exportActions.beamSupportsMeta(doc)` extracts `{side,width,anchorage}[]` from a `BeamDoc` (`undefined` for non-beams), and `Navbar` passes it into `exportPdf`/`exportDxf` + every `ProjectExportType`. `exportDxf` gained an optional `supports` arg (back-compat). Tests: `apps/web/src/engine/export_supports.spec.ts` (extractor left/right; undefined for a column; the DXF output contains `b=300`/`l.a=400` when supplied, absent otherwise). **No engine/core change (all in exporters + web); `.rcfg` untouched; render goldens held** (the existing `shop_drawing`/`dxf1_golden` goldens don't assert the optional support extras, so no re-baseline).
- **D-V102-3** (P3/F3 — sticky per-zone readout, implemented) **UI-only, no engine/`.rcfg`/validation change** (spec §3.3): the per-zone provided area + `ZoneGeometry.d` already exist on `SolveResult`. New pure selector `ui/derived.ts perZoneReadout(result, doc, lang) → ZoneReadoutRow[]` — **one row per flexural zone** (`As,prov` vs `As,req`, `ok`, `d`, `perMetre`), driven off the validation `provided_area[:zone]` items + `result.zones` (the column's lone un-suffixed `provided_area` maps onto `result.zones[0]`; slab zones flagged `perMetre` → cm²/m). **Generic over all 8 elements**, no `if(elementType)`. The old single-aggregate `Badges` is **replaced** by `ZoneReadout` (`position: sticky; top:0` inside the scrolling `.sidebar`, full-width via negative margins; `role="status" aria-live="polite"`; per-zone rows green/red + an overall 🟢/🟠/🔴 status chip from `result.status`). Zone labels: generic zones use the doc's own `label_fr/_en`; column/beam use a new `i18n readout.zones` map (`As_total`/`As_span_bottom`/`As_top_support`/`As_top_montage`). Old `derived.ts` helpers (`asProvidedMm2` etc.) kept (still used by `store_resolve.spec`). Tests: `per_zone_readout` (column/beam/slab rows + FAIL flip + per-metre); `smoke` updated (queries `.readout`, readout survives a tab switch).

---

## 9. Handoff log (newest first — APPEND your entry here before you stop)

### 2026-07-08 — v1.0.4 **C1 slab-coupe exactness + D1/D2 (3D fidelity) + H10 + §7.12 cover WARN tier** — **CODE DONE, tested, green — NOT pushed** — by **Amer** (owner's local Windows PC)

**Context.** Continued from Zayd's `b0658c6` (pulled `--ff-only`; sanity check passed — Zayd's B3-3rd/E1/E2 entry was the newest §9). Owner's task list: C1 slab exactness (the big remaining GEOMETRY re-model), then D1/D2 (viewport 3D fidelity), then the small fill-ins (H10 + cover WARN). All CODE-ONLY; owner/engineer/GPU items left alone. Everything self-gated → **no BBS/cutLength/coupe golden moved**; one validation-status assertion updated (cover, called out).

**C1 — slab-family coupe exactness (`coupe_slab_exactness`), the geometry re-model.** A slab / stair-waist DISTRIBUTION (secondary) LINEAR bar now runs ACROSS the width (world-X) at SPAN stations — its true cross-direction geometry — replacing the pre-C1 representative model (distribution fanned along the span like short main bars → a 2nd row of dots in the coupe).
- **Core:** new `BarPosition.across?`/`axial?` (`types/layout.ts`); new pure `solveSlabDistributionBars(span, spacing, v, faceTag)` + `isDistributionLinear(role, shape)` (`layout/slab.ts`) — a DISTRIBUTION bar that is a discrete linear bar (not a welded MESH, not a coil). `pipeline/slab.ts` + `pipeline/stair.ts` thread the SPAN (`Lx` / `n_steps·g`) into the distribution builder; MAIN/TOP bars + the joist/two-way topping MESH keep the along-span `solveSlabBars` (byte-identical). `place.ts` renders an `across` bar as a cross-width line `[-b/2, axial, v … b/2, axial, v]`. `sectionAt.ts` generalises the §9.5.3 "nearest set behind" guarantee (was transverse-only) to DISTRIBUTION groups, so the transverse coupe ALWAYS reads main bars as dots + the distribution layer as a line — at any cut station, not only when it lands on a bar.
- **Scope/gating:** provided steel stays PER METRE (spacing-driven — validation unchanged). A two-way slab (mats) / any non-slab element has `across` never set → byte-identical. The 3D viewport benefits for free (placeBars is shared).
- **⚠ FLAG (owner/engineer):** the **BBS distribution COUNT** is deliberately LEFT at the pre-C1 representative value (`floor(Ly/spacing)+1`, kept in `group.count`) — **BBS byte-identical, no golden moved** (hard rule: the sanctioned exception is render/coupe, NOT BBS quantity). So the faithful render now shows distribution bars distributed along the SPAN while the BBS count is still width-derived — a known, flagged inconsistency. **Reconciling the distribution fabrication count to the exact along-span geometry is a fabrication-quantity change and wants owner/engineer sign-off** (a follow-up slice, not this turn).
- **⚠ G-COUPE conventions stay PROVISIONAL** (owner_tasks §B-7, visual acceptance §D-4) — proceeded on defaults.
- **Test:** `tests/coupe_slab_exactness.spec.ts` (9 — main-dots/dist-line placement, across-width extent, span stationing, the coupe reads dots+line, the nearest-behind guarantee off-grid, two-way-mesh legacy no-op, stair distribution across the flight width, determinism). **NO golden moved** — the existing slab tests only assert validation + `bars.length>0`, so the expected re-baseline never materialised.

**D1 — stair 3D fidelity (viewport-only).** Extracted the stepped-stair box geometry into the PURE `apps/web/src/viewport/steppedStair.ts` (`steppedStairSpec`, headless-tested) and **modelled the top `landing_L`** (previously ignored, D-V103-8) as a flat waist-thick slab extending past the flight at the top rise level. `Viewport.tsx SteppedStair` now just renders the boxes it returns. Test `apps/web/src/viewport/stepped_stair.spec.ts` (7). ⚠ bars-sit-in-treads / landing visual acceptance is the owner's GPU pass (§D-2).

**D2 — general indicative→faithful (viewport-only).** The welded MESH (two-way slab mats, joist topping) now renders as its true orthogonal WIRE GRID instead of a single mis-oriented panel outline: pure `meshGridBars(result)` (`viewport/rebarProps.ts`) expands a `TREILLIS_MESH` group into X-wires (across width at pitchY) + Y-wires (along span at pitchX) at the mat's layer depth; `buildScene` swaps the group's outline for the grid (non-mesh untouched). Edges + real bent centrelines (hooks/exit-lengths, G1) already render. Test `apps/web/src/viewport/mesh_grid.spec.ts` (7). ⚠ consolidated GPU acceptance across all 8 elements is the owner's pass (§D-3).

**H10 — hook edit never dropped mid-invalid (`hook_not_dropped`).** `FaconnageEditor.setHook` now validates + commits a hook change against the last-VALID params (`committed`), not the in-progress buffer — so a start/end hook edit lands even while a *parameter* is mid-invalid (the invalid param stays in its field, H17). Was: `tryGen(params, …)` threw on the invalid buffer → the hook change was silently swallowed. Test `apps/web/src/ui/hook_not_dropped.spec.tsx` (2). Spec I.C H10 marked LANDED.

**Cover WARN tier — §7.12 comfort-target amber band.** Cover BELOW the durability+fire minimum is 🔴 FAIL (unchanged); cover that MEETS the minimum but is below the comfort target `reqCover·(1+band)` is now 🟠 WARN; comfortably above → 🟢 PASS — same shape as clear_spacing/tie_spacing/Asw. New shared `coverItem(cover, reqCover, band, ref, ids)` (`validation/index.ts`), used UNIFORMLY across ALL element validators (column + the 3 profile validators in `profiles.ts`) so it's one "cover" rule, one behaviour (not column-only). Band = pack `warnBands.cover` (BAEL/EC2 default 0.1 — already reserved, was unused). ⚠ the band is **G-TOL PROVISIONAL** (owner_tasks §B-5). **One status flip:** `pack_swap` BAEL EXTERIOR c=30=min now WARN (at the bare minimum, below comfort 33) — assertion updated (a validation status, NOT a golden). Tests `tests/cover_warn.spec.ts` (7 — FAIL/WARN/PASS transitions + uniform across column & beam) + the `pack_swap` update.

**Gate (2026-07-08).** `npm run check` ✓ — **657 tests / 129 files** (+32 over 625/124: coupe_slab_exactness 9, cover_warn 7, hook_not_dropped 2, stepped_stair 7, mesh_grid 7); `npm run coverage` core **95.12%** (was 94.91% — now hits the 95 target); `npm run coverage:adapter` **96.76%** (no regression); `npm run build:web` ✓ (50.7s). **NOT pushed** (owner controls push).

**Flagged for the owner/engineer (new this turn):** (1) **C1 BBS distribution count** — the render/coupe are now exact but the BBS distribution *quantity* stays the representative width-derived count; reconciling it to the along-span geometry is a fabrication-quantity change needing sign-off. (2) **Cover comfort band** value (G-TOL, §B-5). (3) **G-COUPE** conventions still provisional (§B-7). (4) **D1/D2 GPU acceptance** (§D-2/§D-3). No new engineer sign-off items beyond these.

**Next (remaining to finalize v1.0.4).** Code is essentially complete: façonnage H1–H19, Tracks A2/A3, B1/B2/B3, C1(station-aware + slab-exactness)/C2, D1/D2, E1/E2 all landed. The only C-side follow-up is the *optional* C1 BBS distribution-count reconciliation (owner-gated). Everything else remaining is **people/acceptance** (the true 100% gate): engineer nomination (**B-1** 🔴) → sign-offs **B-2…B-9** (now incl. the cover comfort band B-5) + **B-8** record; owner data **C-1/C-2/C-8**; owner GPU/drawing acceptance **§D**; final UAT **§E**.

### 2026-07-07 (evening) — v1.0.4 **B3 (3rd slice) + E1 + E2** + backend↔frontend validation — **CODE DONE, tested, green — NOT pushed** — by **Zayd** (Hetzner dev box)

**Context.** Owner directed "continue for 3, 4, 5 [of the finalization checklist], validate for inconsistencies +
backend↔frontend compat, update docs, then list owner actions." Items 4 (B3 corner-diagonal) + 5 (E1/E2) landed;
item 3 (C1 slab-exactness) deferred with rationale (below). All self-gated → **no golden moved**.

**Item 4 — B3 corner-diagonal → As (`pipeline/element.ts`).** The supplement-accounting fold generalised: an **OPEN**
anchored add-on (SKIN bar OR CORNER-DIAGONAL, both run along the member) now credits its area to the As,prov + count
of the zone it reinforces (was `role === "SKIN"` only); a **CLOSED** tie (diamond) still credits Asw. Scope is exact:
only the 3 anchored archetypes (skin/diagonal/diamond) get an `anchor`, so head-hoops/double-stirrup/relevé add-ons
are untouched (the `!sup.anchor` guard). +1 test in `supplement_anchored_all`. Remaining B3: the diagonal's in-section
hook *orientation* is GPU-polish (position + As done).

**Item 5 — E1 + E2 (canonical `.rcfg` + migration).**
- **E1 (the biggest hidden gap):** pre-E1 `docToRcfg` emitted **empty** `baseGroups`/`supplementalGroups` (real data
  only in `meta.app_document`; passed tests, so nothing flagged it). Now: new pure **`reinforcementFromResult(result)`**
  (`exporters/canonical.ts`) maps the solved `groups[]` → canonical §10 `ReinforcingElement[]`, **element-agnostic**
  (role → distribution/placement: longitudinal `FIXED_COUNT`+`SECTION_PERIMETER`; transverse `SPACING_ALONG_PATH`
  uniform/segments + `ALONG_PATH`; skin/diagonal/diamond → `supplementalGroups`). `SolvedGroup` gained `params` +
  `supplementId` (populated in `element.ts` from the inputs). `docToRcfg` solves the doc + populates the arrays
  (try/catch → empty fallback so a bad doc still saves via `app_document`). `.rcfg` bumped **1.0 → 1.2** with an
  additive **version-only** migration (`1.0`/`1.0.2`/`1.1` → `1.2`, idempotent).
- **E2:** `migration_chain` corpus — every fixture migrates to current + `parse∘serialize∘parse` fixed point +
  `migrateRcfg` idempotent + a FUTURE version (9.9.9) loaded as-is (forward-compat) + unknown `TENDON` kind survives.
- **Backend↔frontend validation (throwaway probe, deleted):** all **8 elements** (`defaultDocFor`) → `docToRcfg` →
  serialize → parse → **recover the doc from `app_document`** = lossless; each populates ≥1 canonical base group at
  v1.2; every element is well-formed `REBAR_GROUP`. No circular import (rcfgDoc→solveDoc is acyclic; both typechecks
  clean). The canonical fill is **write-only for the SPA** (rcfgToDoc still reads `app_document`), so no round-trip
  coupling + no golden moved.

**Item 3 — C1 slab-exactness DEFERRED (rationale).** Making a slab's DISTRIBUTION (secondary) bars exact in the coupe
is a **geometry re-model**, not a drop-in: `layout/slab.ts` positions every zone's bars ACROSS the width and
`place.ts` runs them along the SPAN (the representative model); a faithful distribution layer must be regenerated as
bars running ACROSS the width at SPAN stations (a new bar set + the per-metre As mapping + the coupe). That is (a)
owner-gated on the G-COUPE conventions + visual acceptance `[§B/§D]` and (b) a re-baseline → its own scoped slice, not
a safe increment this turn. The non-gated C1 part (station-aware default coupe) shipped earlier today. `coupe_slab_exactness`
stays the open test.

**Tests (all green, +13 over 612).** `supplement_anchored_all` +1 (corner-diagonal→As), new `tests/migration_chain.spec.ts`
(9), new `apps/web/.../rcfg_canonical.spec.ts` (3). No golden moved.

**Green gate (2026-07-07).** `npm run check` ✓ — **625 tests / 124 files** (+13 over 612/122); `npm run coverage`
core **94.91%** (≥90 ✓); `npm run coverage:adapter` **96.76%** (up from 96.74); `npm run build:web` ✓. **NOT pushed.**

**Next (remaining to finalize v1.0.4).** Code: **C1 slab-exactness** (re-model, needs G-COUPE `[§B/§D]`); **D1/D2**
(stair + slab/mesh 3D fidelity, owner GPU); **H10** hook last-valid test; cover WARN tier (G-TOL). Everything else
(A2, A3, B1/B2/B3, C2, E1/E2, façonnage H1–H19 minus H10) is **code-complete**. People/acceptance (the true 100%
gate): engineer nomination (**B-1** 🔴) → sign-offs **B-2…B-9**; owner data **C-1/C-2/C-8**; owner GPU/drawing
acceptance (**§D**). See the "Owner actions" the owner has.

### 2026-07-07 (later still) — v1.0.4 **façonnage Phase-6 (H16/H17/H18/H19/H12) + H14 + B1 (per-bar splices)** — **CODE DONE, tested, green — NOT pushed** — by **Zayd** (Hetzner dev box)

**Context.** After an inspection audit (below), the owner directed "do items 1 and 2": the façonnage Phase-6 UI batch
+ H14→B1 splices. All self-gated → legacy byte-identical; **no golden moved** (two pre-existing test *assertions*
updated, called out below).

**Façonnage Phase-6 (apps/web + one core guard).**
- **H16** — the `FaconnageEditor` now honours the manifest `max`/`step` for every param (was hardcoded 20000/10 for
  length params). New optional `ShapeParam.step` (+ schema); falls back to a type default when unset. Proof: added
  `"step": 5` to `droite.json`'s `L`.
- **H17** — rich invalid feedback: on an invalid param edit the editor shows the generator's **real** reason
  (`.faconnage-error-detail`), keeps the **last valid sketch** on screen (a `lastSketchRef`), and marks the offending
  field `aria-invalid` (new `NumberField.invalid` prop). The edit is never visually "dropped".
- **H18** — `AddressableBars` copy now comes from the shared i18n bundle (`t(lang).addressable`, ~20 keys added to
  `strings.ts` FR+EN), replacing the inline `const tr = …`.
- **H19** — per-leg `min > 0`: the **core** `segment-grammar` generator throws on a non-positive straight leg (a 0/neg
  body run that would slip past the H3 cutLength guard when other legs compensate), and the length controls floor at
  1 mm. (Interaction: for a DROITE `L≤0` the leg guard now fires before the H3 cutLength guard — the pre-existing
  `cutlength_positive_guard` assertion was broadened to `/cut length|non-positive leg/i`.)
- **H12** (owner **A-7**) — a DROITE bar's length is coupled to the member (read-only display) with an explicit
  "custom length" toggle (`CoupledLength`); a non-DROITE bar keeps its param-driven editable length. (The new
  custom-length checkbox made `addressable_bars_ui`'s `getByRole("checkbox")` ambiguous → retargeted to the
  `.addressable-remove` checkbox.)

**H14 + B1 — per-bar lap splices on the addressable channel (core + adapter + UI).**
- **Types:** `LongBarOverride` + `ExtraLongBar` gain `splices?: Splice[]` (explicit, B1) + `autoSplice?: boolean`
  (H14); `PlacedLongBar` gains `splice?: SpliceResult`; `ElementSolveInput.stockLength?` (⚠ PROVISIONAL 12000).
- **`buildLongBars`** computes each bar's splice = explicit stations + (autoSplice ? `autoSplices(cutLength, stock)`)
  → `spliceBar`. Stored on the bar.
- **Schedule/drawing:** the BBS longBar path expands a spliced bar into its **segments** (`groupId#si`, one per bar) +
  a coupler tally (cutLength invariant preserved); `shopDrawing.sketchOf` now slices the segment's own centreline for
  addressable rows too (extended the C2 parent map to include spliced longBars).
- **B1 stagger:** new pure **`evaluateLapStagger(barStations, l0, totalBars)`** in `geometry/splice.ts` — the sourced
  EC2 §8.7.2 rule (≤ ½ of a zone's bars lapped within one **0.3·l0** section). `solveElement` groups the placed bars
  by zone, feeds each spliced bar's lap stations to it, and emits a per-zone `lap_stagger` **PASS/WARN**; each lap
  also pushes a per-bar extent into `lapExtents` so the seismic `lap_in_critical_zone` is exact per bar. The blanket
  per-group WARN is untouched (it only fires for zone-level grouped splices, which the addressable bars don't use).
- **Adapter + UI:** doc `BarOverrideEdit`/`AddressableBar` carry `autoSplice?`/`splices?` (ride `meta.app_document`,
  so `.rcfg` round-trips for free); `buildLongOverrides`/`buildExtraBars` thread them; a per-bar "Auto-split (stock)"
  checkbox in `AddressableBars`.
- **⚠ Flags:** the stock length is PROVISIONAL 12000 (owner §C — same value blocks nothing else now); the stagger
  rule value is the sourced EC2 default (owner/engineer confirm per market — owner_tasks **B-6**).

**Tests (all green, +17 over 595).** New `tests/leg_min.spec.ts` (4), `tests/splice_stagger.spec.ts` (7),
`apps/web/.../faconnage_phase6.spec.tsx` (6: H16 ×2, H19, H17, H18, H12). Updated 2 pre-existing assertions
(cutlength guard message; addressable remove-checkbox selector). No golden moved.

**Green gate (2026-07-07).** `npm run check` ✓ — **612 tests / 122 files** (+17 over 595/119); `npm run coverage`
core **94.91%** (≥90 ✓); `npm run coverage:adapter` **96.74%** (up from 96.73); `npm run build:web` ✓. **NOT pushed.**

**Audit finding (this session, pre-work).** A code inspection to find "hidden / marked-done-but-not" gaps surfaced,
most notably: **E1's canonical `.rcfg reinforcement[]` is an empty shell** (`rcfgDoc.ts` emits `baseGroups:[]`,
`supplementalGroups:[]` — real data only in `meta.app_document`; passes tests, so nothing flags it); the **cover
check has no WARN tier** (only FAIL/PASS — `validation/index.ts` §7.12 comfort band deferred); **slab-family coupes
stay representative** (C1 tail `coupe_slab_exactness`); BAEL `l_s≈44φ` vs tabulated 40φ (a G-BAEL item). See the
audit summary the owner has.

**Next (remaining to finalize v1.0.4).** Code: **E1/E2** (populate canonical `reinforcement[]` + unified idempotent
migrator, bump `.rcfg` v1.2); **C1 tail** (slab coupe exactness — needs G-COUPE `[§B/§D]`); **B3 tail** (corner-diagonal
→ As accounting + diagonal hook orientation); **D1/D2** (stair + slab/mesh 3D fidelity, owner GPU); **H10** hook
last-valid test; cover WARN tier (G-TOL). People/acceptance (the true 100% gate): engineer nomination (**B-1** 🔴) →
sign-offs **B-2…B-9** (now incl. the diamond-Asw model + stagger rule); owner data **C-1**/**C-2**/stock length;
owner GPU/drawing acceptance (**§D**).

### 2026-07-07 (later) — v1.0.4 **B3 (2nd slice) + C2 (shop-drawing completeness) + C1 (station-aware coupe)** — **CODE DONE, tested, green — NOT pushed** — by **Zayd** (Hetzner dev box)

**Context.** Owner directed: finish B3's deferred slice, then C2 → C1 (spec §7 step 5). Continued from Amer's
55f1376 (A2-review-fixes + B2 + B3-first-slice). Everything below self-gates so legacy docs are byte-identical —
**no golden moved** this session.

**B3 — 2nd slice (SKIN fanout + supplements → A2 accounting).**
- **SKIN multi-bar fanout.** `resolveSupplement` (`scheme/resolve.ts`) now returns `anchors[]` for SIDE_FACES —
  `count_per_side` bars on BOTH lateral faces (u = ±uMax), spaced evenly between the corner bars (bar k of n at
  `v = −vMax + k/(n+1)·2vMax`; n=1 ⇒ mid-height, reproducing the legacy representative). `position`/`angleDeg` mirror
  `anchors[0]` (right face first) for back-compat — the existing 1-bar callers + the first-slice test are unchanged.
  Diagonal/diamond also carry a single-entry `anchors` for a uniform adapter path. The adapter (`solveDoc.ts`
  `resolveDocSupplements`) emits **one `ElementSupplementInput` per anchor** (groupId `inst`, `inst#1`, `inst#2`…),
  so a skin group renders + schedules as N bars. Verified live: `count_per_side=2` on a 4-corner column → 4 SKIN
  groups (2 per face), each with its own anchor.
- **Supplements feed A2's steel accounting** (`pipeline/element.ts`, a new pass after the longBars reconciliation;
  hoisted `nearestFace`/`zoneForExtra` out so both passes share them). A **SKIN** bar is real longitudinal steel →
  its area joins the **As,prov + provided count** of the zone whose tension region its anchor sits in (the owner's
  extra→zone rule). `d` is LEFT on the extreme-tension layer — a mid-face skin bar does not lower the lever arm
  (conservative + honest; avoids the beam extra→zone limitation Amer flagged). An interior **DIAMANT** tie (a closed
  supplement, `shape.closed`) adds provided **Asw/m** to every transverse zone, credited at the *geometrically
  derived* orientation factor **`cos(inclination)`** (a 45° diamond ⇒ ~0.707 of a vertical leg) via new optional
  `SolvedTransZone.aswProvExtraPerM` / `ColumnZoneInputs.aswProvExtraPerM` (threaded into the beam/circular Asw
  blocks in `profiles.ts` + the column block in `index.ts`; absent → 0 → byte-identical). **⚠ FLAG (engineer /
  G-BAEL/EC2):** the diamond leg-crossing model (2 legs · `cos(inclination)`) is *derived geometry, not an invented
  constant*, but the leg-count/orientation **convention needs professional sign-off** before it's relied on. It is
  conservative-ish and self-gated (no diamond add-on → no change).

**C2 — shop-drawing completeness (`exporters/shopDrawing.ts`).**
- **Segment-row sketches.** A spliced bar is scheduled as SEGMENTS (`groupId "L1#si"`); the pre-C2 `sketchOf` split
  on `#` and drew the *whole* parent bar for every segment row. Now: new `segmentArcBounds(segments, lapLength, run)`
  reconstructs each segment's developed `[from,to]` window (geometric extent = `cutLength − (lapForward?lap:0)`, so
  the windows tile the run exactly) + `sliceCenterline2D(c3, from, to)` returns the segment's own 2D sub-centreline.
  So each segment row's thumbnail is its own piece (verified: a mid-spliced 6000 span bar → two ~3000-extent
  sketches, not the full bar). Non-spliced rows unchanged.
- **Robust leader anti-overlap.** Labels now fan on a rail **stretched** so consecutive labels are always ≥ a
  legible pitch (`minSep = max(halfH·0.35, 55)`) apart, centred on the envelope — was an even fan that stacked when
  `span/(n−1) < text height`. In anchor order (sorted), so leaders don't cross.
- Both flow through **pdf.ts / dxf.ts unchanged** — they already consume `row.sketch` + `leader.to`, and the PDF
  fit-bbox already spans the leader anchors. All shop-drawing / BBS / DXF goldens held.

**C1 — station-aware coupe (`section/sectionAt.ts`).**
- `defaultCoupeFor` now seeds the default cut at the **richest station** — the along-member station that crosses the
  MOST longitudinal bars (`richestStation` over `placeBars` world-Y ranges of the PRIMARY_LONGITUDINAL/DISTRIBUTION
  members) — so an offset/bent/relevé/extra bar a mid-span cut would miss is revealed. Mid-length wins on ties /
  equal counts, and the whole thing is **gated to `result.longBars` present** (the addressable channel); a plain
  grouped element keeps `length/2` exactly → **every coupe/DXF golden held**.
- New pure `suggestCoupeStations(result)` (auto-exported via `section/index`) → mid + each partial-length bar's
  midpoint, sorted/deduped, for the UI's "auto-suggest a cut where the detailing is".
- **⚠ FLAG (owner_tasks §B-7 / G-COUPE):** the coupe conventions (near-parallel angle, look-behind, cutting-line/tag
  style, default station) stay **PROVISIONAL** — proceeded on defaults, acceptance pending. **Remaining C1:**
  slab-family coupe exactness (`coupe_slab_exactness`) not yet done (deferred — needs the ratified conventions +
  owner visual acceptance).

**Tests (all green, +17 over 578).** `supplement_anchored_all` +6 (SKIN fanout ×2, skin→As ×2, diamant→Asw, legacy
no-op); new `shop_drawing_c2.spec.ts` (6: segment-sketch extent, legacy full-bar sketch, leader min-pitch, distinct
anchors, determinism); new `coupe_station_aware.spec.ts` (5: mid-length legacy default, richer-station shift reveals
more bars, `suggestCoupeStations` mid + offset station, determinism). Prior goldens (bbs/dxf/coupe/section) held.

**Green gate (2026-07-07).** `npm run check` ✓ — **595 tests / 119 files** (+17 over 578/117); `npm run coverage`
core **94.6%** (≥90 ✓); `npm run coverage:adapter` **96.73%** (was 96.72% — up); `npm run build:web` ✓. **No golden
moved.** **NOT pushed** (owner controls push, `cross_projects_policy §10`).

**Next.** Per spec §7 step 5–7: **C1 slab-exactness** slice (needs G-COUPE conventions `[§B/§D]`), **B1** (per-bar
splice stagger — rides H14; stagger rule sourced EC2 ≤50%/0.3·l0), then **E1/E2** (canonical `.rcfg` `reinforcement[]`
+ migration consolidation), **D1/D2** (viewport fidelity, owner GPU). **A1** (fill packs from `structural_data.md` +
reference-case suite) runs in parallel. **Two conventions now awaiting engineer sign-off (added this session):** the
diamond-tie Asw leg-crossing/orientation model (B3) and — standing — the extra→zone beam convention (A2, Amer's
flag). Owner long-lead items unchanged (engineer nomination §B-1; RPS zone→ND §C-1; G-COUPE ratification §B-7).

### 2026-07-07 — v1.0.4 **A2 review (adversarial) + two verdict-fixes** + **B2 (beam two-support precision)** + **B3 (supplement anchoring, first slice)** — **CODE DONE, tested, green — NOT pushed** — by **Amer** (owner's local Windows PC)

**Context.** Owner directed: review Zayd's A2/H8 core-engine work adversarially, then resume to finalize v1.0.4.
I reviewed it as an adversary and found **two reachable wrong-🟢 verdicts** in the addressable channel (the exact
class A2 exists to close), fixed both, and implemented **B2** (spec Part III). Reproduced both bugs against the live
engine before fixing (throwaway probes, deleted).

**Review of A2/H8 — verdict.** The numeric core (exact mixed-Ø `As`/`d` via area-weighted centroid, per-region
governing Asw, clear-spacing fold, extra→zone by nearest tension face) is **sound and legacy byte-identical**
(the A2/H8 blocks self-gate on `longBars`; `asProvExact`/`aswSpacing`/`computeZoneGeometryWeighted` reduce to the
old values when uniform — confirmed by code trace + the held goldens). **But A2's "every steel add/remove feeds the
checks" promise had two holes** — the reconciliation folded `As`/`d`/`Asw`/spacing but left `min_bars`, `face_min_bars`
and `cover` on the nominal layout / group-Ø:

- **Finding 1 (fixed) — removing bars below the code minimum stayed all-green.** `min_bars`/`face_min_bars` read
  `layout.count`/`layout.underfilledFaces`, never reduced by removals. Probe: a rect column, 6Ø20 → 3 removed,
  `asReq` low → `provided_area` PASS, `min_bars` PASS **value 6** (the layout count), overall **PASS 🟢** — an
  un-buildable 3-bar column exported green. **Fix:** the pipeline now threads the **real placed count**
  (`placedCount = longBars\{removed}`) and **per-face counts** (`faceCounts` reduced by removed bars via a
  corner-aware `faceMembership`, so it stays exactly consistent with the layout's shared-corner convention) into the
  column validator; `min_bars`/`face_min_bars` judge the real set. Grouped docs pass `undefined` → the validator
  falls back to the layout counts → **byte-identical**.
- **Finding 2 (fixed) — an oversized per-bar Ø override silently ate the cover.** `addressable_section_bounds` only
  looked at standalone extras, and the grouped `cover` check reads the group Ø (and `phiLMax` excludes override
  diameters). Probe: corner Ø20 → override Ø40, cover 30 → `section_bounds` **ABSENT**, `cover` **PASS 30**, overall
  **PASS 🟢**, while the real cover to the Ø40 surface is ~28 mm. **Fix:** `addressable_section_bounds` now judges
  every **FOCUS** bar (standalone extra **or** Ø-override) against the `cover+Ø/2` envelope with its real Ø, so an
  enlarged override that breaks the cover envelope → 🔴 (blocks export). Legacy grouped docs have no focus bars → no
  item → byte-identical.

**Convention accepted, flagged for A1 (deliverable b).** The extra→zone rule (`nearestFace`) is fine for columns
(total steel) but for **beams** it (i) ignores the axial station — an extra near the right support credits the
**first** TOP zone (the left chapeau on an asymmetric beam), and (ii) credits full area regardless of lever arm
(a mid-depth bar counts fully toward a flexural zone). Recommend the A1 engineer specify "tension-side of the
neutral axis + axial-extent match" before beam extras are relied on. Nits noted: `computeZoneGeometryWeighted`
reassociates the `d` arithmetic (observably identical after `round()`, goldens hold); `memberLength` falls back to
section `h` for a non-column/beam addressable doc (unreachable today); `section_bounds` envelope omits `phiT` (as
authored — an A1 convention confirm).

**B2 — beam two-support precision (spec Part III B2).** Rides the existing supports data + addressable channel; no
element branch.
- **Per-support axial placement:** new optional `ElementLongInput.axisStart` (per-zone axial start); `beamInput` sets
  the left chapeau at 0 and the **right chapeau at `L − extension`** (over its support). `buildLongBars` honours it
  for base + shortfall bars, so a beam on the addressable channel (relevés/overrides) renders the right chapeau at
  the right support instead of station 0. The grouped fast path is unchanged (representative) → legacy byte-identical.
- **Per-support anchorage (§7.7):** new `ElementSolveInput.supports` / `ProfileContext.supports` (`SupportInput`);
  `validateBeamProfile` adds `support_anchorage:left`/`:right`, each checking the support's provided anchorage vs a
  **hooked** design `l_bd` (end-support bottom bars are hooked — `hooked?` added to `AnchorageArgs`, BAEL
  `hookedFactor` 0.4 / EC2 new `alpha1Hooked` 0.7; both inert when `hooked` is unset → every existing `lbd` caller
  byte-identical). The default symmetric beam (anchorage 400 ≥ ~337 hooked l_bd) PASSes → legacy-safe.

**B3 — supplement/add-on anchoring (spec Part III B3, first slice).** Diagnosis: non-épingle supplements
(skin/diagonal/diamond) rendered **centred at the origin** (`section/place.ts` supplement path: `placeLoop(cl, L/2)`
— no anchor), and the resolver computed a real `position` only for `LINK_BAR_PAIR`. **Fix (pure + render):**
`resolveSupplement` now resolves a real section placement (+ new `ResolvedSupplement.angleDeg`) for **SIDE_FACES**
(skin → lateral face at mid-height), **CORNER_DIAGONAL** (→ the bound corner pair's midpoint + orientation, WARN on
a deleted ref), and **INTERIOR_DIAMOND** (→ centred, rotated 45°). The anchor threads `ElementSupplementInput.anchor`
→ `SolvedGroup.anchor` → `placeBars`, which now renders an OPEN supplement (skin/diagonal) **longitudinally at its
(u,v)** and a CLOSED loop (diamond) at its anchor — instead of centred at the origin. **Legacy-safe:** a supplement
with no resolved position falls back to the centred presence render (byte-identical); épingles are unchanged (their
own anchored cross-tie path). **Deferred (next B3 slice + owner GPU):** SKIN multi-bar fanout (`count_per_side` + the
opposite face — currently one representative bar on the near face), feeding supplements into A2's As/Asw accounting,
and the in-section orientation of the longitudinal diagonal (position landed; precise hook rotation is GPU-polish).

**Tests.** New `tests/addressable_validity.spec.ts` +4 (oversized-Ø FAIL+lock; min_bars-below-min FAIL+lock;
corner-removal → face_min FAIL; grouped byte-identical). New `apps/web/src/engine/beam_support_precision.spec.ts`
(6: axial placement L/R, rendered right chapeau reaches L, plain-beam grouped, two anchorage checks PASS, asymmetric
short anchorage WARN, column has none). New `tests/supplement_anchored_all.spec.ts` (5: SIDE_FACES / CORNER_DIAGONAL
(+deleted-ref WARN) / INTERIOR_DIAMOND positions + angles, min_bars gate). All prior goldens held (no BBS/cutLength move).

**Green gate (2026-07-07).** `npm run check` ✓ — **578 tests / 117 files** (+15 over 563/115: B2 web suite +6,
addressable_validity +4, supplement_anchored_all +5); `npm run coverage` core **93.32%** (≥90 ✓); `npm run
coverage:adapter` **96.72%** (was 96.62% — up); `npm run build:web` ✓. **No golden moved** (all fixes + B2 + B3 are
legacy byte-identical). **NOT pushed** (owner controls push, `cross_projects_policy §10`).

**Next.** Per spec §7 step 5, remaining: **B3 next slice** (SKIN multi-bar fanout + supplement→A2 accounting +
diagonal orientation), **C2** (shop-drawing completeness), **C1** (coupe station-aware — needs `[§B/§D]` G-COUPE),
then **B1** (per-bar splice stagger), **E1/E2** (canonical `.rcfg` + migration), **D1/D2** (viewport). **A1** (fill
packs from `structural_data.md` + reference-case suite) runs in parallel. Owner long-lead items unchanged (engineer
nomination §B-1; RPS zone→ND §C-1). Owner calls outstanding (non-blocking): the extra→zone beam convention
(deliverable b above) — a G-TOL/A1 item; and the supplement-anchoring 3D fidelity is an owner GPU pass (D-3).

### 2026-07-06 (night, later) — v1.0.4 **A2 COMPLETE — steel accounting (+H5) + per-region Asw + clear-spacing fold** — **CODE DONE, tested, green — NOT pushed** — by **Zayd** (Hetzner dev box)

**Context.** Owner directed "continue to A2 steel accounting" after H8. A2 makes *"change a bar → the verdict
updates"* true: every steel add/remove must feed §7, not just the grouped count.

**Owner design decision (2026-07-06).** Asked whether independent **extras/supplements** count toward As or stay
detailing-only (they conflicted: the v1.0.3 model + `independent_bars` test pinned "extras don't change As", but A2
+ `structural_data §1` say count them by region). **Owner chose: count them** — an extra is real steel; it
contributes π/4·Ø² to the As,prov of the zone whose tension region its `(u,v)` sits in, and enters the
area-weighted `d`. This intentionally **re-baselines** two pinned tests (called out below).

**What I did (core-only — `layout/rect.ts`, `validation/index.ts` + `profiles.ts`, `pipeline/element.ts`).**
- **`computeZoneGeometryWeighted`** (`layout/rect.ts`): area-weighted centroid `d`/`d'` over an arbitrary placed
  set (per-bar area), exact for **mixed Ø + mixed levels**. `computeZoneGeometry` (uniform-Ø) now delegates to it
  → the grouped path is byte-identical.
- **Steel-accounting pass** (`element.ts`, after `buildLongBars`, before validation — `buildLongBars` hoisted up):
  when the addressable channel is active (`longBars` present), each longitudinal zone's `asProv`, `providedCount`
  and `geometry` (d) are recomputed from the real placed set: base/override bars mapped by `groupId` (Ø from the
  override, `removed` excluded), standalone extras assigned to a zone by the **nearest-tension-face region rule**
  (`structural_data §1`; edge conventions confirmed in the A1 engineer review). `SolveResult.zones` kept in sync.
- **Column threading**: `validateColumn` recomputes As internally, so I added optional `ColumnZoneInputs.asProvExact`
  (the profile passes `lz.asProv`); absent → the grouped `N·barArea` path, byte-identical. Beam/circular/slab
  already read `lz.asProv`/`lz.geometry.d`, so they picked up the exact values with no signature change.
- **H5** folds in as the removal slice (removing a bar drops As,prov by that bar's area).
- **Scope note:** `min_bars`/`face_min` still count the layout bars (not reduced by a removal) — deliberately out of
  the As-focused slice (a removal changes As, not the minimum-bar-count rule).

**Per-region Asw (D-V102-5).** `SolvedTransZone.regions` now threads the F5 region list into the profiles;
`governingAswSpacing(tz)` returns the **widest** region's spacing (the sparsest stretch = least steel/m), and
`asw_leg_count` is checked on it (beam/circular directly; column via the new optional `ColumnZoneInputs.aswSpacing`).
The tie/stirrup **spacing-max** check still uses the representative `tz.spacing` (per-region max-spacing there would
collide with the seismic `region_crit_spacing` overlay's intent). Uniform/no-region set → `tz.spacing`, byte-identical.

**Clear-spacing fold.** H8's `addressable_clear_spacing` predicate now judges every **FOCUS** bar — a standalone
extra OR a per-bar Ø override — against the real placed set (was: standalone extras only). So an override whose
enlarged Ø crowds its grid neighbour FAILs where the grouped face-based `clear_spacing` (which only knows the group
Ø) still passes. `AddressableBarView.focus` set in `element.ts` (`standalone || Ø-override`); still self-gated →
legacy docs (no `longBars`) untouched.

**Tests (all green).** New core: `tests/steel_accounting.spec.ts` (4), `tests/removal_reconciles_as.spec.ts` (2),
`tests/per_region_asw.spec.ts` (3 — governing region FAILs where representative passes; single region byte-identical),
`tests/clear_spacing_addons.spec.ts` (3 — grouped grid passes, Ø-override + crammed-extra FAIL). **Re-baselined
intentionally (owner decision — extras count):** `tests/independent_bars.spec.ts`, `apps/web/.../addressable_bars.spec.ts`.
**Flipped (sanctioned):** characterization `[WILL-CHANGE H5] → [H5 LANDED]`. H8 `addressable_validity` Ø-only-override
case updated (the fold now spacing-checks it → PASS on the wide grid). Held: `bar_overrides`, `transverse_regions`,
all grouped goldens byte-identical.

**Green gate (2026-07-06).** `npm run check` ✓ — **563 tests / 115 files** (+12 net over H8's 551/111); `npm run
coverage` core **94.15%** (≥90 ✓); `npm run coverage:adapter` **96.62%** (unchanged); `npm run build:web` ✓. Two
intentional golden re-baselines (extras→As); no other golden moved. **NOT pushed** (`cross_projects_policy §10`).

**Next.** A2 is complete. Per spec §7: **B2** (beam two-support precise placement + per-support anchorage), **B3**
(supplement/add-on 3D anchoring), **C2** (shop-drawing completeness), **C1** (coupe station-aware — needs the
`[§B/§D]` G-COUPE conventions), then **B1** (per-bar splice stagger), **E1/E2** (canonical `.rcfg` + migration),
**D1/D2** (viewport). **A1** (fill packs from `structural_data.md` + reference-case suite) runs in parallel — it is
the long-lead engineer-sign-off enabler. Owner long-lead items unchanged (engineer nomination §B-1; RPS zone→ND §C-1).

### 2026-07-06 (night) — v1.0.4 **Phase 4 (H8 — addressable-bar validity)** — **CODE DONE, tested, green — NOT pushed** — by **Zayd** (Hetzner dev box)

**Context.** Owner resumed the v1.0.4 build after pulling Amer's local Phase 2/3 + A3/H13 work. Baseline verified
green on pull (543/110). Owner drove the next phase = **Phase 4 (H8)**, and confirmed the spacing constants
(dg=20, k1=1.0, k2=5, from `structural_data.md §2`).

**H8 — geometric validity for the ADDRESSABLE channel (per-bar overrides + independent extra bars).** This is the
one class of steel the grouped, face-based `clear_spacing` never sees. Three pure predicates over the resolved
`longBars[]`, tiered per the owner's **A-5** ruling:
- `addressable_axial_extent` — a live bar whose `[axisStart, axisStart+run]` leaves `[0, memberLength]` → 🔴 FAIL
  (past-end or negative start). `run` = the developed extent of the centreline along the local-frame run axis
  (`u` = index 0 of the flat `[x,y,z,…]`), computed by a new `runExtent` helper in `element.ts`.
- `addressable_section_bounds` — a standalone extra whose `(u,v)` breaks the **cover envelope** (`cover + Ø/2` off a
  face, i.e. the bar pokes out of the concrete/cover) → 🔴 FAIL. (Section frame: origin at centre, `u`∈±b/2,
  `v`∈±h/2 per `layout/rect.ts`.)
- `addressable_clear_spacing` — a standalone extra closer than `max(k1·Ø, dg+k2, 20) = max(Ø, dg+5, 20)` to any
  **axially-overlapping** bar (base or extra) → 🔴 FAIL below the minimum, 🟠 WARN if merely tight (within the pack
  spacing band). **Divergence from the (outdated) `impl_plan` Phase 4**, which said spacing WARN-only: the as-built
  follows the owner's **A-5 tiered** decision (block below the code minimum, warn if tight).

**Where.** All in `packages/core` — `validation/predicates.ts` (`validateAddressableBars` + `AddressableBarView`/
`AddressableSectionCtx` types, decoupled from `PlacedLongBar` to avoid a pipeline↔validation import cycle) and
`pipeline/element.ts` (wiring after `buildLongBars`, before the status rollup, + `runExtent`). **No adapter/UI/
`.rcfg` change.**

**Legacy-safe by construction.** The predicates run only when `longBars` exists (overrides/extras present — a plain
doc keeps the grouped fast path, no `longBars`), and self-gate to real addressable content: a benign **Ø-only**
override (no standalone extra, `axisStart` 0, no violation) emits **zero** addressable items. So every legacy golden
+ the adapter characterization hold byte-identical. **A2 will fold this spacing predicate into the general validator**
so grouped bars are judged over the same real placed set (spec A2).

**Tests (all green).** New `tests/addressable_validity.spec.ts` (8, core): valid extra PASS + no export block;
out-of-concrete extra FAIL + `status==FAIL` (export-lock); past-end + negative-start axial FAIL; two extras
merely-tight WARN; two extras below-min FAIL + export-lock; legacy doc (no `longBars`) emits no addressable rule;
Ø-only override emits no addressable rule.

**Green gate (2026-07-06).** `npm run check` ✓ — **551 tests / 111 files** (+8 over Phase-3/A3's 543/110);
`npm run coverage` core **93.88%** (≥90 ✓); `npm run coverage:adapter` **96.62%** (unchanged — core-only change);
`npm run build:web` ✓. No golden moved. **NOT pushed** (awaiting owner's word, `cross_projects_policy §10`).

**Next (owner-directed).** **A2 — steel accounting** (the systemic validation-completeness win): one pass that
reconciles *every* placed bar (group/override/extra/relevé/supplement) into per-zone `As,prov = Σ(π/4)·Øᵢ²` (exact,
mixed-Ø) + area-weighted-centroid `d`, per-region `Asw`, and clear-spacing over the real placed set (absorbing H8's
predicate). Uses the same dg/k1/k2 just confirmed. H5 is A2's first slice. Owner long-lead items unchanged
(engineer nomination §B-1; RPS zone→ND §C-1).

### 2026-07-06 (evening) — v1.0.4 **Phase 3 complete (H7)** + **A3/H13 (EC2 reachable)** — **CODE DONE, tested, green — NOT pushed** — by **Amer** (owner's local Windows PC)

**Context.** Owner: "continue and fully finalize" the backend↔frontend parity gaps. The two open items were H7
(extras on the picker/coupe) and A3/H13 (EC2 pack built but unreachable). Both now closed.

**H7 — extras on the section picker + coupe.**
- Store: new `selectedExtraId: string | null` + `setSelectedExtraId`, mutually exclusive with `selectedBars`
  (reset clears both).
- `SectionPicker` gained optional `onPickExtra` / `selectedExtraId` props: when provided it renders the standalone
  `result.longBars` (not in the layout `bars`) as distinct square markers + a dashed keyboard-list entry, pickable by
  their stable id.
- `AddressableBars` wires the two picks mutually exclusively and highlights the selected extra's editor `<li>`
  (`aria-current` + `.addressable-extra-selected`).
- The **coupe already shows extras** — `sectionAt` builds over `placeBars(result)` which includes standalone bars;
  pinned by a confirmation test (no code change needed there).

**A3/H13 — BAEL↔EC2 reachable.**
- `doc.codePack?: "BAEL" | "EC2"` (additive, default BAEL) on all three doc types; `.rcfg` canonical `codePack`
  follows it (BAEL→"BAEL-FR", EC2→"EC2") and the lossless `meta.app_document` carry round-trips it.
- Adapter: `packFor(id)` returns one of two packs built once (`makeEc2Pack()` is structurally `CodePack &
  PackExtras` — identical shape to `BaelPack`, so the whole adapter stays typed against `BaelPack` and **the engine
  is untouched**, D-P1-3). `solveDoc` defaults `code = packFor(doc.codePack)`; the pack is threaded through
  `buildLongOverrides`/`buildExtraBars`/`applyUniqueLength`.
- `FaconnageEditor` previews with `packFor(doc.codePack)` — same pack as the solve (H13).
- UI: a **BAEL/EC2 picker** in the Projet/Code tab (`setCodePack`), typed i18n `codePack` (FR/EN).
- **Note on current EC2 data:** the provisional EC2 pack still shares BAEL's mandrel/bendDeduction, so a bar's
  cutLength is pack-independent *today* (expected — EC2 constants are filled by A1 from `structural_data.md`). What
  already differs and is checked: `codeRef`, `tieDiameterMin` (φℓ/3 vs φℓ/4) → the `tie_diameter` verdict **flips**
  BAEL(FAIL)↔EC2(PASS) for long Ø25 + tie Ø7, proving the pick is threaded end-to-end.

**Tests (all green).** New: `picker_shows_extras` (2), `coupe_extras` (2), `code_picker` (3, doc+rcfg round-trip +
legacy default), `bael_ec2_structure_identical` (2, structure invariant + packs distinct), `active_pack_consistency`
(3, editor==solve + verdict flip). Held: all legacy goldens + characterization (default docs → BAEL, byte-identical).

**Green gate (2026-07-06).** `npm run check` ✓ — **543 tests / 110 files** (+12 over Phase-3-partial's 531/105);
`npm run coverage` core **93.65%** (≥90 ✓); `npm run coverage:adapter` **96.62%** (was 96.46% — up); `build:web` ✓.
No golden moved. Not pushed.

**Backend↔frontend parity: CLOSED.** Every model field the adapter/core supports is now exposed + wired in the UI.
Remaining v1.0.4 work is net-new capability, not parity: Phase 4 **H8** (addressable validity tiers, owner A-5),
A2 steel accounting, B/C/D/E tracks, and Phase-6 polish (H10/H12/H16/H17/H18/H19) — plus the tracked `withDoc`
checkout/import guard. Owner long-lead items unchanged (engineer nomination §B-1; RPS zone→ND §C-1).

### 2026-07-06 (later still) — backend↔frontend parity audit + v1.0.4 **Phase 3 partial** (H15, H6) — **CODE DONE, tested, green — NOT pushed** — by **Amer** (owner's local Windows PC)

**Context.** Owner asked to "ensure the codebase is fully consistent, beginning with features present in the backend
(model/adapter/core) but not finalized in the frontend." I audited the ElementDoc model vs the store actions vs the
UI components.

**Audit result — the codebase is consistent; the only backend-ahead-of-frontend gaps are the tracked v1.0.4 items:**
- ✅ Per-bar overrides (shape/hooks/Ø/length/axial/remove) — full UI in `AddressableBars`. Splices+autoSplice — full
  UI (`SpliceEditor` in `Sidebar`, wired via `setLongitudinal`/`setSpan`; **not** a gap as I first suspected). Beam
  two-supports, relevés, topBars, cross-ties, regions, seismic, generic flags — all wired (every store setter is
  referenced by a UI component).
- ❌ **H6** — independent extra bars exposed only u/v/Ø though `AddressableBar` carries shapeId/faconnage/length/
  axialPos. **FIXED this session.**
- ❌ **H15** — `addExtra` used `X${length+1}` → id collision after a middle remove+add. **FIXED this session.**
- ❌ **H7** (still open) — standalone extras live in `result.longBars` (with `standalone:true`); the `SectionPicker`
  renders only `result.bars` (the layout set), so extras aren't selectable on the picker / shown in the coupe.
- ❌ **A3/H13** (still open) — `makeEc2Pack` exists in `packages/codepacks` but `solveDoc` hardcodes `baelPack`;
  there's no store `activePack` and no BAEL↔EC2 code picker in the UI.

**What I did (UI-only, `AddressableBars.tsx` + 2 specs; no model/adapter/core change):**
- **H15.** `freshExtraId` assigns the first free `x{n}` — collision-free, reuses a freed slot.
- **H6.** Each independent extra now renders its full editor: shape select + reused `FaconnageEditor` (params/hooks/
  live sketch) + length (drives the principal leg via the Phase-2 H2 inversion) + axial position, on top of u/v/Ø.
  The adapter's `buildExtraBars` already threaded all of this, so it flows to 3D/coupe/BBS/DXF immediately.

**Tests (all green).** New: `extra_bar_ids` (H15, 1), `independent_bar_full_ui` (H6, 2 — UI exposure + the shaped
extra solves to a standalone bar with cutLength==length). Held: `addressable_bars_ui`, `faconnage_editor`.

**Green gate (2026-07-06).** `npm run check` ✓ — **531 tests / 105 files** (+3 over Phase 2's 528/103); `build:web`
✓ (33s). Core/adapter coverage untouched (UI-only change). Not pushed.

**Next.** Finish Phase 3 with **H7** (render standalone extras on the `SectionPicker` + confirm the coupe shows them
at level `v`; select-by-id opens the extra's editor — needs a small extra-selection channel distinct from the
layout-bar `selectedBars`). Then **Phase 3.5 = A3+H13**: a store `activePack` (BAEL/EC2) threaded into `solveDoc` +
`FaconnageEditor`, and a code picker in the Projet/Code tab (`.rcfg` additive). Owner long-lead items unchanged.

### 2026-07-06 (later) — v1.0.4 **Phase 2** (façonnage capability: H11, H9, H2) — **CODE DONE, tested, green — NOT pushed** — by **Amer** (owner's local Windows PC)

**Context.** Second implementation slice, per `v1.0.4_impl_plan.md` Phase 2 (order H11 → H9 → H2). Owner decisions
A-1 (length = fabricated cut length) + A-2 (principal legs: u_bar→`w`, zbar→`run2`, stepped→`run3`, others per
P0.4) were already recorded. Built on Phase 1's green baseline.

**What I did (manifests + `packages/core` type/integrity + adapter + UI; no `.rcfg`/schema change):**
- **H11 (valid seeds).** Authored a `default` for every open-shape length param missing one (crochet_l a=1000/b=200,
  u_bar h=300/w=1500, baionnette lower=2000/crank=150/upper=800, releve bottom=2000/incline=600/top=800,
  attente foot=300/h=800; zbar/double_crank/stepped already had them). New shared **`defaultParams(shape,
  memberLength)`** in `solveDoc.ts` — reads manifest defaults, drops the old positional `i===0 ? memberLength :
  memberLength/6` guess; only DROITE's `L` (intentionally undefaulted) tracks the member length (H12 coupling). The
  FaconnageEditor UI now imports it (single source of truth for seeds).
- **H9 (guarded pick).** `pickShape` runs the seed through `generateBarShape` before committing — never switches the
  store to a shape whose default sketch is invalid (belt-and-suspenders over H11).
- **H2 (unique length → principal leg).** Added **`ShapeArchetype.totalLengthParam`** (core type) + a manifest value
  on all 9 open shapes (A-2 legs), plus an integrity check that it names a real param key. Adapter **`applyUniqueLength`**
  inverts the linear `totalLengthExpr`: since cutLength = `Σ legs + hookAllowances − bendDeductions`, the principal
  leg appears once with unit coefficient, and hooks/deductions depend only on Ø+angle, the inversion is exactly
  `principalLeg += length − cutLength_current` (computed with the same Ø+hooks). Wired into `buildLongOverrides` +
  `buildExtraBars`, replacing the DROITE-only `{...,L:length}` hack. A too-short length drives the leg ≤0 → the core
  H3 guard rejects it → Phase-1 keep-last-good banner. Result: `cutLength == length` (±<0.01) on every open shape.

**Tests (all green).** New: `manifest_defaults_valid` (19 — every default seeds valid + totalLengthParam is real +
no positional guess), `unique_length_semantics` (12 — length==cutLength on all 9 shapes + per-bar + hook-absorbing +
extra bar), `pickshape_guard` (9 — every shape picks to a valid committed seed). Flipped: characterization H2 case
`[WILL-CHANGE H2] → [H2 LANDED]` (length now sets cutLength). **Deleted** the temporary `faconnage_p02_verify` probe
(H1+H2 both landed; its cases are now covered by `bar_override_inherits_faconnage` + `unique_length_semantics`), per
the impl-plan standing rule.

**Green gate (2026-07-06).** `npm run check` ✓ — **528 tests / 103 files** (+36 over Phase 1's 492/101);
`npm run coverage` core **93.65%** (≥90 ✓); `npm run coverage:adapter` **96.46%** (was 96.34% — no regression);
`npm run build:web` ✓ (27s). No BBS/cutLength golden moved (legacy DROITE docs seed L=memberLength exactly as before).
Not pushed (awaiting owner's word, `cross_projects_policy §10`).

**Next (Phase 3 — independent-bar UI: H15 → H6 → H7).** H6 reuses the FaconnageEditor + adds the length (H2, now
real) + axial fields per extra bar; H7 renders standalone `longBars` on the SectionPicker + coupe. H2's UI half —
"disable the length field where no `totalLengthParam` is authored" — is trivially satisfied today (all 9 open shapes
author one) but should be honoured when the H6 length field is built. Owner long-lead items unchanged: engineer
nomination (`owner_tasks §B-1`), RPS zone→ND mapping (`§C-1`, re-scoped 2026-07-06).

### 2026-07-06 — v1.0.4 review pass (Zayd's Phase 1 + the two v1.0.4 docs) — **DOCS ONLY, not pushed** — by **Amer** (owner's local Windows PC)

**Context.** Owner asked me to review Zayd's Phase 1 (H1/H3/H4, commit `c430534`) and the two companion docs
(`v1.0.4_spec.md`, `v1.0.4_owner_tasks.md`) for possible improvements *before* resuming the v1.0.4 build. Pulled
`5f7c51f..c430534` first (fast-forward, clean).

**Phase 1 verdict — solid, correct, genuinely green.** `buildLongOverrides` inheritance + `regen` skip (H1), the
core `cutLength>0` guard placement (H3), and the `committedKey`/`lastCommittedRef` editor resync (H4) all match the
spec/impl-plan intent; tests assert behaviour not just non-throw; no golden moved. Good base for Phase 2.

**Finding 1 (acted — doc correction). The RPS 2011 A/g acceleration table is NOT needed by the engine.** Verified:
a repo-wide grep for `acceleration|baseShear|a_g|Amax` in `packages/` returns nothing in code; the RPS overlay
(`codepacks/src/seismic/index.ts`) emits only *detailing* outputs (critical-zone length, tie spacing/Ø, confinement,
engagement, lap tier, `longRatioUplift`) — none multiply by an acceleration; the `zones`/`a_g` map in `rps-2011.json`
is dead data (`types/seismic.ts` calls the zone an *"opaque key"*). This follows the product premise (`core_logic`):
the engineer supplies `As,req`; SmartBar detail-checks, it does **not** compute seismic demand. So `owner_tasks §C-1`
— listed as the single *most urgent* owner ask — was mis-scoped. **Re-scoped** `§C-1` to the **zone→ductility-class
(ND1/2/3) mapping** (what the engine actually consumes) and demoted the A/g table to "only if demand calc is ever
added (Track G/H)". Propagated to: `owner_tasks §C-1`, `§B-4`, the "short version" ordering; `structural_data.md §4`
+ `§6.1`; `spec §8` owner-dep table + dependency notes.

**Finding 2 (acted — spec sharpening). A2 tension-face convention.** A2's "which bars count per zone" was
under-specified for columns (bending-direction-dependent tension face). Added a note in `spec A2 §0.5` to **reuse the
existing per-zone `ZoneGeometry.tensionCentroid`/`d` convention (`D-P1-5`, `pipeline/element.ts`)** — A2 extends it to
the full placed set, it does not re-derive the tension face. Removes an ambiguity before A2 is coded.

**Finding 3 (logged, not fixed — tracked robustness item). `withDoc` keep-last-good doesn't cover `checkout`/import.**
`checkout(inst)` and the `.rcfg` load path call `withDoc(doc)` with **no** `prevGood`, so a malformed import or an
old doc that now trips the H3 guard **rethrows and blanks the app** instead of showing the non-blocking banner
(against owner A-6's spirit). Low likelihood, real edge. Tracked as a Phase-6 follow-up in `v1.0.4_impl_plan.md`.

**State.** Docs only; no production code changed; gate untouched (still 492/101 green from Zayd's Phase 1). Nothing
pushed. **Next:** resume the build at **Phase 2 (H11 → H9 → H2)** per `v1.0.4_impl_plan.md` (awaiting the go-ahead).


### 2026-07-05 (later still) — v1.0.4 **Phase 1** (façonnage stability: H1, H3, H4) — **CODE DONE, tested, green — NOT pushed** — by **Zayd** (Hetzner dev box)

**Context.** First implementation slice of `v1.0.4_spec.md`, per `v1.0.4_impl_plan.md` Phase 1 ("stop the crash +
the silent losses"). Started from a confirmed-green baseline. The owner answered the four §A design decisions up
front (recorded in `v1.0.4_owner_tasks.md §A`): **A-2** symmetric-shape length legs = recommended (u_bar→`w`,
zbar→`run2`, stepped→`run3`); **A-4** add the BAEL↔EC2 picker now; **A-5** impossible-bar tiers = *spacing tiered*
(block outside/past-end; spacing block below the code minimum, warn if merely tight — uses `dg`/`k1`/`k2`, proceeds
on `structural_data.md` defaults dg=20/k1=1/k2=5, owner-confirmable); **A-6** solve-error UX = non-blocking banner +
keep-last-good; **A-7** DROITE length field = read-only+coupled (default). A-2/A-4/A-5 land in later phases; only
A-6 was needed for Phase 1.

**What I did (all in `apps/web` + `packages/core`; no manifest/`.rcfg`/schema change):**
- **H1 (crash + guard).** `buildLongOverrides` (`solveDoc.ts`) now takes the group's *resolved façonnage params*
  as the fallback (call sites pass `faconnageParams(doc.longitudinal|span.faconnage, {L})`) — a Ø-only (or any
  partial) override on a bent group (BAIONNETTE…) inherits the group's legs instead of `{L:memberLen}`, so it
  regenerates cleanly instead of throwing `Undefined symbol lower` (the P0.2 repro). An **axial-only / removed-only**
  edit now *skips regen* (omits `shape` → the pipeline reuses the group's already-generated shape, byte-identical).
  Store side: `withDoc` (`useStore.ts`) wraps `solveDoc` in try/catch — on throw it **keeps the last-good result +
  coupes** and sets `solveError` (new `AppState`/`DocSlice` field, null when healthy); the next good solve clears it.
  A **`SolveErrorBanner`** (new, `role=alert`, i18n `solveErrorBanner` FR/EN) renders it non-blocking under the navbar.
- **H3 (core cutLength guard).** `generateBarShape` (`segment-grammar.ts`) throws on a non-finite / ≤0 `cutLength`
  right after the `totalLengthExpr` cross-check, so BBS/DXF/splice are all protected (D-P1-1). Dropped the now-redundant
  editor-level guard in `FaconnageEditor.tryGen`.
- **H4 (editor resync).** `FaconnageEditor` resyncs its param buffer on `[shapeId, memberLength, committedKey]` via a
  last-committed ref (was `[shapeId]` only) — fixes the geometry↔façonnage desync on import / geometry edit, without
  clobbering an in-progress invalid edit.

**Tests (all green).** New: `bar_override_inherits_faconnage` (3), `store_solve_guard` (3), `cutlength_positive_guard`
(3), `faconnage_resync` (2). Flipped: `faconnage_p02_verify` H1 → **no-throw** (H2 cases stay, pending Phase 2).
Held: `faconnage_adapter_characterization` all 7 (DROITE cases unaffected; the bent-group crash paths were a *fix*,
not a golden move), plus every legacy golden.

**Green gate (2026-07-05).** `npm run check` ✓ — **492 tests / 101 files** (+11 over the 481/97 prep baseline);
`npm run coverage` core **93.76%** (≥90 ✓); `npm run coverage:adapter` **96.34%** (was 96.22% — no regression). No
BBS/cutLength golden moved. Not pushed (awaiting owner's word, `cross_projects_policy §10`).

**Next (Phase 2 — façonnage capability: H11 → H9 → H2).** H2 uses the A-2 legs just decided (u_bar→`w`, zbar→`run2`,
stepped→`run3`); add `totalLengthParam` + per-param `default`/`min` to the 9 open manifests (P0.4 table), seed picks
through `tryGen` (H9), invert the linear `totalLengthExpr` in the adapter so `length` drives the principal leg.
Then Phase 3 (H6/H7/H15 independent-bar UI), Phase 4 (H8 validity — **A-5 tiered**), etc. Owner long-lead items
still open: nominate the engineer (`owner_tasks §B-1`) and the RPS 2011 A/g table (`§C-1`).

### 2026-07-05 (later) — "no provisional constants" policy + sourced structural data + effective-depth ruling — **DOCS ONLY, not pushed** — by **Zayd** (Hetzner dev box)

**Owner directive.** *Don't ship provisional/guessed constants — source accurate published values*; and *effective
depth `d` is measured to the bar cross-sections' geometric (area-weighted) centroid* (matches `D-P1-5`).

**What I did.** Ran an advanced web search of the published standards and compiled the accurate constants into a new
**`structural_data.md`** (cited): EC2 (EN 1992-1-1) mandrel 4Ø/7Ø, bond `fbd`, anchorage `lbd`, lap `l0` + α1–α6,
clear spacing `max(k1Ø,dg+k2,20)` (k1=1,k2=5), cover-by-class, lap stagger ≤50 %/0.3·l0; BAEL 91-99
`ls=Ø·fe/4τsu`, `τsu=0.6·ψs²·ftj`, `ftj=0.6+0.06fcj`, R≥5.5Ø/3Ø, 2Ø hook return (note: computed ≈44Ø vs tabulated
40Ø — owner picks the default, `D-P1-2` resolved as sourced); RPS 2011 `lc=max(he/6,hc,45cm)`,
`s=min(8ØL,0.25bc,15cm)`, ND1/2/3, velocity zones 0.07/0.10/0.13/0.17 m/s. **One gap:** the RPS **A/g acceleration
table** — the official MHPV PDF 403s the fetcher and other copies are scanned; flagged **⛳ OPEN → owner** (he has
the official doc).

**Docs updated accordingly.** `v1.0.4_spec.md` §0.5 reframed (data spine = sourced, not provisional; `As`/`d` exact
geometry, no placeholder), **A1** rewritten (fill packs from `structural_data.md` + a reference-case suite for
professional validation), **A2/H5** now exact (area-weighted centroid; no engineer-gate), **B1** stagger sourced,
`[ENGINEER-GATE]` tags dropped where the data is sourced, §7/§8 refreshed. `v1.0.4_owner_tasks.md` §B reframed from
"ratify guesses" to "**professional validation** of sourced constants," §C is now a concrete **data request** (RPS
A/g table, market/default code, BAEL `ls` default, diameters, materials, exposure/cover, `dg`, stock length, safety
factors, cartouche, schemes). §A-1 marked DECIDED (cut length); §A-3 resolved by the centroid ruling.

**State.** Docs only; no code changed; gate still green (481/97) from prep; nothing pushed since `5f7c51f`. New
file: `structural_data.md`.

**Open — owner data (see `owner_tasks §C`, most urgent first):** (1) **RPS 2011 A/g acceleration table** +
soil/importance/K; (2) primary market + default code + BAEL `ls` 40Ø-vs-44Ø default; (3) nominate the engineer;
(4) diameters/materials/exposure-cover/dg/stock-length/cartouche/schemes. **→ Next:** owner answers §C-1/2/3 + §B-1;
Zayd can start façonnage Phase 1 (H1/H3/H4) meanwhile.

### 2026-07-05 — v1.0.4 docs restructured into a COMPLETE-product spec + owner/Zayd task split — **DOCS ONLY, not pushed** — by **Zayd** (Hetzner dev box)

**What I did.** At the owner's direction, deep-analysed then **restructured the v1.0.4 doc set** so there is a clean
separation between what Zayd implements and what the owner supplies, and one authoritative spec for the *complete
single-tenant product* (the vertical/multi-tenant arc stays for later).

- **`v1.0.4_spec.md` — rewritten as the complete-product contract.** Now folds **façonnage (H1–H19)** + roadmap
  **Tracks A–E** into one spec: **A** compliance truthfulness (A1 sign-off harness · A2 validation completeness —
  every steel add/remove feeds §7 · A3 multi-code BAEL/EC2 reachability), **B** detailing depth (B1 per-bar splice
  stagger · B2 beam-support precision · B3 add-on 3D fidelity), **C** site-ready output (C1 coupe exactness +
  G-COUPE · C2 shop-drawing completeness), **D** 3D fidelity (D1 stair · D2 fidelity pass), **E** data/interop (E1
  canonical `.rcfg reinforcement[]` · E2 migration hardening). Each item carries impl/testing/deliverables +
  `[OWNER-DEP → owner_tasks §X]` flags; §0.4 makes tests+a11y+perf a per-feature invariant; §7 sequences the
  macro-phases; §9 defines "complete". **Track H (vertical/multi-tenant) explicitly OUT of scope.**
- **`v1.0.4_owner_tasks.md` — NEW, the owner's manual work.** §A design decisions (H2 semantic, gated scope,
  code scope, validity tiers, error UX, DROITE coupling, symmetric-shape principal legs) · §B engineering
  ratification (nominate the engineer; ratify BAEL/EC2/RPS/COUPE/TOL constants + reference cases; mixed-Ø As rule;
  splice stagger fraction; anchorage; coupe conventions) · §C product/business (§14 items 1–13) · §D GPU/drawing
  acceptance · §E final UAT. Each task: why-only-owner, which spec item it unblocks, priority (🔴 blocks coding /
  🟠 blocks acceptance / 🟢 default).
- **`roadmap_directions.md` — trimmed.** A–E removed (now in the spec); keeps **F** (platform-quality
  *infrastructure* — enforced coverage gate + perf harness; per-feature a11y/tests absorbed into the spec), **G**
  (breadth), **H** (vertical).
- **Deleted `v1.0.4_prep_plan.md`** (superseded — owner parts → owner_tasks, done agent parts recorded in
  `v1.0.4_prep_results.md`). Kept `prep_results` + `impl_plan` as execution artifacts; fixed their dangling refs.

**State now.** Docs only; **no production code changed** (the spec/owner-doc restructure adds no code). Gate stands
green from the prep session (**481 tests / 97 files**). Nothing pushed since `5f7c51f` (policy §10). Files:
rewrote `v1.0.4_spec.md`, `roadmap_directions.md`; added `v1.0.4_owner_tasks.md`; deleted `v1.0.4_prep_plan.md`;
touched `v1.0.4_impl_plan.md`/`v1.0.4_prep_results.md` (ref fixups) + this file.

**Open / owner action.** The owner still owes the **§A design decisions** (🔴 A-1 length semantic + A-3 gated scope
block the matching spec phases) and **§B-1 nominate the engineer** (long-lead). Zayd can start **façonnage Phase 1
(H1/H3/H4)** + the **a11y pass** now — neither needs an owner decision.

**→ Next agent / owner:** owner reads `v1.0.4_owner_tasks.md` (answer §A, start §B-1). Agent: begin façonnage
Phase 1 per `v1.0.4_impl_plan.md`. Pull before starting; append a §9 entry.

### 2026-07-03 (later) — v1.0.4 prep phase (Part B) EXECUTED + spec accuracy re-pass — **TESTS/DOCS ONLY, no production code, not pushed** — by **Zayd** (Hetzner dev box)

**What I did.** Executed the AGENT-doable prep tasks in `v1.0.4_prep_plan.md` (Part B) and re-analysed the spec for
accuracy. Owner was away when I asked the P0.1 decisions → proceeded on **recommended defaults** (recorded in
`v1.0.4_spec.md §6` as `[AGENT-DEFAULT — awaiting owner confirm]`; none irreversible at prep stage).

- **Spec accuracy re-pass.** Corrected one wrong claim: H1.2's "skip regen when only Ø changes" is **wrong** — Ø
  drives `bendDeduction(angle,Ø)` + hook ext (`≈10·Ø`) → `cutLength`, so Ø/`length` **must** regenerate; only
  `axialPos`/`removed`-only overrides are geometry-neutral. Fixed H1.2 + cited the exact throw + H5's As source.
- **P0.2 baseline + severity (VERIFIED LIVE).** `npm run check` GREEN **470/95**. **H1 crash CONFIRMED**: a
  BAIONNETTE-façonné column + a **Ø-only** override on bar 0 throws `expr eval failed for "lower": Undefined
  symbol lower` (DROITE doesn't). **H2 no-op CONFIRMED**: a bent shape ignores an injected `L`. Probe:
  `apps/web/src/engine/faconnage_p02_verify.spec.ts` (asserts the current bug; flips at H1/H2).
- **P0.3 safety net.** `faconnage_adapter_characterization.spec.ts` pins the adapter (legacy DROITE ⇒ no
  `longBars`; override activates per-bar; removed drops from schedule not As `[WILL-CHANGE H5]`; extra ⇒ standalone;
  bent `length` ignored `[WILL-CHANGE H2]`). Caught my wrong assumption: a default column has **6** long bars
  (corner-shared), not 10. New additive `npm run coverage:adapter` (no enforced threshold; core gate untouched) =
  **96.22% stmts**. 
- **P0.4/P0.5/P0.6/P0.7.** Manifest-data table (defaults / `totalLengthParam` / per-leg mins — u_bar/zbar/stepped
  `totalLengthParam` flagged ⚠ for owner/engineer); 3 design spikes confirmed (H2 leg-solver well-posed, H13
  adapter-only, H1 store-guard safe); per-H-item fixture/golden inventory; and **`v1.0.4_impl_plan.md`** (6 phases)
  seeded. All in `v1.0.4_prep_results.md`.

**State now.** GREEN — full suite **481 tests / 97 files** (was 470/95; +11 from the 2 new prep specs); no golden
moved; **no production core/adapter/UI code changed** (only 2 test files + a `package.json` script). Nothing pushed
(policy §10). Files added: `v1.0.4_prep_results.md`, `v1.0.4_impl_plan.md`, the 2 web specs; edited
`v1.0.4_spec.md`, `v1.0.4_prep_plan.md`, `roadmap_directions.md`, `package.json`, this file.

**Open (blocks acceptance/next steps, not this prep):** (a) **P0.1 owner decisions** on the 4 `[AGENT-DEFAULT]`
(H2.5 length semantic, H5/H14 non-gated scope, H13 EC2-separate, H1.3 banner UX) — confirm before coding Phase
2/5/6. (b) **Part A — finalize v1.0.3**: V3.1 owner GPU pass, V3.2 a11y axe (agent, not yet done), V3.3 docs
currency, V3.4 engineer sign-off program (owner nominate + agent suites). (c) the u_bar/zbar/stepped
`totalLengthParam` convention.

**→ Next agent / owner:** owner to answer P0.1 + nominate the engineer (V3.4). Agent can start **Phase 1 (H1/H3/H4)**
now (no owner decision needed) and do **V3.2 a11y** in parallel. Pull before starting; append a §9 entry.

### 2026-07-03 — v1.0.4 spec authored (façonnage flow — correcting & improving) + post-v1.0.4 roadmap directions — **DOCS ONLY, no code, not pushed** — by **Zayd** (Hetzner dev box)

**What I did.** Pulled latest (`60e958c..a2fd386`, Amer's viewport/export supports work), read `cross_projects_policy.md`,
`core_logic.md`, this file, and `v1.0.3_spec.md`/`_impl_plan.md`. Then, at the owner's direction, **deep-traced the whole
façonnage flow** (the F6 editor + the G2 addressable-bar channel) end-to-end — the two UI files (`FaconnageEditor.tsx`,
`AddressableBars.tsx`), the adapter (`solveDoc.ts`: `faconnageParams`/`buildLongOverrides`/`buildExtraBars`/`releveExtraBars`),
the doc types (`document.ts`), core (`segment-grammar.ts` `generateBarShape` + `element.ts` `buildLongBars`), the BBS
consumer, the store wiring, and all 9 open-shape manifests — to confirm the owner's 9 flagged concerns and find more.

**Deliverable 1 — `v1.0.4_spec.md`** (repo root, 🟡 DRAFT): the façonnage-flow **hardening** spec. Assembles **19 items
(H1–H19)** — the owner's 9 validated concerns + 10 new points found in the trace + the two capability checks — into four
parts (I correctness/crash/data-loss · II capability gaps · III robustness · IV polish), each with *the defect (cited to
file:line), the fix, testing, deliverables, and a legacy-no-op proof*. Highlights: **H1** — a per-bar Ø/length/axial
override on a *façonné* group drops the group's params → `generateShape` throws → propagates through `withDoc`
(`useStore.ts:196`, **no try/catch**) → **uncaught crash** (confirmed by call-chain trace; recommend a live repro before
sign-off). **H2** — a "unique length" is a **silent no-op on every bent shape** (only `droite.json` has an `L` param).
**H3** — the `cutLength>0` guard lives only in the editor, not the core generator. **H6** — the independent-bar UI exposes
only `u/v/Ø` though the model/adapter/core already carry shape/façonnage/length/axial/hooks (**UI-only gap**, highest
leverage). **H5/H14** are marked `[ENGINEER-GATE]`, scoped to their non-gated seams and handed off to the logged v1.0.4
backlog items 1 (per-bar verification) & 2 (splice stagger).

**Deliverable 2 — `roadmap_directions.md`** (repo root): ground directions for **all** specs after v1.0.4 — 8 tracks
(A make "code-checked" true · B finish detailing depth · C site-ready output · D 3D fidelity · E data/interop · F
platform quality · G breadth · H v1.1 vertical), each grounded in a cited gap. Core thesis: the machinery is built; the
goal is blocked by the **truthfulness of the three promises** — the biggest being **A2 validation completeness** (every
steel add/remove — supplements, cross-ties, relevés, overrides, extras, per-region stirrups — currently bypasses §7) and
**A3 multi-code reachability** (the adapter is `BaelPack`-typed and **EC2 is unreachable from the UI**, though `core_logic
§8` sells "pick a code, validation re-runs").

**State now.** **No code touched, no gate run** (docs only). Nothing pushed (per policy §10, awaiting owner "push"). The
v1.0.3 build is unchanged (still GREEN + pushed at `a2fd386`).

**→ Next agent / owner:** review `v1.0.4_spec.md` (confirm the H2.5 length-semantic + the H5/H14 non-gated scope + that
EC2-picker wiring is a separate item per H13); then a `v1.0.4_impl_plan.md` + phased build. Use `roadmap_directions.md`
to sequence the specs after it (recommended: A2 → A3 → B1 → C1 → E1, with F1/F3 threaded early and A1 sign-off running in
parallel). Pull before starting; append a §9 entry.

### 2026-07-01 — v1.0.3 Phase 8 (G8) + Phase 9 (G9) + P7b fix + full P1–P9 verification — **v1.0.3 FEATURE-COMPLETE, PUSHED** — by **Amer** (owner's Windows PC)

**What I did.** Pulled latest (`43565bf..60e958c`, Zayd's P4–P7), read `core_logic.md`, `v1.0.3_spec.md` (§8/§9),
the plan, and this file; confirmed the P1–P7 baseline GREEN first (`npm run check` = **463/93**). Then implemented
the **final two v1.0.3 phases** — both **viewport-only** (owner GPU-verified per the plan) — detail in **D-V103-8**
(G8) and **D-V103-9** (G9). With these, **all nine v1.0.3 feature groups (G1–G9) are coded.** Then, at the owner's
request, I **verified the whole P1–P9 body**, and on the owner's decision **closed the one real gap** (the P7
support width/anchorage threading — **D-V103-7b**) and **pushed** `feat/p1-m1-engine`.

**Owner design decisions captured (this session).** The owner reviewed the flagged scope choices and directed:
(1) **fix the P7 support-threading gap, then push** → done (D-V103-7b). (2) **Per-bar validation IS wanted** — the
current P4/G2 scope (per-bar overrides change render+schedule but NOT the §7 As/`d` checks) is **not acceptable
long-term**; per-bar verification is a **required v1.0.4 follow-up** (needs the structural engineer's call on how
mixed-diameter bars weight `As` + per-bar `d`). (3) **Splice staggering IS wanted** — group-level-only splices
(P6/G4) must gain real per-bar stagger (engineer-relevant: the stagger fraction in critical zones). (4) **Stair 3D
fidelity** — improve later (loft bars onto treads + model the landing). See the **v1.0.4 backlog** below.

- **P8 / G8 — 3D fidelity** ([REF-UI-840], spec §8). Two changes, both in `viewport/Viewport.tsx`, no engine touch.
  (a) The transparent concrete now carries a crisp drei **`<Edges>` outline** (box + cylinder) so the volume reads
  as a solid block instead of the old "half-empty" transparent haze. (b) **E-STR-01 renders a real stepped stair**
  concrete — a new `SteppedStair` builds `n_steps` disjoint boxes from the stair geometry (`g`/`r`/`n_steps`/
  `flight_width`, read off the GenericDoc), rising step-by-step over the section-depth axis — replacing the flat
  rect box. The `E-STR-01` check is in the **viewport adapter, not `packages/core`** (the plan scopes it "UI, not
  core"), so the engine-purity / no-`if(elementType)` rule is intact.
- **P9 / G9 — camera fixes** ([REF-UI-811b/850], spec §9). (a) **Killed the ViewCube auto-spin:** `RollController`
  dropped the per-frame `useFrame(…,1)` that mutated `camera.up`+`lookAt` every frame; roll is now an **on-demand
  `useEffect`** (applied only when `rollRad`/camera/controls change). (b) **Roll auto-levels on orbit:** a `"start"`
  listener on OrbitControls resets `rollRad → 0` the instant a drag begins. (c) **Hand-pan tool:** a session
  `navMode` ("orbit"|"pan") + a toolbar **✋ toggle**; pan mode maps LEFT-drag to pan (orbit moves to RIGHT-drag),
  zoom always works. All session-only, **not in `.rcfg`** (added to `reset()`).

**State now: GREEN + PUSHED** (owner said "if everything passes, push"). `npm run check` ✓ (**470 tests /
95 files**, +7/+2 over the P7 baseline — the new `nav_mode` + `export_supports` web suites), `npm run typecheck` +
`typecheck:web` ✓, `npm run build:web` ✓ (35.7s — proves the drei `Edges` import bundles), `npm run coverage`
**93.88% stmts** (≥90). New files: `apps/web/src/viewport/nav_mode.spec.tsx`, `apps/web/src/engine/export_supports.spec.ts`.
Touched (P8/P9) `apps/web/src/viewport/{Viewport.tsx,ViewCube.tsx}`, `store/useStore.ts`, `i18n/strings.ts`; (P7b)
`packages/exporters/src/{dxf,pdf}.ts`, `apps/web/src/engine/exportActions.ts`, `ui/Navbar.tsx`. **No engine/core
change; purity held; `.rcfg` untouched; no golden re-baseline (viewport render is not golden-tested; the DXF/PDF
goldens don't assert the optional support extras).**

**Open / not done (NONE block P8/P9 code-completeness).** (a) **Owner GPU/visual pass** on the owner's Windows GPU
(`cd apps/web && npm run dev`, port 5180): verify the concrete edges read crisply, the stair shows steps, the
ViewCube no longer auto-rotates, roll auto-levels on orbit, and the ✋ hand toggle pans on left-drag / restores
orbit — headless can't see WebGL or drive OrbitControls events. (b) **Stepped-stair representative note:** the true
rise (`n·r`) exceeds the flat-slab `waist_t` envelope, so the steps extend past the old box and the waist bars sit
low in the stair — a faithful representative; lofting the bars onto the treads + modelling the top `landing_L` are
later refinements if the owner wants them. (c) **v1.0.3 is now FEATURE-COMPLETE** (G1–G9 all coded); the only
remaining work is the owner GPU/visual passes across all phases + the standing **engineer sign-offs**
(G-BAEL/EC2/RPS/COUPE/TOL — acceptance, not code).

**v1.0.4 backlog (owner-requested this session — start a fresh spec/plan before coding the engineering ones):**
1. **Per-bar verification (G2 follow-up, engineer-gated).** Editing/removing/adding an individual bar must re-run
   the §7 As/`d` checks per bar (today they use the whole count-group). Needs the structural engineer's ruling on
   mixed-diameter `As` weighting + per-bar effective depth. Touches `packages/core` validation — NOT a silent change.
2. **Lap-splice staggering (G4 follow-up, engineer-gated).** Move from group-level splices (all bars splice at one
   station → the `lap_stagger` WARN) to real staggered per-bar splices; needs the code stagger fraction, esp. in
   critical zones. Rides the addressable-bar channel (per-bar splices).
3. **Stair 3D fidelity (G8 polish, viewport-only).** Loft the waist bars onto the treads + model the top
   `landing_L`; refine the stepped mesh so bars sit in the concrete (today they sit low — representative only).

**→ Next agent / owner:** v1.0.3 is code-complete **and pushed**. Remaining: the owner GPU/visual passes across all
phases + the engineer sign-offs (acceptance). For v1.0.4, scope items 1–2 with the engineer first (they change the
verification math), item 3 is free-standing viewport polish. Pull before starting; append a §9 entry.

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
