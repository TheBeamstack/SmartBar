# RebarConfig (SmartBar) — Owner manual tasks (living, spec-independent)

### Everything only the owner (Ssi Daoudi) or the nominated structural engineer can supply — carried across versions

**Purpose.** The specs (`v1.0.4_spec.md` … `v1.0.6_spec.md`) are **what the dev agents implement**. This doc is
**what only the owner can do** — and it is deliberately **not tied to one version**. It accumulates every open
people-dependency (product decisions, owner-only data, engineer sign-offs, and the GPU/visual acceptance passes the
headless gate cannot run) so nothing is lost between turns. When an item is delivered, mark it ✅ here; when a new
version adds a people-dependency, append it — do **not** fork a new per-version owner-tasks file.

**Why this replaced `v1.0.4_owner_tasks.md`.** The owner asked (2026-07-11) to make the owner-tasks doc
spec-independent. This file supersedes it: the still-open v1.0.4 rows are carried below (§A–§E), the v1.0.5 and
v1.0.6 people-dependencies are folded in, and the version each item first arose in is shown in the **Since** column
so history is preserved without a doc-per-version.

**Priority key:** 🔴 *blocks coding of its item* · 🟠 *blocks acceptance (coding proceeds on the sourced/provisional
data)* · 🟢 *default is fine, confirm at leisure* · ✅ *decided/closed*. The dev agents proceed on the recommended
defaults for 🟠/🟢 so nothing stalls; a 🟠 gates the design being called *site-final*, not the code being written.

**Companions:** `structural_data.md` (the sourced constants + citations), `current_state.md` (as-built + the §9 log),
and the active spec. **Last updated:** 2026-07-11 (v1.0.6 N6).

---

## §A — Product design decisions

| # | Decision | Status / recommendation | Since |
|---|---|---|---|
| A-1 | **Unique-length semantic (H2)** | ✅ **DECIDED: `length` = fabricated cut length** (principal leg; matches BBS `l=`). | 1.0.4 |
| A-2 | **Principal leg per symmetric shape (H2)** | ✅ **DECIDED:** u_bar→`w` · zbar→`run2` · stepped→`run3`. | 1.0.4 |
| A-3 | **Validation-completeness scope (A2/H5)** | ✅ Resolved by the centroid ruling — `As` + `d` are exact area-weighted geometry; A2 ships complete. | 1.0.4 |
| A-4 | **Multi-code scope (A3/H13)** | ✅ **DECIDED: BAEL↔EC2 picker shipped** (numbers sourced; EC2 is a real selling point). | 1.0.4 |
| A-5 | **Impossible-bar tiers (H8)** | ✅ **DECIDED: spacing tiered** — block outside-concrete/past-end; block below the code minimum, warn if merely tight (dg=20/k1=1.0/k2=5 defaults, confirmable §C-7/§C-2). | 1.0.4 |
| A-6 | **Solve-error UX (H1.3)** | ✅ **DECIDED: non-blocking banner + keep last-good.** | 1.0.4 |
| A-7 | **DROITE length field (H12)** | ✅ **DECIDED: read-only + coupled, explicit override toggle.** | 1.0.4 |
| A-8 | **Drawing-first default vs form-first (`advancedForm`)** | ✅ **DECIDED (2026-07-12): flip to drawing-FIRST (`advancedForm` default OFF).** Done in R6 — the app opens with the section canvas + inspector + editable elevation; the full tabbed form is the "Avancé" fallback. Safe post-R2+R5 (nothing the form reaches is stranded). Advanced-form UI specs opt in via `setAdvancedForm(true)`. | 1.0.6 (N3→N6) |
| A-9 | **Element-setup fields: compact strip vs advanced form** | 🟢 Confirm which element-level fields belong in the always-visible setup strip vs the advanced form (IA preference). As-built strip = id · code pack · b/h · H/L · cover. | 1.0.6 |
| A-10 | **Snap-grid density + palette/tool ordering (U4/U5)** | 🟢 Confirm the section place-by-pointing snap grid (default **5 mm**) + the elevation station snap (default **10 mm**) + the default palette/tool ordering. One-line changes. | 1.0.6 (N5/N6) |

---

## §B — Engineer: professional validation (the numbers are sourced — this is a signature that they're *applied* right)

*Constants come from BAEL 91-99 / EN 1992-1-1 / RPS 2011, cited in `structural_data.md`; a qualified engineer signs
that the app applies them correctly via the reference-case suites. B-1 is the only long-lead people-dependency.*

