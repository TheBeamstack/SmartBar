# core_logic.md — What RebarConfig (SmartBar) is, what it does, and how it is used

> **Audience.** Anyone who needs to understand the *product* in plain language — the owner, a new
> developer on day one, a structural engineer evaluating it, a future investor. No code here.
> For the technical structure, read `architecture_breakdown.md`. For the build contract, read
> `v1.0-Spec.md`; for the as-built status, `current_state.md`.
>
> **This document is direction-aware.** It describes what exists today *and* where the app is
> deliberately heading. Sections marked **[now]** are built (through **v1.0.2**); **[next]** is the
> near roadmap (**v1.0.3** — true geometry + bar-by-bar detailing + real shop drawings); **[later]**
> is the longer arc (**v1.1** — the server jump).

---

## 1. The one-paragraph version

**RebarConfig is a web app for *detailing* the steel reinforcement ("rebar") that goes inside
concrete elements** — columns, beams, slabs, piles, stairs. A structural engineer already knows, from
other analysis software, *how much* steel each part of an element needs. RebarConfig is where they lay
out the *actual bars*: choose diameters, counts, spacings and stirrups; see the cage in live 3D; get
an instant "is this **buildable** and **code-compliant**?" verdict (French **BAEL**, European
**Eurocode 2**, Moroccan seismic **RPS**); and export the paperwork the site needs — the
**bar-bending schedule (BBS)**, **DXF drawings**, and a **PDF sheet**. **v1.0 runs entirely in the
browser** — no server, no account, free to host.

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
  *(An opt-in "proposer" that suggests the smallest valid bar set is a possible convenience — never an
  automatic design.)*
- **Not a BIM/coordination tool in v1.0** — no storeys, grids, or building coordinates yet (that's the
  v1.1 direction, §9).

---

## 4. The two ideas that make it different

### 4.1 Everything structural is **data**, not code [now]
The engine is a generic machine. The *knowledge* — every element type, every bar shape, every
reinforcement scheme, every code rule — lives in **data files** (JSON manifests) and **swappable rule
packs**, not hard-wired in the program. The practical payoff:
- **Adding a new element, bar shape, scheme, or even a whole design code needs no engine rewrite** —
  you add data. This is what lets the product grow *wide* cheaply (see §9).

