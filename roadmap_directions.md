# roadmap_directions.md — Ground directions for the specs after v1.0.4 (façonnage)

> **Purpose.** After `v1.0.4_spec.md` (façonnage-flow hardening), this file is the **map of every remaining
> spec** needed to make the app *behave the way its goal requires* — grouped into tracks, each a candidate
> spec, each grounded in a concrete inconsistency or gap (cited to a decision `D-…`, a handoff note, or a code
> fact). It is **direction, not the specs themselves**: for each track it fixes the *why (goal link)*, the
> *evidence*, the *direction of the work*, the *scope boundary*, *dependencies*, and whether it is
> **[ENGINEER-GATE]** (needs the qualified structural engineer before the math is "done").
>
> **The goal (from `core_logic.md`).** Turn "how much steel does this need?" into a **buildable, code-checked,
> site-ready** rebar design (3D + BBS + drawings), **instantly, in the browser**, on a **generic, data-driven
> engine** that can grow to any element, any code, and a backend without a rewrite. Every track below is scored
> against that sentence: *buildable*, *code-checked*, *site-ready*, *instant*, *data-driven*.

**Authored:** 2026-07-03 (Zayd). Read after `v1.0.4_spec.md`, grounded in `current_state.md` (§8 ledger, §9 log)
and a code trace. Absolute-date all "later" references before they enter a real spec.

> **Sequencing note (2026-07-03).** Before v1.0.4 is *built*, a preparation phase runs — see
> **`v1.0.4_prep_plan.md`** (owner decisions, live severity checks, a test safety net around the under-tested web
> adapter, shape-data authoring, design spikes, fixture inventory, and the impl-plan seed). Part of **Track F1**
> (coverage widening) is **pulled forward into that prep phase** as a hard prerequisite, because v1.0.4 rewrites
> `solveDoc.ts`, which the core-only coverage gate does not cover. The order below is therefore:
> **`v1.0.4_prep_plan.md` (Phase 0) → v1.0.4 build → the tracks below.**

---

## 0. The one-page read

The app's **machinery** is largely built (8 elements, true geometry, addressable bars, shop drawings, exports).
What stands between it and its **goal** is not more features — it is **truthfulness and completeness of the three
promises**:

1. **"code-checked" is not yet true** — the numeric constants are **provisional** (no engineer sign-off), **EC2 is
   unreachable from the UI** (the app is BAEL-hardwired), and **anything that adds or removes steel bypasses the
   checks** (supplements, cross-ties, relevés, per-bar overrides, extra bars, per-region stirrups). → **Track A**.
2. **"buildable" is only partly enforced** — detailing add-ons skip clear-spacing/anchorage/As; splices are
   group-level; beam supports are placed representatively. → **Tracks A2, B**.
3. **"site-ready" has convention debt** — the coupe conventions are provisional (G-COUPE), the coupe is
   representative for slab-family, and the drawing has known sketch/dimension gaps. → **Track C**.

Then two cross-cutting enablers (**test/coverage** and **perf/a11y**, **Track F**) and the persistence/interop
model (**Track E**). Breadth (more elements/codes/tendons) and the v1.1 backend (**Tracks G, H**) are the
**already-documented** roadmap in `core_logic §9` — kept here only as pointers so this map is complete.

**Recommended overall order:** A2 → A3 → B1 → C1 → E1, with F1/F3 threaded early (they de-risk everything), then
A1 (the sign-off *program*, which runs in parallel as a people-process), then B2/B3/C2/D, then G/H.

---

## TRACK A — Make "code-checked" true (the critical path to the goal)

### A1 — Engineering sign-off program (constants ratification)  [ENGINEER-GATE]
- **Goal link:** *code-checked.* Nothing the app prints about BAEL/EC2/RPS compliance is real until an engineer
  ratifies it. This is the single largest thing between the app and its stated purpose.