| # | Task | Since | Prio |
|---|---|---|---|
| B-1 | **Nominate the structural engineer** (a person, not code) — gates all of §B. | 1.0.4 | 🔴 for acceptance |
| B-2 | **Validate the BAEL reference-case suite** (built from `structural_data.md §3`). | 1.0.4 | 🟠 |
| B-3 | **Validate the EC2 reference-case suite** (`structural_data.md §2`). | 1.0.4 | 🟠 |
| B-4 | **Validate the RPS 2011 reference cases** (`§4`; needs the §C-1 zone→ND mapping first). | 1.0.4 | 🟠 |
| B-5 | **Confirm the WARN-vs-PASS tolerance bands** (G-TOL) — how far past a limit is amber vs red. | 1.0.4 | 🟠 |
| B-5a | **Rule on the cover "comfort-target" WARN** — as-built: cover at/above the durability+fire minimum = 🟢 PASS. Decide: keep FAIL/PASS (recommended), or reinstate a comfort nudge **advisory-only** (must not roll into the status/stamp). | 1.0.4 | 🟠 |
| B-6 | **Confirm the lap-stagger rule for the market** (EC2 default ≤50 %/section, 0.3·l0 offset; confirm BAEL/RPS qualifiers). | 1.0.4 | 🟠 |
| B-7 | **Confirm the coupe drawing conventions** (G-COUPE: near-parallel angle, look-behind depth, cutting-line/tag style, default station). | 1.0.4 | 🟠 |
| B-9 | **Confirm the confinement add-on Asw crediting** — an interior diamond tie contributes `2·legs·cos(incl)` of Asw/m at 45°; the leg-crossing convention needs a signature. | 1.0.4 | 🟠 |
| B-10 | **Ratify the slab/stair distribution fabrication COUNT** (`span ÷ spacing`, now matching drawing + BBS + bending table). | 1.0.4 | 🟠 |
| B-11 | **Ratify the v1.0.5 provisional limits (G-BAEL/EC2/TOL)** now sourced in `*-constants.json`: `code.bundleEquivDiameter = φ√n ≤ 55`; bundle max (>4, >3-at-lap); skin depth-trigger (1000 mm + per-face min 0.1 %·b·h + spacing ≤ 300); `curtailmentHookedFactor`; between-layer floor `max(Ø, 20)` (dg not folded); the beam-continuation curtailment inset (PROVISIONAL 0.1·L). | 1.0.5 | 🟠 |
| B-12 | **Ratify the French *façonnage* nomenclature table** (NF A 35-027 / BAEL shape-code + cadre/étrier/chapeau naming). Ships **PROVISIONAL** — swap the `TABLE` in `exporters/faconnageCodes.ts` (one place) + flip `FACONNAGE_PROVISIONAL` to `false`. It's a label, not a number (no code-sign-off), but the schedule isn't *site-final* until you supply it (`§O-1`). | 1.0.5 | 🟠 |
| B-8 | **Sign the reference-case suites + the record** (`ratification.json`) once B-2…B-12 hold. | 1.0.4 | 🟠 |

---

## §C — Data values only you can give (the dev agents cannot source these accurately)

*Market/business/project facts, not published constants. C-1 is the important one that could not be extracted cleanly.*

