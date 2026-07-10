# core_logic.md — What RebarConfig (SmartBar) is, what it does, and how it is used

> **Audience.** Anyone who needs to understand the *product* in plain language — the owner, a new
> developer on day one, a structural engineer evaluating it, a future investor. No code here.
> For the technical structure, read `architecture_breakdown.md`. For the build contract, read
> `v1.0-Spec.md` (and the per-version specs); for the as-built status, `current_state.md`.
>
> **This document is direction-aware.** It describes what exists today *and* where the app is
> deliberately heading. Sections marked **[now]** are built (through **v1.0.4**); **[next]** is the
> near roadmap — **v1.0.5** (bar-level detailing depth: place any bar, of any shape, at any position, on
> every element — see `v1.0.5_spec.md`) then **v1.0.6** (the **drawing-board UI** — see `v1.0.6_spec.md`);
> **[later]** is the longer arc (**v1.1** — the server jump). The app's **intended default form is a
> bar-level detailer you operate *on the drawing***; where a part of that form is specced-but-not-yet-built
> it is tagged **[1.0.5]** / **[1.0.6]** so nothing here is mistaken for shipped.

---

## 1. The one-paragraph version

**RebarConfig is a web app for *detailing* the steel reinforcement ("rebar") that goes inside
concrete elements** — columns, beams, slabs, piles, stairs. A structural engineer already knows, from
other analysis software, *how much* steel each part of an element needs. RebarConfig is where they lay out
the *actual bars*: **placing any bar, of any shape, at any relevant position** — single bars, counted rows,
extra layers, bundles, side-face steel — with curtailment, lap splices and stirrups; seeing the cage in live
3D; getting an instant "is this **buildable** and **code-compliant**?" verdict (French **BAEL**, European
**Eurocode 2**, Moroccan seismic **RPS**); and exporting the paperwork the site needs — the **bar-bending
schedule (BBS)**, **DXF drawings**, and a **PDF sheet**. **It runs entirely in the browser** — no server, no
account, free to host. The app is being shaped into a tool a detailer **works on the drawing**, not a form
they fill in (§6, §9).

---

## 2. The problem it solves