- **Evidence:** `current_state.md §6` open gates **G-BAEL / G-EC2 / G-RPS / G-COUPE / G-TOL / final sign-off**;
  §14 owner open items **1–13** (starter schemes, default materials, diameter set, cartouche fields, RPS defaults,
  the constants tables, WARN bands, curtailment defaults, cover special cases, corner-torsion trigger,
  leg-counting policy, **and nominate the engineer**). `D-P1-2`: `bendDeduction` provisional, `l_s ≈44φ vs 40φ`
  tabulated — a flagged gap. Constants ship `"_provisional": true`.
- **Direction (this is a *spec for the process + the harness*, not new engine math):** (a) build the
  **reference-case suites** (BAEL/EC2/RPS §14.7/14.6) as executable fixtures the engineer signs against; (b) a
  **provisional→ratified** state machine per constant + a UI/PDF **"⚠ provisoire" pill** that flips to "ratified"
  per pack/rule; (c) a **sign-off ledger** (who signed what, which constants, which date, which reference cases).
- **Scope boundary:** does **not** change constant *values* silently — it makes ratification auditable and
  visible. Value changes come *from* the engineer, recorded here.
- **Depends on:** owner nominating the engineer (§14 item 13). Runs in **parallel** with all code tracks.
- **Kickoff:** pulled to the front as **`v1.0.4_prep_plan.md` V3.4** (it is long-lead and also gates v1.0.4's
  `[ENGINEER-GATE]` items H5/H14) — start building the reference-case suites now.

### A2 — Validation completeness: every steel add/remove feeds the checks  [ENGINEER-GATE for As-weighting]
- **Goal link:** *buildable + code-checked.* The app's honesty rests on "change a bar → the verdict updates." Today
  a whole class of edits changes render + schedule but **not** the §7 checks.
- **Evidence (a systemic pattern, not one bug):**
  - Per-bar overrides / extra bars / removed bars are **detailing add-ons** — "change render + schedule but NOT
    the validation layout/As" (`D-V103-4`); v1.0.4 backlog **item 1** logs per-bar verification as engineer-gated.
  - Per-region **Asw/clear-spacing still use the representative `tz.spacing`** — per-region Asw verification
    deferred (`D-V102-5`).
  - Relevés/supplements/cross-ties are add-ons that **don't enter As** (`D-V103-5`, `D-P3-6`).
  - Addressable bars have **no section-bounds / axial-extent / clear-spacing check** (v1.0.4 **H8** starts this;
    the general policy belongs here).
