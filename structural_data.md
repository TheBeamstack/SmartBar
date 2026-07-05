# structural_data.md — Sourced code constants for the SmartBar code packs

> **Purpose.** Replace the *provisional guesses* in the code packs (`packages/codepacks`) with **accurate values
> sourced from the published standards** (BAEL 91-99, Eurocode 2 / EN 1992-1-1, RPS 2011). This is the reference
> the v1.0.4 build fills the pack JSON from (spec Track **A1**). Every value carries a source. **Honesty note:**
> these are the *published constants + formulas*; a qualified structural engineer should still validate that the
> app *applies* them correctly (the reference-case suite in A1 exists for exactly that professional review) — but
> the app no longer ships invented numbers. Values still needing an authoritative source are marked **⛳ OPEN →
> owner/engineer**.
>
> **Owner ruling captured (2026-07-05):** *effective depth `d` is measured to the **geometric (area-weighted)
> centroid of the bar cross-sections***, and *provided steel area `As` is the plain geometric sum of the bar
> cross-sections* `Σ (π/4)·Øᵢ²`. Both are exact geometry — **not** engineer-gated. This matches the existing
> `D-P1-5` (area-weighted `d`/`d'` from real bar centroids). Consequence: v1.0.4 **A2/H5** compute As + `d` exactly
> for mixed diameters and mixed levels — no placeholder.

**Authored:** 2026-07-05 (Zayd), from an advanced web search of the published standards. **Date of standards:**
BAEL 91 rev. 99 · EN 1992-1-1:2004+AC:2010 · RPS 2011.

---