Detailing rebar today is done by hand in CAD or spreadsheets. It is slow, error-prone, and the
"is this actually allowed by the code / can a worker physically build it?" check happens late, on
paper, by a senior engineer. Mistakes (bars too close to fit a vibrator, a lap splice landing in the
wrong place, a stirrup hook that won't hold in an earthquake) are caught at review or — worse — on
site.

RebarConfig moves that check to **the moment of design**:
- You change a bar; the **3D updates and the compliance verdict updates in the same instant** (under
  16 ms — it feels live, like dragging a slider).
- A **bar that breaks a hard rule turns red** and **blocks the export** until it's fixed.
- A **bar that's merely discouraged** shows an amber warning but lets an expert proceed.

It compresses "draw it → send to review → get red ink back → redraw" into a single tight loop.

---

## 3. What it is **not** (scope, on purpose)

- **Not a structural-analysis tool.** It does **not** compute moments, shears, or the required steel
  area. You bring `As,req` (required steel per zone) *in*; RebarConfig checks whether the bars you
  chose satisfy it and are buildable. It is a **checker, not a solver of the structure** — and a
  **checker, not an optimizer**: it tells you if your choice works, it doesn't auto-pick bars for you.
  Free bar-by-bar placement (§6) is **manual detailing you do**, not automatic design; the tool still only
  *checks* what you drew. *(An opt-in "proposer" that suggests the smallest valid bar set is a possible
  convenience — never an automatic design.)*
- **Not a BIM/coordination tool yet** — no storeys, grids, or building coordinates (that's the v1.1
  direction, §9).

---

## 4. The two ideas that make it different

### 4.1 Everything structural is **data**, not code [now]
The engine is a generic machine. The *knowledge* — every element type, every bar shape, every
reinforcement scheme, every code rule — lives in **data files** (JSON manifests) and **swappable rule
packs**, not hard-wired in the program. The practical payoff:
- **Adding a new element, bar shape, scheme, or even a whole design code needs no engine rewrite** —
  you add data. This is what lets the product grow *wide* cheaply (see §9).
- The same generic machine places **any bar form** — a single bar, a counted row, an extra layer, a
  bundle, a side-face row — at **any position on any element**, through **one data-driven placed-bar
  model** rather than per-element code [1.0.5]. Free detailing rides the same thesis as everything else.

### 4.2 The **validity layer** — three honest colours [now]
Every check resolves to one of three tiers, and the colour drives what you're allowed to do:
- 🔴 **Hard-invalid** — physically un-buildable or code-forbidden (e.g. bars can't fit, a bundle too
  large, a bar outside the concrete). **Blocks export.**
- 🟠 **Discouraged / review** — near a limit or unusual. **Warns**, stamps the drawing "À vérifier /
  Review required", but lets an expert continue.
- 🟢 **Compliant** — within the rules.

This mirrors how a good engineer actually thinks: some things are *wrong*, some are *judgement calls*,
most are *fine*. A design sitting exactly **at** a code minimum is 🟢, never amber — amber is reserved for
being genuinely *near or under* a limit (a deliberate correctness rule, §8).

---

## 5. What you can detail today — the element catalog [now]

Eight element *types* ship with the full design loop (3D + checks + exports):

| Element | Plain meaning |
|---|---|
| **Rectangular tied column** | A normal building column with rectangular ties (cadres). |
| **Circular spiral column** | A round column with a continuous spiral. |
| **Rectangular beam** | A normal beam: bottom (span) steel, top steel, chapeaux over supports, stirrups. |
| **Drilled-shaft pile** | A deep foundation cage. |
| **One-way slab** | A floor slab spanning one direction. |
| **Two-way slab** | A floor slab spanning both directions (+ corner-torsion steel). |
| **Hollow-block joist slab** | A ribbed floor (nervures + hourdis + topping mesh). |
| **Straight-flight stair** | A staircase flight + landing. |

Each carries **reinforcement schemes** (e.g. a column with ties, or ties + cross-ties) and a catalog
of **supplemental add-ons** (cross-ties/épingles, skin bars, diamond ties, …) you click or type to add.
Beyond the guided schemes, **every element is meant to accept free bar-by-bar detailing** — any bar, of any
shape, at any position: single bars, **counted rows**, **extra layers**, **bundles**, and **side-face (skin)
steel**, each **curtailable**, **lappable**, and scheduled [1.0.5]. *(Today's build already does per-bar
detailing on columns and beams; v1.0.5 generalises it — free placement, the new bar forms, and all eight
elements — and v1.0.6 makes it a drawing-board you edit directly.)*

---

## 6. How you use it — the workflow

1. **Pick the element type** (top bar) and a **reinforcement scheme**.
2. **Set the geometry** (dimensions, cover) on the *Géométrie* tab.
3. **Set materials & exposure** (concrete grade, steel grade, environment) and, for columns/beams, an
   optional **seismic regime** (RPS zone + ductility) and the **design code** (BAEL / Eurocode 2).
4. **Enter `As,req` per zone** — the required steel from your analysis (one labelled input per zone).
5. **Detail the bars — on the drawing.** Start from the guided scheme (a column's ties, a beam's
   span + chapeaux over its two supports) and then **place and edit any bar directly**: pick a shape from
   the palette and drop it at any position on the cross-section; add **counted rows**, **extra layers**,
   **bundles**, and **side-face (skin) steel**; **curtail** a bar by dragging its end, drop **laps /
   couplers**, and bend bars up — on every one of the eight elements. Watch the live **As,prov vs As,req**
   badge, the computed effective depth **d**, the **3D cage**, and the **alerts panel**. Failing bars go
   red. *(The **capability** — free placement of any bar/shape/position, on all elements — is [1.0.5]; the
   **drawing-board** you do it on, editing the section and the longitudinal elevation directly with a tool
   palette and a per-bar inspector, is [1.0.6]. Until then you place bars through the side panel.)*
6. **Add cross-ties & supplements** — e.g. click two bars on the section to drop a cross-tie épingle
   between them; it **re-positions itself automatically** if you later move the bars (it's bound to the
   bars, not to a coordinate).
7. **Place coupes** (cross-section drawings A-A, B-B…) where you want them; a live 2D preview shows the
   section, including any bars you placed off the main grid.
8. **Build the project** — add more element *types* (P1, P2, B1…), each with a **quantity** (how many
   times it repeats in the building).
9. **Export** — the bar-bending schedule, DXF, a PDF sheet, and/or save the whole project as a `.rcfg`
   file. Your work also **autosaves** in the browser and is recovered if you reopen.

Throughout, **one thing is sacred: every edit re-checks correctness immediately**, and a hard-invalid
state cannot be exported. The design target is that **what you draw == what is validated == what is
scheduled == what is saved**, for every bar you place.

---

## 7. What you get out — the deliverables [now]

- **Bar-bending schedule (BBS)** — the fabrication list: one line per distinct bar (identical bars
  merged), with mark, diameter, cut length, count, total length, and **weight**; plus a **steel
  summary** (weight per diameter and the **steel ratio kg/m³** — the standard sanity-check). The schedule
  is moving to the **French façonnage convention** (the shape nomenclature and column layout a French
  bending shop reads) [1.0.5].
- **DXF drawings** — the longitudinal elevation + the cross-section coupes, on the four standard CAD
  layers, readable in any CAD package, with leader-lined bar marks, a **bar-bending (façonnage) table**,
  coupe + cover dimensions, stirrup-zone notation and support labels.
- **PDF sheet** — a title-blocked drawing sheet bundling the views + the schedule + a global
  **status stamp** (🟢 Conforme / 🟠 À vérifier). A 🔴 element **cannot** produce a PDF.
- **`.rcfg` project file** — the whole project saved to a file you can reopen later or share. It is
  **forward-compatible** (a file written by a newer version still opens, nothing silently dropped) and
  **lossless** — the full per-bar detail is saved in the canonical model, so a future server, BIM/IFC
  export, or another tool reads the real bars, not just this app's private copy [1.0.5].

### Project-level takeoff [now]
The project panel shows, **per element type**: unit steel mass, **total mass = quantity × unit**, and
**steel density (kg/m³)**; plus **project grand totals** (steel, concrete, overall ratio). This flows into
the exports: a **combined PDF** (one sheet per type + a project summary sheet), a **namespaced
project-wide BBS** (`P1-01`, `B3-01`), a **per-type DXF batch**, and a **per-project export-lock** (any 🔴
type blocks the combined set).

> **Direction ([1.0.5] → [1.0.6]):** the schedule adopts the French façonnage nomenclature and every
> freely-placed bar (rows, layers, bundles, skin, curtailed bars) is drawn and scheduled faithfully; then
> the exports and the on-screen model are edited **on the drawing** rather than through a form. See §9.

---

## 8. Code compliance & the human gate

RebarConfig checks against real design codes:
- **BAEL 91-99** (French, the default), **Eurocode 2** (European), and the **RPS-2011** Moroccan
  seismic overlay — chosen by axis: pick a code, pick a seismic regime, and validation re-runs.
- The codes are implemented as **swappable rule packs** — switching BAEL ↔ EC2 changes only the
  numbers behind the same named checks, nothing else in the app.

**Important honesty:** the numeric constants in those packs are currently **provisional** (the ⚠
"provisoire" pill says so). There are two kinds. Most are **published values** (cover tables, minimum-steel
ratios, lap and bundle rules) that a developer transcribed from the standard — "provisional" here means a
**licensed engineer has not yet ratified** the transcription and reference cases, not that the number is
unknown. A few are **choices the standards don't publish** — the "how near a limit turns amber" tolerance
bands, and some bend-geometry approximations — which are genuine engineering-judgement calls. Before the app
is "done" for production, a **qualified structural engineer must ratify** both. That sign-off is a **people
dependency on the critical path** — no amount of coding replaces it. Until then, the math is usable for
evaluation but flagged.

---

## 9. Where it's going — the direction

The product is designed to scale **breadth-first, then depth** — and the architecture has the
"seams" for both built in from day one (so neither requires a rewrite). The **default form the app is being
shaped into is a bar-level detailer operated on the drawing** (§1, §6); the roadmap below is how it gets there.

### 9.1 **Horizontal — more breadth, then more detailing depth** (no backend) [shipping fast]
Growing capability *without* a backend.

**Already shipped (through v1.0.4):**
- The eight-element catalog with the full loop; **real cross-ties** (épingles that engage *actual* bars),
  **per-zone stirrup spacing** and **user spacing regions**, a **sticky per-zone As,prov/As,req/d readout**,
  a **façonnage editor** (pick a bar's shape — straight, hooked, cranked, bent-up — with a live sketch), a
  **ViewCube** + perspective/orthographic + in-3D **coupe drag-handle** + view roll + hand-pan.
- **True bar geometry** — bars drawn in their real bent shapes (hooks, cranks, relevés, the spiral coil, the
  stair profile), façonné endpoints visibly leaving the concrete.
- **Bar-by-bar detailing (first cut)** — shape / hook / length / replace **individual** bars, add
  **independent** bars, and place steel on **multiple section levels** — on columns and beams.
- **Real beam supports** (two distinct supports V1/V2 with their own chapeaux, anchorage and widths),
  **bent-up bars (relevés)**, and stirrup zones that densify near supports.
- **Lap splices & couplers** (staggered, code lap lengths, scheduled and drawn).
- **Proper shop drawings** — leader-line bar marks (`① 3Ø12 l=1.50`), per-element marks, coupe markers,
  stirrup-zone notation, support labels, section cover dimensions, and a bar-bending table.

**Next — v1.0.5, the detailing-depth leap [1.0.5]** (see `v1.0.5_spec.md`): turning bar-by-bar detailing
into **true free detailing** so a rebar-detailing firm can draw anything.
- **Fix the placement defects** — a beam's top steel drawn correctly over **both** supports; a per-bar
  **curtailment** model replacing an inert "fraction anchored at support" control.
- **Free placement on all eight elements** — any bar, of any shape, at any position, as **single bars**,
  **counted rows**, **extra layers**, **bundles**, and **side-face (skin) steel**, each curtailable and
  lappable — not just columns and beams, not one bar at a time.
- **Every added/removed bar feeds the checks honestly** — the three-tier verdict extended to bundles,
  layers, skin steel and curtailment (🔴 un-buildable / 🟠 judgement).
- **French façonnage schedule** and a **lossless canonical file** (§7).

**Then — v1.0.6, the drawing-board UI [1.0.6]** (see `v1.0.6_spec.md`): the app stops being a form you
fill in and becomes a **drawing you work on**.
- One **editable section canvas** and an **editable longitudinal elevation** around the always-on live 3D.
- A **tool palette** (place a bar / row / bundle / layer, link a cross-tie) and **place-by-pointing** — drop
  any shape where you want it, drag a bar's end to curtail it, drag stirrup-zone boundaries.
- A **contextual inspector** — select a bar and edit just that bar — replacing the long parameter form (which
  stays as an advanced fallback). Every gesture keeps a **numeric + keyboard equivalent** (nothing becomes
  mouse-only).

**Further out [later]:**
- **More elements:** shear walls, isolated/strap footings, waffle slabs, retaining walls, L- and
  spiral stairs — each a new data manifest.
- **More codes:** the full EC2 rule-set, then BS 8666 / ACI 315 shape-code and schedule conventions.
- **New reinforcement technology:** **prestressing / post-tensioning** (tendons) — the data model
  already reserves the slot for it.

### 9.2 **Vertical — more depth** (v1.1) [later]
The jump that needs a server:
- **Accounts, cloud sync, teams.**
- **IFC export** (`IfcReinforcingBar` / `IfcReinforcingMesh`) for BIM hand-off — enabled by the lossless
  canonical model landing in v1.0.5.
- **A project that knows the building** — storeys, grids, positions, cross-element schedules, BIM
  coordinates — not just a flat list of typed elements.

**The key design bet:** the engine is a **pure, framework-free machine**. The same engine that
powers today's browser app is meant to run **unchanged on the v1.1 server** — the browser today, the
cloud tomorrow, the same trustworthy core in both. That is why the engine is kept ruthlessly free of
anything browser-specific (see `architecture_breakdown.md`).

---

## 10. One-line summary

> **RebarConfig turns "how much steel does this need?" (input) into a buildable, code-checked,
> site-ready rebar design (3D + BBS + drawings) — instantly, in the browser — by letting a detailer place
> *any bar, of any shape, at any position* on the drawing, and is built as a generic, data-driven engine so
> it can grow to any element, any code, and a cloud backend without being rewritten.**