- **Direction:** a single **"steel accounting" pass** that reconciles *every* rendered/scheduled bar (group,
  override, extra, relevé, supplement) into per-zone **As,prov** and per-region **Asw**, and runs clear-spacing/
  anchorage over the real placed set. Mixed-diameter **As weighting** + **per-bar effective depth `d`** are the
  gated core-math change (needs the engineer's rule).
- **Scope boundary:** v1.0.4 H5/H8 do the *non-gated* seams (count reconciliation, geometric bounds). This track
  is the *complete, gated* version. Keep the tiered model (WARN vs FAIL) — don't over-block.
- **Depends on:** v1.0.4 (H5, H8), A1 (the engineer to rule on weighting).

### A3 — Multi-code reachability (make "chosen by axis" real)
- **Goal link:** *code-checked + data-driven.* `core_logic §8` promises "pick a code, pick a seismic regime, and
  validation re-runs" and "switching BAEL↔EC2 changes only the numbers." **The UI can't do it today.**
- **Evidence (code fact I found):** the whole web adapter is typed `BaelPack` and `solveDoc` defaults
  `code = baelPack`; the `FaconnageEditor` imports a module-level `baelPack`. The EC2 pack (`makeEc2Pack`,
  `D-P4a-4`) exists but is **unreachable from the UI**. v1.0.4 **H13** only removes the double-source (editor vs
  solve) — it explicitly leaves the picker to this track.
- **Direction:** (a) widen the adapter typing from `BaelPack` to the `CodePack` interface (`D-P1-3` guarantees
  core never imports a pack, so this is adapter-only); (b) a **code picker** in the Projet/Code tab, stored on the
  doc + `.rcfg`; (c) verify the RPS overlay composes on either base pack (`D-P4b-1`) end-to-end through the UI;
  (d) a golden proving BAEL↔EC2 changes only numbers, not structure.
- **Scope boundary:** wiring + UI, not authoring the full EC2 ruleset (that's **G2**). EC2 constants stay
  provisional (G-EC2) until A1.
- **Depends on:** v1.0.4 H13.

---

## TRACK B — Finish the detailing depth started in v1.0.3

### B1 — Lap-splice staggering (per-bar, critical-zone)  [ENGINEER-GATE]
- **Goal link:** *buildable + code-checked.* Real construction staggers laps; coincident laps are a code fault,
  especially in seismic critical zones.
- **Evidence:** splices are **group-level** — "all bars of a group splice at the same station → the `lap_stagger`
  WARN" (`D-V103-6`); v1.0.4 backlog **item 2** logs per-bar stagger as engineer-gated; v1.0.4 **H14** does only
  the non-gated auto-split-of-override-bars seam.
- **Direction:** move to **staggered per-bar splices** on the addressable channel — the code **stagger fraction**
  (e.g. ≤ 50% lapped in a section) drives which bars splice where; the seismic overlay's `lap_in_critical_zone`
  becomes exact per bar; the WARN becomes a real PASS when the stagger rule is met.
- **Depends on:** v1.0.4 (addressable channel + H14), A1 (stagger fraction constant), A2 (per-bar accounting).

### B2 — Beam two-support precision (placement + per-support anchorage)
- **Goal link:** *site-ready.* The two-support model (G3) validates asymmetric chapeaux but places some steel
  representatively and checks anchorage globally.
- **Evidence:** "the second support's chapeau + the relevés render at a **representative axial position**"; "the
  member-level `end_support_anchorage` check stays **single** (per-support anchorage is stored + drawn, not
  validated per support)" (`D-V103-5`).
- **Direction:** precise per-support **axial placement** of the second chapeau + relevés (they never share a
  cross-section); **per-support anchorage validation** (each support its own `lbd` check). Rides the existing
  supports data + addressable channel — no new element branch.
- **Depends on:** A2 (accounting), A1 (anchorage constants — G-BAEL/EC2).

### B3 — Supplement / add-on 3D fidelity & anchoring
- **Goal link:** *site-ready + buildable.* The 3D must match what gets built for **all** add-ons, not just
  épingles.
- **Evidence:** G5 made **épingles** anchored + hook-in-centreline (`D-V103-3`), but the broader supplement
  placement was historically **centred-for-presence** (`D-P3-6`), and the D-V102-2 scope note flagged non-épingle
  supplements as still presence-only. Skin bars / diamond ties / U-bars over supports need real anchored geometry.
- **Direction:** extend the anchored-placement seam (`MemberPlacement.transverse[].anchor`, `D-V102-2`) to **every**
  supplement archetype so each renders in its true position + shape; feed them into A2's accounting.
- **Depends on:** A2 (so anchored supplements also count toward steel), the placement seam (built).

---

## TRACK C — Site-ready output (coupe + drawing fidelity)

### C1 — Coupe engine exactness + ratified conventions  [ENGINEER-GATE: G-COUPE]
- **Goal link:** *site-ready.* Cross-sections are the primary fabrication drawing; they must be exact and follow
  ratified conventions.
- **Evidence:** coupe conventions are **provisional** — "near-parallel angle threshold, default look-behind depth,
  cutting-line/tag style, default coupe station" (`G-COUPE`, `D-P5-2`); the coupe is **exact for axial members,
  representative for slab-family** (`D-P5-3`); a bent/axially-offset bar (v1.0.3 G2 `axialPos`, relevés) only
  appears if the cut station crosses it — no guarantee the default station shows the interesting steel.
- **Direction:** (a) ratify the G-COUPE conventions (owner + engineer) and bake them in; (b) make the coupe
  **station-aware** so bent/offset/relevé bars are shown at a meaningful default (or auto-suggest a cut where the
  detailing is); (c) push slab-family coupes from representative toward exact where the geometry allows.
- **Depends on:** A1/owner (conventions), v1.0.4 (addressable bars are now placed correctly to section against).

### C2 — Shop-drawing completeness
- **Goal link:** *site-ready.* The v1.0.3 shop drawing (G7) is real but has known holes.
- **Evidence:** the bending-table **sketch falls back to none for spliced-segment rows**; support width/anchorage
  extras are optional; leader anti-overlap is "basic" (`D-V103-7`, `D-V103-7b`).
- **Direction:** segment-row sketches, robust leader placement at density, full dimension coverage, and (later)
  alternative drawing conventions (BS 8666 bar shape codes, ACI 315 labelling) as data — ties to **G2**.
- **Depends on:** B1 (spliced-segment geometry), C1 (conventions).

---

## TRACK D — 3D / viewport fidelity (owner-GPU-verified, viewport-only)

### D1 — Stair 3D fidelity  (viewport-only)
- **Evidence:** v1.0.4 backlog **item 3** — "loft the waist bars onto the treads + model the top `landing_L`; the
  stepped mesh is representative only, bars sit low" (`D-V103-8`).
- **Direction:** loft the waist reinforcement onto the tread profile, model the landing; refine the stepped mesh.
  No engine change (adapter/viewport, per the plan's "UI not core" scoping).

### D2 — General 3D indicative→faithful pass
- **Evidence:** slab/mesh 3D is "indicative" (`D-P4a-6`); many phases carry pending **owner GPU/visual passes**
  (`current_state §1`).
- **Direction:** a consolidated visual-fidelity + owner-GPU sign-off pass across elements (edges, exit lengths,
  hook rendering, mesh); largely validation debt + small viewport polish, not a large spec.

---

## TRACK E — Data model, persistence & interop

### E1 — Canonical `.rcfg` reinforcement[] model
- **Goal link:** *data-driven + the v1.1 backend/IFC bet.* The persisted model must be the canonical one, not a
  UI-shaped shortcut, before it feeds a server or IFC export.
- **Evidence:** "SPA `.rcfg` round-trips via `meta.app_document`; canonical §10 `reinforcement[]` mapping
  **deferred**" (`D-P5-7`). Forward-compat (unknown kinds/fields preserved) is solid (`D-P0-2`) and must stay.
- **Direction:** map the app document onto the spec §10 canonical `reinforcement[]` (`ReinforcingElement`
  supertype), keeping `meta.app_document` as an additive convenience; consolidate the growing **migration chain**
  (nLegs → épingle → beam supports; `D-V102-2/D-V103-3/5`) into one ordered, tested migrator; bump to `.rcfg`
  v1.2 additively.
- **Scope boundary:** must **not** regress `D-P0-2` forward-compat (never reject unknown kinds — the TENDON slot).
- **Depends on:** stable detailing model (post B-track), so the canonical mapping isn't re-cut later.

### E2 — Forward-compat & migration hardening
- **Direction:** as the doc grows, a standing test that every prior-version fixture loads byte-identical, plus a
  migration-idempotency suite. Small, continuous; can fold into E1.

---

## TRACK F — Platform quality (cross-cutting enablers — thread these early)

### F1 — Test strategy & coverage widening  (partly a v1.0.4 PREREQUISITE — see `v1.0.4_prep_plan.md` P0.3)
- **Goal link:** *trustworthy engine* (the whole architectural bet). The critical detailing/validation logic now
  lives in the **web adapter** (`solveDoc.ts`, ~800 lines) and the **exporters**, which are **outside** the
  core-only coverage gate.
- **Evidence:** "`npm run coverage` **93.88% stmts** (≥90) — **core-only scope**; P8/P9/P7b are `apps/web` +
  `exporters` code, **outside** the core-only coverage include" (`current_state §1`).
- **Direction:** extend the coverage gate to `apps/web/src/engine` (the adapter) + `packages/exporters`; add
  characterization tests for `solveDoc` (the two-pass supplement solve, the longBars channel, the migrators).
- **Prerequisite slice (now):** because v1.0.4 rewrites `solveDoc.ts` (H1/H2/H11/H13), the **adapter-coverage +
  characterization** slice is pulled forward into the v1.0.4 prep phase (`v1.0.4_prep_plan.md` P0.3). The rest
  (exporters, deeper suites) stays here as the full track.
- **Depends on:** nothing — do the prep slice **immediately**; it de-risks Tracks A/B/E and the v1.0.4 build itself.

### F2 — Performance & scaling
- **Goal link:** *instant (<16 ms).* Bar-by-bar detailing multiplies `longBars`/instances; the budget must hold.
- **Evidence:** perf budget + heavy-case tests exist (`D-V103-1` perf cases, `perf_heavy`), but they predate heavy
  addressable use. A column with dozens of per-bar overrides + extras + splices was never load-tested.
- **Direction:** perf fixtures for addressable-heavy + multi-element projects; confirm the solve/place/BBS stays
  under budget; profile the adapter's per-bar regeneration (H1 makes it conditional — verify it doesn't
  regenerate needlessly).

### F3 — a11y completion
- **Evidence:** "P6 **a11y axe** pending"; each new pointer feature added a keyboard path but there's no
  end-to-end audit (`current_state §1`).
- **Direction:** an axe pass + a keyboard-parity audit across the v1.0.2–v1.0.4 UI (section picker, region editor,
  addressable bars, façonnage editor, nav toolbar).

---

## TRACK G — Breadth (the "grow wide" bet — already in `core_logic §9.1 [later]`)

Kept here as pointers; each is **a new data manifest + profile, no engine rewrite** (`D-P4a-1`, hard rule §3.1).
- **G1 — More elements:** shear walls, isolated/strap footings, waffle slabs, retaining walls, L- and spiral
  stairs. Each = manifest + validation profile.
- **G2 — More codes:** the full EC2 ruleset (beyond A3's wiring), then **BS 8666 / ACI 315** conventions (bar
  shape codes, labelling) — data + a pack, plus C2's drawing conventions.
- **G3 — Prestressing / tendons:** a new `ReinforcingElement.kind` — the `.rcfg` slot is **already reserved**
  (`D-P0-2` preserves unknown kinds). New geometry (bespoke, `D-P4a-1`) + a code pack + drawing.
- **G4 — Opt-in "proposer":** suggest the smallest valid bar set — **never automatic** (`core_logic §3`). A pure
  search over the existing validator; opt-in convenience, not a design authority.

---

## TRACK H — Vertical / v1.1 (needs a backend — a separate arc, `core_logic §9.2`)

The engine is deliberately framework-free so it runs **unchanged** on a server (`D-P5-4`, `core_logic §9.2`).
- **Accounts, cloud sync, teams.**
- **IFC export** (`IfcReinforcingBar` / `IfcReinforcingMesh`) — depends on **E1** (canonical model).
- **A building-aware project** — storeys, grids, positions, cross-element schedules, BIM coordinates — vs. today's
  flat typed-instance list (`D-P7-1`).

---

## Appendix — Traceability (gap → source)

| Track | Grounded in |
|---|---|
| A1 | `§6` gates; `§14` items 1–13; `D-P1-2` |
| A2 | `D-V103-4`, `D-V102-5`, `D-V103-5`, `D-P3-6`; v1.0.4 H5/H8; backlog item 1 |
| A3 | code trace (BaelPack-typed adapter, EC2 unreached); `D-P4a-4`, `D-P4b-1`; `core_logic §8`; v1.0.4 H13 |
| B1 | `D-V103-6`; backlog item 2; v1.0.4 H14 |
| B2 | `D-V103-5` |
| B3 | `D-V103-3`, `D-P3-6`, `D-V102-2` |
| C1 | `G-COUPE`, `D-P5-2`, `D-P5-3` |
| C2 | `D-V103-7`, `D-V103-7b` |
| D1 | backlog item 3, `D-V103-8` |
| D2 | `D-P4a-6`; pending GPU passes |
| E1 | `D-P5-7`, `D-P0-2`; migrators `D-V102-2/D-V103-3/5` |
| F1 | `current_state §1` coverage note |
| F2 | `D-V103-1` perf; growth of addressable use |
| F3 | `current_state §1` a11y axe pending |
| G/H | `core_logic §9.1/§9.2` |