## 1. Effective depth & provided area (owner ruling — exact, all packs)
- **Provided area** per zone: `As,prov = Σ (π/4)·Øᵢ²` over the bars credited to that zone (geometry).
- **Effective depth** `d` = distance from the extreme compression fibre to the **area-weighted centroid** of the
  tension bars: `d = h − cover − Σ(Aᵢ·yᵢ)/Σ(Aᵢ)` (yᵢ = each bar's distance from the tension face to its centre).
  `d'` symmetric for compression steel. Mixed diameters/levels handled exactly by the area weighting.
- **Which bars count** toward a zone's requirement: bars physically in that zone's tension/compression region
  (by their `(u,v)` vs the neutral region). *(The geometry is exact; the region split follows the element's
  validation profile — confirm the edge conventions with the engineer in the A1 review, but no constant is
  invented.)*

## 2. Eurocode 2 (EN 1992-1-1) pack
**Minimum mandrel diameter Ø_m,min (Table 8.1N).** Bars/wires: **4Ø for Ø ≤ 16 mm**, **7Ø for Ø > 16 mm**. Plus
the detailing rule: a bar bent < 5Ø past the end of a bend, or at a concrete edge without another bar ≥ 1Ø inside
the bend, needs a larger mandrel. *(Links/stirrups use the same table by bar Ø.)*
**Ultimate bond stress:** `fbd = 2.25·η1·η2·fctd`, `fctd = αct·fctk,0.05/γc` (αct = 1.0, γc = 1.5). `η1 = 1.0`
(good bond) / `0.7` (poor); `η2 = 1.0` for Ø ≤ 32 mm, else `(132−Ø)/100`.
**Basic anchorage:** `lb,rqd = (Ø/4)·(σsd/fbd)`.
**Design anchorage:** `lbd = α1·α2·α3·α4·α5·lb,rqd ≥ lb,min`; each αᵢ ∈ [0.7, 1.0] (bar shape / cover / transverse
steel / welded / transverse pressure), constraint `α2·α3·α5 ≥ 0.7`. `lb,min` = max(0.3·lb,rqd, 10Ø, 100 mm)
tension; max(0.6·lb,rqd, 10Ø, 100 mm) compression.
**Design lap:** `l0 = α1·α2·α3·α5·α6·lb,rqd ≥ l0,min`; `α6 = (ρl/25)^0.5`, clamped **[1.0, 1.5]** (ρl = % of bars
lapped within 0.65·l0 of the section centre). `l0,min` = max(0.3·α6·lb,rqd, 15Ø, 200 mm).
**Lap staggering (§8.7.2):** `α6 = 1.5` when > 50 % of bars are lapped at a section → the design encourages **≤ 50 %
lapped in one section** (this is the B1 stagger fraction, EC2 default). Longitudinal offset between adjacent laps
≥ 0.3·l0.
**Typical values** (C25/30, fyk 500, γc 1.5): straight `lbd` **41Ø** (good) / 58Ø (poor); `l0` **61Ø** (good) /
87Ø (poor); bent bars w/ cover ~29Ø/43Ø.
**Clear spacing between bars:** `≥ max(k1·Ø, dg + k2, 20 mm)`, recommended **k1 = 1.0, k2 = 5 mm** (UK/IE/most NAs;
FI uses k2 = 3, NO uses k1 = 2 — a National-Annex choice → `⛳ OPEN` which NA for Morocco/France).
**Minimum cover cmin,dur (Table 4.4N)** by exposure + structural class: XC1 10 mm … XC2 25 mm … XD/XS 20–45 mm;
`cnom = cmin + Δcdev`, Δcdev = 10 mm default, round up to 5 mm. Exact per-class values `⛳ OPEN → owner` (which
exposure classes to ship + the structural-class assumption).

*Sources:* [EC2 mandrel](https://eurocodeapplied.com/design/en1992/bar-bending-mandrel-diameter) ·
[EC2 anchorage/lap table](https://eurocodeapplied.com/design/en1992/anchorage-and-lap-length-table) ·
[EC2 clear distance (k1/k2)](https://usingeurocodes.com/en/eurocode-2-1-1/Clause/NDP/82_2) ·
[EC2 cover](https://eurocodeapplied.com/design/en1992/concrete-cover).

## 3. BAEL 91-99 pack (French — the app's default market)
**Straight embedment (scellement droit):** `ls = Ø·fe / (4·τsu)`.
**Bond stress:** `τsu = 0.6·ψs²·ftj`; `ψs = 1.5` (HA / high-adhesion ribbed — the default), `1.0` (RL / smooth).
**Concrete tensile strength:** `ftj = 0.6 + 0.06·fcj` (MPa; fcj = fc28 at 28 days). *(For C25 → ftj = 2.1 MPa →
τsu = 0.6·1.5²·2.1 = 2.835 MPa → ls ≈ Ø·500/(4·2.835) ≈ 44Ø — matches the flagged `D-P1-2` ≈44Ø vs tabulated 40Ø:
the 40Ø is the BAEL *simplified tabulated* value for FeE500/C25; ship 40Ø as the tabulated option, 44Ø as the
computed — `⛳ OPEN` which the owner wants as default.)*
**Minimum radius of curvature (mandrel):** longitudinal HA **R ≥ 5.5Ø** (RL 3Ø); transverse HA **R ≥ 3Ø** (RL 2Ø).
**Standard hook (crochet normal, 180°):** semicircle + straight return = **2Ø** past the bend; anchorage with a
standard hook credits roughly `la ≈ 0.4·ls` for HA (the α/β model: for θ = 180°, α ≈ 3.51, β ≈ 6.28 with friction
φ = 0.4).
**Cover (enrobage)** by fissuration/exposure: ~**1 cm** (protected interior), **3 cm** (exterior/exposed), **5 cm**
(aggressive/marine). Exact policy `⛳ OPEN → owner`.
**Clear spacing:** horizontal ≥ max(Ø, cg) and vertical ≥ max(Ø, 1.5·cg) where cg = max aggregate; standard
practice uses the aggregate size dg → `⛳ OPEN` default dg.
**Partial safety factors:** γc = 1.5, γs = 1.15 (fundamental); 1.15 / 1.0 (accidental). Standard — confirm.

*Sources:* [BAEL adhérence/scellement (IUT)](https://public.iutenligne.net/genie-civil/beton-arme/hivin/beton_arme/documents/Cours_BA_ST2_chap_3.pdf) ·
[BAEL 91 rév.99 (texte)](https://www.sodibet.com/telechargement/BAEL%2091%20R%2099.pdf) ·
[Résumé organigrammes BAEL](https://geniecivilpdf.com/wp-content/uploads/R%C3%A9sum%C3%A9-BAEL-2015.pdf).

## 4. RPS 2011 seismic overlay (Morocco)
**Ductility levels:** **ND1, ND2, ND3** (increasing ductility; chosen by the building's importance + seismic zone).
**Column critical-zone length:** `lc = max(he/6, hc, 45 cm)` (he = clear height, hc = larger section dimension).
**Transverse spacing — critical zone:** `s = min(8·ØL, 0.25·bc, 15 cm)`; **ordinary zone:** `s = min(12·ØL,
0.5·bc, 30 cm)` (ØL = longitudinal Ø, bc = column dimension).
**Confinement/nodes by ND class:** ND1/ND2 — node transverse ratio ≥ the column-end ratio; ND3 — node ratio = the
column's (halved when 4 beams frame the node).
**Velocity zones Vmax (10 %/50 yr, 475-yr return):** Zone 0 = 0.00, **Zone 1 = 0.07, Zone 2 = 0.10, Zone 3 = 0.13,
Zone 4 = 0.17 m/s**.
**Acceleration zones Amax (A/g):** five zones Za = 0…4 — **⛳ OPEN → owner** (the exact A/g per zone must come from
the official RPS 2011 document; scanned sources didn't yield a clean table, and a seismic acceleration table must
be exact). *Also OPEN:* the site/soil coefficients, the importance/priority classes → ND mapping, and the
behaviour factor K per structure type + ND.

*Sources:* [RPS zones (Dlubal)](https://www.dlubal.com/fr/zones-de-neige-de-vent-et-de-sismicite/sismicite-rps.html) ·
[RPS 2011 critical-zone spacing (CivilMania)](https://www.civilmania.com/topic/24402-espacement-des-cadre-zone-nodale-poteaux/) ·
[Guide RPS 2011 officiel (MHPV)](https://www.mhpv.gov.ma/wp-content/uploads/2023/10/Guide-RPS-2011-V2011-Francais.pdf) *(403 to the fetcher — owner can open it)*.

## 5. Fabrication geometry (all packs — geometric, not code guesses)
- **Bend deduction** is *geometry*, not a code constant: the difference between the sharp-corner polyline and the
  true **filleted centreline** at each bend, using the code **mandrel radius** (§2/§3) + Ø/2. The generator already
  computes this (`segment-grammar.ts`); the only code input is the mandrel radius. → no provisional value needed.
- **Hook allowance** = the straight return past the bend: EC2/BAEL standard **≥ 10Ø** (and ≥ 70 mm) for a
  90°/135° anchorage hook; **2Ø** return for a 180° BAEL crochet after the semicircle. Matches the current
  `UserHook` default (`extFactor 10`, min 70).
- **Stock bar length** (for auto-split / laps): **⛳ OPEN → owner** — commercial bars in France/Morocco are
  typically 12 m (also 6 m); confirm the default.

## 6. Data still needed to reach a complete, accurate SmartBar (→ `v1.0.4_owner_tasks.md §B/§C`)
1. **RPS 2011 acceleration table** (A/g per zone 0–4) + soil coefficients + importance→ND mapping + K factors.
2. **Default code** (BAEL vs EC2) + **primary market** (Morocco/France) → the National-Annex choices (EC2 k1/k2,
   cover classes) and the BAEL `ls` default (computed 44Ø vs tabulated 40Ø).
3. **Diameter set** offered (HA range, e.g. 6/8/10/12/14/16/20/25/32/40).
4. **Default materials:** fc28 (e.g. 25 MPa), fe (e.g. 500 MPa), steel type (HA default).
5. **Exposure/cover policy:** which exposure classes to ship + the cover value per class (or "use code default +
   structural class S4").
6. **Default aggregate size dg** (for clear spacing, e.g. 20 or 25 mm).
7. **Stock bar length** (12 m?).
8. **Partial safety factors** confirmation (γc 1.5 / γs 1.15 fundamental).
9. **Whether a licensed engineer will formally validate** the reference-case suite (liability / the app's own
   "à ratifier" stance).