| # | Data needed | Detail / default | Since | Prio |
|---|---|---|---|---|
| C-1 | **RPS 2011 zone → ductility-class (ND) mapping** | importance/priority-class → ND1/ND2/ND3 per zone (what the engine consumes — the *detailing* regime). The A/g table, soil coeffs and K are **not** needed (SmartBar detail-checks, it doesn't compute demand; `As,req` comes from your analysis). Supply A/g only if seismic **demand** is ever added. | 1.0.4 | 🟠 |
| C-2 | **Primary market + default code** | Morocco / France? → **BAEL** default? which **National Annex** for EC2 (sets k1/k2, cover classes). | 1.0.4 | 🟠 |
| C-3 | **BAEL `ls` default** | computed **44Ø** vs tabulated **40Ø** — which is the app default? (may re-baseline a golden). | 1.0.4 | 🟠 |
| C-8 | **Stock bar length** | for auto-split / laps. **CONSUMED at a PROVISIONAL 12 000 mm** by v1.0.5 M5 (splice reach) + H14/B1 — confirm/override. | 1.0.4 / 1.0.5 | 🟢 |
| C-4 | **Diameter set** | the Ø menu, e.g. 6/8/10/12/14/16/20/25/32/40 mm. | 1.0.4 | 🟢 |
| C-5 | **Default materials** | concrete fc28 (e.g. 25 MPa), steel fe (e.g. 500 MPa), HA (ribbed) default. | 1.0.4 | 🟢 |
| C-6 | **Exposure / cover policy** | which exposure classes ship + cover per class. | 1.0.4 | 🟠 |
| C-7 | **Default aggregate size `dg`** | clear-spacing input (e.g. 20 or 25 mm). | 1.0.4 | 🟢 |
| C-9 | **Partial safety factors** | confirm γc = 1.5, γs = 1.15 (fundamental); accidental 1.15 / 1.0. | 1.0.4 | 🟢 |
| C-10 | **Cartouche / title-block fields** | project, client, drawer, index… | 1.0.4 | 🟠 |
| C-11 | **Starter scheme list** | which reinforcement schemes ship per element. | 1.0.4 | 🟢 |
| C-12 | **Curtailment / bend-up detailing defaults** | v1.0.6 N6 makes bar-end curtailment, laps and relevé bend-up points editable **on the drawing**; the *code-driven* curtailment/anchorage lengths still ride the BAEL/EC2 §7.7 values in `structural_data.md`. Confirm any house-standard defaults (e.g. a default bend-up station, a default anchorage choice at a free cut). Recommended defaults are in use; no blocker. | 1.0.6 | 🟢 |

---

## §D — Visual / GPU & drawing acceptance (headless can't verify)

*On your Windows machine: `cd apps/web && npm run dev`, port 5180. The dev box has no GPU, so every WebGL/canvas
surface below is code-complete + headless-tested for its pure logic but awaits your eyes on the real render.*

| # | Acceptance pass | Covers | Since | Prio |
|---|---|---|---|---|
| D-1 | **v1.0.3 GPU pass** — true geometry, spiral coil, épingle hooks, addressable bars, beam supports/relevés, concrete edges, stepped stair, ViewCube no-spin + roll auto-level + hand-pan. | 1.0.3 | 🟠 |
| D-2 | **Stair 3D acceptance** — bars sit in the treads, landing reads right. | 1.0.4 | 🟠 |
| D-3 | **General 3D fidelity** — edges/exit-lengths/hooks/mesh across all 8 elements. | 1.0.4 | 🟠 |
| D-4 | **Coupe acceptance** — conventions look right; the default station shows the detailing. | 1.0.4 | 🟠 |
| D-5 | **Shop-drawing acceptance** — leaders/marks/dims/bending-table read like a real fabrication drawing (now on the French façonnage columns). | 1.0.4 / 1.0.5 | 🟠 |
| D-6 | **a11y spot-check** — keyboard-only walkthrough (dev runs axe; you confirm the feel). | 1.0.4 | 🟢 |
| D-7 | **v1.0.5 new-steel render pass** — freely placed **rows / extra layers / bundles / side-face skin** and **curtailed** bars render + read in the coupe correctly on all 8 elements. | 1.0.5 | 🟠 |
| D-8 | **v1.0.6 drawing-board feel (U1–U4)** — the 3D-primary shell reads right; the **section dock + elevation dock** resize/collapse cleanly; the **one unified section canvas** select/link feel; the **contextual inspector** + compact setup strip; the **tool palette + place-by-pointing** (click-to-drop a bar/row/bundle/layer, snap feel, tool discoverability). | 1.0.6 (N1–N5) | 🟠 |
| D-9 | **v1.0.6 editable elevation (U5 / N6) — the largest pass.** Drag a **bar end** (curtailment — the 3D + BBS cut update live), a **runs-through/anchorage** choice at a support, **drop a lap/coupler** (splice station), **grab a bend-up point** (relevé), and **drag a stirrup-zone boundary** (regions). Confirm each gesture *feels* right and the **numeric twin agrees** (inspector curtailment/anchorage/splice fields + the `RegionEditor` table + the relevé bend field). The pure hit-test/snap + the store actions are headless-tested; only the on-canvas pointer drag needs your GPU. | 1.0.6 (N6) | 🟠 |

### §D-R — Adversarial review #2 (2026-07-11, Amer) — confirmation & acceptance tests

*These come out of the second adversarial review (after R1–R5). **UPDATE 2026-07-12 (Amer):** the three code defects DR-1/DR-2/DR-3 are now **FIXED** (R8/R6/R9) and DR-6's measure tool is now **implemented** — so DR-1/2/3/6 flip from "confirm the bug" to **confirm the FIX** (the CORRECT result should now be what you see; the FAILURE signature is the old bug and must be GONE). DR-4/DR-5 remain pure GPU acceptance passes. Run `cd apps/web && npm run dev`, port 5180. For every test I give the exact steps, the **CORRECT** result, and the **FAILURE signature** (what the bug looked like).*

| # | What | Type | Prio |
|---|---|---|---|
| DR-1 | Curtailed **bundle** anchorage develops on the **bare Ø**, not φₙ → **wrong-🟢** | ✅ **FIXED in code (R8)** — confirm the fix | 🔴 |
| DR-2 | **Dual skin path** double-counts As,prov (legacy supplement + skin row) | ✅ **FIXED in code (R6)** — confirm the fix (the peau supplement is gone from the panel) | 🟠 |
| DR-3 | **Two-way slab**: a placed band never credits the **Y** direction | ✅ **FIXED in code (R9)** — confirm the fix (use the new span-direction toggle) | 🟠 |
| DR-4 | **Place-by-pointing** pointer path (click-to-drop) on **all 8** — zero automated coverage | 🟠 Acceptance | 🔴 |
| DR-5 | **Slab / joist / stair** 20:1 section render reads well (+ a WebGL stall I hit) | 🟠 Acceptance | 🟠 |
| DR-6 | **Measure** tool — ~~confirm it is still a stub~~ **now implemented (R6)** — confirm two-point distance works | 🟢 Acceptance | 🟢 |

**DR-1 — Curtailed bundle anchorage (🔴 the dangerous one).**
*Goal: confirm the app calls a bundle's end-anchorage "OK" when it is developed on the single-bar Ø, not the bundle's equivalent Ø φₙ = φ·√n. Same class as the R1/F-A lap bug, in the V-E curtailment rule R1 did not touch (`validation/placedBarRules.ts:222` uses `bar.diameter`, never `equivDiameter`).*
1. Select **E-BEM-01** (beam). Note the verdict is 🟢.
2. Tool palette → **Paquet** (Bundle). Set **n = 4**, **Ø = 20**. Place it on the bottom steel (click the section low-centre, or type u=0, v≈−250 and Place).
3. Click the placed bundle → the **Inspector** opens on it.
4. In the inspector's curtailment fields, curtail the **end** to a station that leaves a run of **≈ 1300 mm** (e.g. start = 0, end = 1300), and set the end anchorage to **straight (droit)**.
5. **CORRECT result:** the element should go 🟠/🔴 with a `curtailment_anchorage` alert requiring **≈ 1764 mm** (= l_bd of φₙ = 40 mm). A 1300 mm run is ~25 % short.
6. **FAILURE signature (the bug):** the element stays **🟢 Conforme**; if you open the alert detail it reports "ancrage requis **882 mm**" (= l_bd of the bare Ø 20). *(Headlessly reproduced: run=1323 → `curtailment_anchorage: 🟢 PASS, required=882`.)*

**DR-2 — Dual skin path double-count (= the open R6 item).**
*Goal: confirm skin steel added through BOTH the legacy Supplements panel AND the new skin-row tool is counted twice in As,prov.*
1. Select **E-COL-01**. Read the zone verdict As,prov (e.g. 18.85 cm²).
2. Open the **Suppléments / Avancé** panel, add a **side-face (peau)** supplement, 1 bar Ø12 on a lateral face. Note As,prov rises by ~1.13 cm².
3. Now with the **row/skin tool** add a skin **row** of the same 1 Ø12 on the same face.
4. **CORRECT result:** if these are meant to be the *same* physical steel, adding it "again" the modern way should not stack — or the UI should make clear they are two different bars.
5. **FAILURE signature (the bug):** As,prov rises by **~2.26 cm² (2 × 1.13)** — the same skin steel counted twice, which can flip a deficient element green. *(Headlessly reproduced: base 1885 → supplement 1998 → +row 2111.2 = +2×area(Ø12).)* This is the R6 "retire the dual skin path" item, still live.

**DR-3 — Two-way slab, Y-direction band never credited.**
*Goal: confirm that on a two-way slab a placed band only ever credits the X zone, so a Y deficiency cannot be fixed on the drawing board.*
1. Select **E-SLB-02** (two-way slab). Set As,req for **As_main_y_bot** high enough that the **Y** zone reads **🔴** while **X** is 🟢.
2. Place a bottom **band** (row across the width) intending to fix Y.
3. **CORRECT result:** the Y zone's As,prov should rise and clear (or the tool should tell you it cannot place Y-direction steel).
4. **FAILURE signature (the gap):** **As_main_x_bot** rises (already green), **As_main_y_bot** does **not move** and stays 🔴 — the band you drew and scheduled is invisible to the Y check. *(Headlessly reproduced: MX 523.6→1654.6, MY 523.6→523.6 FAIL.)* Not dangerous (stays conservative/red), but R3's "placed steel feeds As on all 8" is only 3/4 true here.

**DR-4 — Place-by-pointing pointer path on all 8 (🔴 unproven).**
*Goal: the click-to-drop gesture uses `getScreenCTM`, which is null under jsdom, so **every on-canvas placement drag has ZERO automated coverage** — only the typed-coordinate twin is tested. Prove the actual pointer drop works on real GPU. Do this for **each** of the 8 elements.*
For each element (E-COL-01, E-BEM-01, E-COL-02, E-FND-01, E-SLB-01, E-SLB-02, E-SLB-03, E-STR-01):
1. Select the element. Pick the **Barre** (add-single) tool.
2. **Click** a point inside the section canvas (do **not** type a coordinate — use the mouse).
3. **CORRECT:** a bar dot appears **at the clicked point, clamped inside the cover envelope**; it is in the placed list; clicking it opens the inspector; a curtail edit commits.
4. **FAILURE signatures to watch:** nothing drops on click (pointer path dead); the bar lands at the wrong point (CTM/offset wrong); on **E-COL-02 / E-FND-01** (round) a bar drops **outside the disc** (radial clamp not applied); the inspector says "nothing selected" after clicking your own bar (F-C-class regression).
   *Note: on my headless pass the section canvas mounts on all 8 and the typed-coordinate path places+clamps correctly; only the mouse gesture is unverified.*

**DR-5 — Slab / joist / stair section render (+ a stall I observed).**
1. Select **E-SLB-01**, then **E-SLB-03**, then **E-STR-01**. Look at the section canvas.
2. **CORRECT:** the wide-thin (up to ~20:1) concrete reads as a slab, mark dots are legible and not microscopic, distribution steel draws as a **line across the width** (not stacked dots on the centreline). Judge the mark-size / margin heuristic (0.05 / 0.012 / 1.6 / 0.02) that no human has seen.
3. **Observation to confirm/deny:** on my box, switching to **E-SLB-01** made the **3D WebGL viewport stop responding to screenshot capture for >30 s** (the DOM/section canvas stayed responsive, no console error). Please confirm whether the **3D view** of a slab renders smoothly on your GPU or stutters/hangs — it may be a heavy 20:1 flat-box render, or just my headless-capture limitation.

**DR-6 — Measure tool (R6 stub).**
1. Pick the **Mesure** tool. Click two points on the section.
2. **CORRECT (if finished):** it reports the distance between the two points.
3. **CURRENT (expected):** it is a **coordinate readout stub** — no two-point distance. R6 is meant to either finish it or remove the button; confirm which behaviour you see so we know if it still misleads.

---

## §E — Final acceptance / release

| # | Task | Prio |
|---|---|---|
| E-1 | **End-to-end UAT** — a real column + beam project, full PDF/DXF/BBS export, confirm site-usable. | 🔴 for release |
| E-2 | **Sign the release** once §B validations + §D acceptances hold. | 🔴 for release |
| E-3 | **Decide the push/hosting moment** (the dev agents push only on your word). | 🟠 |

---

## The short version — what to do first
1. **§A-8 — the drawing-first default** (v1.0.6 is now feature-complete through N6, so this is the last product call that shapes the app's first impression).
2. **§C-2 / §C-3 — primary market + default code + the BAEL `ls` default** (drives the National-Annex choices; the biggest data lever).
3. **§B-1 — nominate the engineer** so the reference-case validation can start in parallel (long-lead people dependency).
4. **§C-1 — the RPS 2011 zone→ND mapping** (importance-class → ND1/2/3; the A/g table is *not* needed).
5. **§D-9 (+ §D-8, §D-7) — the v1.0.6 GPU passes** on your Windows machine, newest first (the editable elevation is the largest).
6. **§B-12 / §C-8** — the façonnage table + the stock length, to make the schedule + splices site-final.