### 4.2 The **validity layer** — three honest colours [now]
Every check resolves to one of three tiers, and the colour drives what you're allowed to do:
- 🔴 **Hard-invalid** — physically un-buildable or code-forbidden (e.g. bars can't fit). **Blocks
  export.**
- 🟠 **Discouraged / review** — near a limit or unusual. **Warns**, stamps the drawing "À vérifier /
  Review required", but lets an expert continue.
- 🟢 **Compliant** — within the rules.

This mirrors how a good engineer actually thinks: some things are *wrong*, some are *judgement calls*,
most are *fine*.

---

## 5. What you can detail today — the element catalog [now]

Eight element *types* ship in v1.0, each with the full design loop (3D + checks + exports):

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

---

## 6. How you use it — the workflow

1. **Pick the element type** (top bar) and a **reinforcement scheme**.
2. **Set the geometry** (dimensions, cover) on the *Géométrie* tab.
3. **Set materials & exposure** (concrete grade, steel grade, environment) and, for columns/beams, an
   optional **seismic regime** (RPS zone + ductility) on the *Projet/Code* tab.
4. **Enter `As,req` per zone** — the required steel from your analysis (one labelled input per zone).
5. **Choose the bars** on the *Schéma* tab — diameters, counts (or spacings), tie legs ("brins").
   Watch the live **As,prov vs As,req** badge, the **computed effective depth `d`**, the **3D cage**,
   and the **alerts panel**. Failing bars go red.
6. **Add supplements** — e.g. click/type two bars to drop a cross-tie épingle between them; it
   **re-positions itself automatically** if you later move the bars (it's bound to the bars, not to a
   coordinate).
7. **Place coupes** (cross-section drawings A-A, B-B…) where you want them; a live 2D preview shows the
   section.
8. **Build the project** — add more element *types* (P1, P2, B1…), each with a **quantity** (how many
   times it repeats in the building).
9. **Export** — the bar-bending schedule, DXF, a PDF sheet, and/or save the whole project as a `.rcfg`
   file. Your work also **autosaves** in the browser and is recovered if you reopen.

Throughout, **one thing is sacred: every edit re-checks correctness immediately**, and a hard-invalid
state cannot be exported.

---

## 7. What you get out — the deliverables [now]

- **Bar-bending schedule (BBS)** — the fabrication list: one line per distinct bar (identical bars
  merged), with mark, diameter, cut length, count, total length, and **weight**; plus a **steel
  summary** (weight per diameter and the **steel ratio kg/m³** — the standard sanity-check).
- **DXF drawings** — the longitudinal elevation + the cross-section coupes, on the four standard CAD
  layers, readable in any CAD package.
- **PDF sheet** — a title-blocked drawing sheet bundling the views + the schedule + a global
  **status stamp** (🟢 Conforme / 🟠 À vérifier). A 🔴 element **cannot** produce a PDF.
- **`.rcfg` project file** — the whole project saved to a file you can reopen later or share. It is
  **forward-compatible**: a file written by a newer version still opens, nothing is silently dropped.

### Project-level takeoff [now]
The project panel shows, **per element type**: unit steel mass, **total mass = quantity × unit**, and
**steel density (kg/m³)**; plus **project grand totals** (steel, concrete, overall ratio). As of
**v1.0.1** this also flows into the exports: a single **combined PDF** (one sheet per type + a project
summary sheet), a **namespaced project-wide BBS** (`P1-01`, `B3-01`), a **per-type DXF batch**, and a
**per-project export-lock** (any 🔴 type blocks the combined set).

> **Direction (v1.0.3):** the DXF/PDF become full **shop drawings** — leader-lined bar marks
> (`① 3Ø12 l=1.50`), a **bar-bending (façonnage) table**, **coupe + cover dimensions**, stirrup-zone
> notation and **support labels** — and the 3D shows every bar in its **true bent shape**. See §9.1.

---

## 8. Code compliance & the human gate

RebarConfig checks against real design codes:
- **BAEL 91-99** (French, the default), **Eurocode 2** (European), and the **RPS-2011** Moroccan
  seismic overlay — chosen by axis: pick a code, pick a seismic regime, and validation re-runs.
- The codes are implemented as **swappable rule packs** — switching BAEL ↔ EC2 changes only the
  numbers behind the same named checks, nothing else in the app.

**Important honesty:** the numeric constants in those packs are currently **provisional** (the ⚠
"provisoire" pill says so). Before the app is "done" for production, a **qualified structural engineer
must ratify** the constants and the reference cases. That sign-off is a **people dependency on the
critical path** — no amount of coding replaces it. Until then, the math is usable for evaluation but
flagged.

---

## 9. Where it's going — the direction

The product is designed to scale **breadth-first, then depth** — and the architecture has the
"seams" for both built in from day one (so neither requires a rewrite).

### 9.1 **Horizontal — more breadth, then more detailing depth** (no backend) [shipping fast]
Growing capability *without* a backend.

**Already shipped (v1.0.1 → v1.0.2):**
- A **shop-drawing elevation** (columns upright, bar marks, tie-spacing callouts, dimensions), a
  **ViewCube** + **perspective/orthographic** toggle, an in-3D **coupe drag-handle**, and **combined
  multi-element exports** (project PDF + namespaced BBS).
- **Real cross-ties** (épingles that engage *actual* bars, configured on a clickable 2D section),
  **per-zone stirrup spacing** along the length, a **sticky per-zone As,prov/As,req readout**, a
  focus-friendly **panel layout**, **in-plane view roll**, and the first **façonnage editor** (pick a
  bar's shape — straight, hooked, cranked, bent-up).

**Next — v1.0.3, the shop-drawing detailing leap [next]:** the biggest jump since v1.0 — turning the
schematic cage into a *geometry-faithful* model and the exports into *real fabrication drawings*:
- **True bar geometry** — bars are drawn in their actual bent shapes (hooks, cranks, relevés, the
  spiral coil, the stair profile), with façonné endpoints visibly leaving the concrete — so the 3D
  matches what gets built.
- **Bar-by-bar detailing** — shape, hook, length or replace **individual** bars (not just whole
  groups), add **independent** bars, and place steel on **multiple section levels** (e.g. the U-bars
  just under the top bars over a support).
- **Real beam supports** — two distinct supports (V1/V2) with their own chapeaux, anchorage and
  widths, **bent-up bars (relevés)**, and stirrup zones that **auto-densify** near the supports.
- **Lap splices & couplers** — bars too long for stock are spliced with code lap lengths (staggered)
  or joined by couplers, all scheduled and drawn.
- **Proper shop drawings** — leader-line bar annotations (`① 3Ø12 l=1.50`), **per-element bar marks**,
  **coupe markers (A-A/B-B)**, **stirrup-zone notation** (`11×9`), **support labels + dimensions**,
  section **cover dimensions**, and a **bar-bending (façonnage) table** — matching a real drawing.

**Further out [later]:**
- **More elements:** shear walls, isolated/strap footings, waffle slabs, retaining walls, L- and
  spiral stairs — each a new data manifest.
- **More codes:** the full EC2 rule-set with a UI picker, then BS 8666 / ACI 315 conventions.
- **New reinforcement technology:** **prestressing / post-tensioning** (tendons) — the data model
  already reserves the slot for it.

### 9.2 **Vertical — more depth** (v1.1) [later]
The jump that needs a server:
- **Accounts, cloud sync, teams.**
- **IFC export** (`IfcReinforcingBar` / `IfcReinforcingMesh`) for BIM hand-off.
- **A project that knows the building** — storeys, grids, positions, cross-element schedules, BIM
  coordinates — not just a flat list of typed elements.

**The key design bet:** the v1.0 engine is a **pure, framework-free machine**. The same engine that
powers today's browser app is meant to run **unchanged on the v1.1 server** — the browser today, the
cloud tomorrow, the same trustworthy core in both. That is why the engine is kept ruthlessly free of
anything browser-specific (see `architecture_breakdown.md`).

---

## 10. One-line summary

> **RebarConfig turns "how much steel does this need?" (input) into a buildable, code-checked,
> site-ready rebar design (3D + BBS + drawings) — instantly, in the browser — and is built as a
> generic, data-driven engine so it can grow to any element, any code, and a cloud backend without
> being rewritten.**
