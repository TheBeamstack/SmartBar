# deployment_readiness.md — SmartBar → Cloudflare Pages readiness review

> **Purpose.** A deployment-focused technical review, done by reading `core_logic.md` (product intent),
> `current_state.md` / `architecture_breakdown.md` (as-built reality), `owner_tasks.md` / `roadmap_directions.md` /
> `structural_data.md` (open people-dependencies), and then **verifying every claim against the live repository**
> rather than trusting the docs: a clean `npm install`, the full `npm run check` gate, a full `npx vitest run`,
> a production `vite build` with real chunk sizes, an `npm audit`, and a source-level trace of the PDF-export
> import chain — which turned out **not** to match its own "it's lazy-loaded" documentation (§4.1).
>
> **Scope.** This is a technical deployment review, not structural-engineering or legal advice — §6's
> engineering-sign-off and licensing items are flagged for exactly the qualified people the project's own docs
> already name for them (`owner_tasks.md §B-1`).
>
> **Reviewed:** 2026-09-09, against `main` @ `6d047b6`. **Updated:** 2026-09-09 — added the "Powered by beamstack"
> attribution footer (§3.1) and re-verified §4.2 against it.

---

## §0. The verdict

Three separate questions, three separate answers — the code is ready sooner than the product is.

| Question | Verdict | Why |
|---|---|---|
| **Architecture fit for Cloudflare** | ✅ Excellent | Pure client-side SPA, zero backend, zero secrets, zero outbound network calls. Close to the ideal Cloudflare Pages workload. |
| **Code & build health** | ✅ Green, verified live | 996/996 tests pass, purity + manifest gates pass, both typechecks pass, the production build succeeds. |
| **Release readiness** | 🟠 Not yet | Engineering sign-off, licence-notice hygiene, and a handful of Cloudflare-specific setup steps stand between "builds clean" and "safe to point a domain at." |

**Bottom line** — you can put this on Cloudflare Pages *this week* as a preview deployment with no code changes;
the app has no server dependency to fight. Treating it as a **public, load-bearing** product — one a real
detailer might build from — needs the six items in §4 closed first; §6 is the difference between "runs" and "is
what the licence, the disclaimer, and the owner's own `owner_tasks.md` say it should be."

---

## §1. What SmartBar is, in one breath

SmartBar (RebarConfig) is a browser-based detailer for reinforced-concrete steel: a structural engineer supplies
the required steel area per zone, and SmartBar places the actual bars — singles, rows, layers, bundles, skin
steel, curtailed and spliced — in live 3D, checks them against BAEL 91-99 / Eurocode 2 / the RPS-2011 Moroccan
seismic overlay, and exports the bar-bending schedule, DXF drawings and a PDF sheet. Every check resolves to one
of three tiers — 🟢 pass / 🟠 review / 🔴 blocked — and a blocked bar cannot be exported. The engine runs entirely
in the browser by design: no server, no account, no database.

---

## §2. Why that makes it a strong Cloudflare fit

The product's own architecture doc (`architecture_breakdown.md`) makes "no DOM/React/three in the engine" a hard,
CI-enforced invariant — and it holds. That purity is what made the checks below possible:

| Property checked | Finding |
|---|---|
| Outbound network calls | **None** — no `fetch`/`XHR`/`axios` anywhere in the app or engine |
| Environment variables / secrets | **None** — no `import.meta.env` or `process.env` reads in `apps/web` |
| Server-side code | **None** — persistence is `.rcfg` file download/import + browser IndexedDB autosave |
| Client-side routing | **None** — single view, no `react-router`; no SPA-fallback rewrite needed |

There is nothing in this app that a Cloudflare Worker needs to do. It is a static bundle plus assets. The
"Workers & Pages combined" product covers this trivially — Pages' static-asset serving is the entire requirement;
no Worker function is needed unless a future v1.1 server jump (accounts, IFC export — already a deliberately
separate, later phase on the roadmap) is brought forward.

---

## §3. Build & test health — verified this session

Not taken from the docs — re-run live, from a clean `npm install`, against the current `main`.

| Gate | Result | Command |
|---|---|---|
| Engine purity (`packages/core` stays free of React/three/DOM) | ✅ Pass | `npm run check:purity` |
| Manifest integrity (16 shapes, 8 elements, 10 schemes, 7 supplements, schema-valid + cross-referenced) | ✅ Pass | `npm run check:manifests` |
| TypeScript — engine + web app | ✅ Pass, zero errors | `npm run typecheck` / `typecheck:web` |
| Test suite — **997 tests / 163 files** | ✅ All green | `npx vitest run` (260s) |
| Production build | ✅ Succeeds | `npm run build` (in `apps/web`) |
| `npm audit --omit=dev` | 🟠 2 findings | see §4.3 |

Production bundle, measured from this build (post-footer, §3.1):

| Chunk | Minified | Gzip | Contents |
|---|---|---|---|
| `three-*.js` | 1,045.6 KB | 291.6 KB | three.js + R3F + drei — the 3D viewport vendor chunk |
| `index-*.js` (app) | 940.0 KB | 274.6 KB | app + engine + **all** exporters, incl. pdf-lib — see §4.1 |
| `index-*.js` (vendor) | 439.2 KB | 181.5 KB | React + Zustand + remaining deps |
| `index-*.css` | 20.4 KB | 4.4 KB | app styles |

≈2.4 MB uncompressed / ≈750 KB gzip total JS+CSS. No size concern for Cloudflare Pages, but larger than the
codebase's own comments expect — see §4.1.

### 3.1 — New: the "Powered by beamstack" attribution footer

Added and verified live in this pass (screenshotted against the real dev server with a headless Chromium — the
app, including the 3D viewport, renders correctly). A slim bar now sits under the workspace on every screen:
a small reproduction of the Beamstack mark, "beam" in the app's light text colour, "**stack**" in Beamstack's own
brand blue (`#4C8DFF`, taken directly from beam-stack.com's shipped CSS tokens, not from SmartBar's own `--accent`
cyan), linking to `https://beam-stack.com` in a new tab. Implementation: `apps/web/src/ui/Footer.tsx` + a small
block of CSS in `styles.css`; covered by `apps/web/src/ui/footer.spec.tsx`. Cost: +1.2 KB minified / +0.4 KB gzip
— negligible. This also **partially addresses §4.2** below — see that entry for what it does and doesn't cover.

---

## §4. Must-fix before any real deployment

Six items, verified against the actual code and config — ordered by how much they matter, not by effort.

### 4.1 — The lazy-loaded PDF exporter isn't actually lazy — **verified bug**
- **Where:** `apps/web/src/engine/exportActions.ts:78` · `packages/exporters/src/index.ts`
- **What:** The code comments and `current_state.md` both claim pdf-lib (~0.5 MB) is dynamically imported so it
  "lands in a lazy chunk loaded only on export." It doesn't. `exportActions.ts` dynamically imports the whole
  `@rebarconfig/exporters` barrel — but that same barrel is *also* statically imported by always-mounted code
  (`BbsPanel.tsx`, `useAutosave.ts`, `Navbar.tsx`, `useStore.ts`, `cameraState.ts`, `projectTakeoff.ts`). Rollup
  can't split a module that's already required synchronously elsewhere, so pdf-lib rides in the main 938 KB chunk
  on every load, export or not.
- **Impact:** Every visitor downloads the PDF engine before touching an export button — inflates first load by
  roughly 150–200 KB gzip.
- **Fix:** Give `pdf.ts` its own import path nothing else touches (e.g. `@rebarconfig/exporters/pdf`) and
  dynamic-import *that*, not the shared barrel — or split the barrel so BBS/DXF/rcfg (needed eagerly) and PDF
  (needed on click) are separate entry points.

### 4.2 — No in-app notice of the licence or a direct link to source — **legal exposure, now partially mitigated**
- **Where:** `apps/web/index.html` · `apps/web/src/ui/Footer.tsx` (new, §3.1)
- **What:** The repo just moved to AGPL-3.0-only (+ a commercial tier). AGPL §13 exists specifically for this
  case — software a user interacts with *over a network* must offer them the corresponding source. The app now
  has a "Powered by beamstack" footer linking to `beam-stack.com`, whose own footer in turn links to
  `github.com/TheBeamstack/SmartBar` under an "open source" heading — so a path to the source now exists, just
  not a direct one from inside the app.
- **Still open:** the footer is attribution, not a source notice — it doesn't name the licence, the version, or
  link straight to the repo/`LICENSE`. A user has to leave the app, land on the marketing site, then find the
  GitHub link themselves.
- **Impact:** Lower than before, but not closed. As sole copyright holder you can't violate your own licence, but
  the two-hop path is a weak reading of §13's "convey... a copy of the Corresponding Source... by providing
  access... in a manner generally satisfying the requirements."
- **Fix (unchanged):** add a direct `github.com/TheBeamstack/SmartBar` link and the licence name next to (or in
  place of) the beamstack link — an About panel is still the more complete answer, but even appending
  `· AGPL-3.0 · source` to the existing footer closes this in a few minutes.

### 4.3 — Two known vulnerabilities ship in the production bundle — **npm audit**
- **Where:** `mathjs` (direct dep, `packages/core`) · `fflate` (transitive, via three-stdlib)
- **What:** `mathjs@13.x` — **high** severity, unsafe object-property setter (GHSA-29qv-4j9f-fjw5 /
  GHSA-jvff-x2qm-6286). `fflate@0.6.x` — **moderate**, can infinite-loop on a malformed ZIP64. A fix exists for
  mathjs only via a breaking major bump (13→15).
- **Impact:** Low *practical* risk today — mathjs only ever evaluates expression strings bundled in the app's own
  shape manifests, never a string from a loaded `.rcfg` file or other user input (confirmed by reading
  `geometry/expr.ts`). Still, "known-vulnerable dependency in a public bundle" is exactly what a security scanner
  (and a future engineer-of-record) will flag first.
- **Fix:** Schedule the mathjs major-version bump with its own test pass (breaking); fflate is a transitive
  three-stdlib dep and may resolve with a routine `npm audit fix`.

### 4.4 — No CI gate between a push and a live deploy — **process gap**
- **Where:** `.github/` — does not exist
- **What:** No GitHub Actions workflow. Cloudflare Pages' own build step will run *a* build command, but nothing
  today runs the full `npm run check` gate (purity → manifests → typecheck ×2 → 996 tests) as a required check
  before merge — Cloudflare's build failing is the only thing that would currently stop a broken `main` from
  going live.
- **Fix:** A short workflow that runs `npm run check` on every push/PR to `main`. This protects the discipline
  the project has clearly kept by hand so far (996 green tests, an adversarial review cycle already run and
  fixed) from eroding once deploys are automatic.

### 4.5 — No security headers configured — **hardening**
- **Where:** `apps/web/public/_headers` — does not exist
- **What:** No CSP, no `X-Frame-Options`, no `Referrer-Policy`. Because the app makes zero outbound requests
  (§2), a strict `default-src 'self'` CSP costs nothing and is close to free security value.
- **Fix:** Ship a Cloudflare Pages `_headers` file — see the snippet in §5.

### 4.6 — Missing favicon, manifest and basic metadata — **polish**
- **Where:** `apps/web/` — no `public/` directory at all
- **What:** No favicon, no `robots.txt`, no Open Graph/description meta tags. Harmless, but every visitor's
  browser 404s on `/favicon.ico` and the tab shows a generic icon.
- **Fix:** Add `apps/web/public/` with a favicon + a couple of meta tags in `index.html`. Five minutes.

---

## §5. Cloudflare Pages setup — the concrete steps

There is no `wrangler.toml` or Cloudflare config in the repo yet. None of this is hard; it just hasn't been done.
The npm-workspaces monorepo layout is the one thing to get right in the project settings.

### Pages project settings

| Setting | Value |
|---|---|
| Framework preset | None (Vite isn't auto-detected correctly across a workspace root) |
| Build command | `npm ci && npm run build:web` |
| Build output directory | `apps/web/dist` |
| Root directory | `/` (repo root — the workspace lockfile lives here, not in `apps/web`) |
| Environment variables | none required — confirmed zero `import.meta.env` reads (§2) |
| Node version | pin explicitly — see below |

### Pin the Node version

Nothing in the repo pins one today — `current_state.md` documents the dev box as Node 20.20, this review ran
clean on Node 22.23, and Cloudflare's build image defaults can change. Pin it so the Pages build is reproducible:

```json
// package.json (root)
"engines": { "node": ">=20 <23" }
```

…or drop a `.nvmrc` / set the `NODE_VERSION` build-environment variable in the Pages dashboard.

### Security headers (§4.5)

```
# apps/web/public/_headers
/*
  Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
```

`'unsafe-inline'` on styles covers R3F/drei's runtime style injection for the 3D canvas — tightening that
further is a nice-to-have, not a blocker.

### No `_redirects` needed — for now

There's no client-side router (§2), so there's no deep-link-refresh 404 problem a SPA-fallback rewrite normally
solves. Skip `_redirects` until a route-based UI actually ships.

### Custom domain & preview deploys

Cloudflare Pages gives every branch a preview URL for free — a natural home for the owner's GPU/visual
acceptance passes (§6) without waiting for a production domain decision. Attach the production custom domain
only once §4 and the release gates in §6 are closed.

---

## §6. Should-fix before calling it a real launch

None of this blocks Cloudflare from serving the files. All of it is what the product itself — its own
`NOTICE.md` disclaimer, its own `owner_tasks.md` — says still stands between "the code works" and "an engineer
can rely on this."

### 6.1 — The structural code constants are unratified — engineering sign-off
Every BAEL / EC2 / RPS-2011 numeric constant ships flagged `"_provisional": true`. Five sign-off gates are open
— `G-BAEL, G-EC2, G-RPS, G-COUPE, G-TOL` — and none has a nominated engineer yet (`owner_tasks.md §B-1`). The
app's own `NOTICE.md` already carries a strong disclaimer ("output MUST NOT be relied upon for construction…
unless independently verified by a qualified structural engineer"), which is the right mitigation for a preview
deploy — but it's a stopgap, not a substitute for the sign-off. Deploying this publicly with a real domain reads,
to a visiting engineer, as "this is ready to use." The disclaimer helps; a nominated engineer actually starting
the reference-case review (the long-lead item on the owner's own punch list) is what closes the gap for real.

### 6.2 — Large parts of the 3D/drawing-board UI have never been touched on real hardware — GPU acceptance
The dev boxes this project has been built on have no GPU. `owner_tasks.md §D` lists nine acceptance passes
(D-1…D-9) that are "code-complete and headless-tested" but never visually confirmed — the editable elevation
(drag a bar end, drop a lap, drag a stirrup-zone boundary) is the largest. One item is sharper than the rest:
**DR-4** — the actual mouse-click "drop a bar on the section" gesture has **zero** automated coverage on any of
the 8 element types, because the pointer-mapping API it depends on (`getScreenCTM`) returns null under the
headless test environment. Only the typed-coordinate fallback has ever run. This is the app's flagship
interaction — "place any bar by pointing at the drawing." A Cloudflare preview URL is exactly the right way to
finally run this on a real browser/GPU (the current dev boxes can't); it should happen before treating the
drawing-board as done, not after.

### 6.3 — A short list of product decisions the owner hasn't confirmed yet — low priority
`owner_tasks.md §A/§C` — mostly 🟢 items with sensible defaults already shipping (diameter set, default
materials, stock bar length, snap-grid density…), plus one 🟠 item worth a look: `C-1`, the RPS-2011
zone-to-ductility-class mapping, the one seismic input the engine actually consumes. None of these block a
deploy — the app functions on its defaults. They matter for the day the owner wants to say "this is configured
for our market," not for the day it first goes live.

---

## §7. Recommended sequence

Ship the preview this week; don't attach a production domain until the second block is done.

1. **Connect the repo to a Cloudflare Pages project** — root `/`, build `npm ci && npm run build:web`, output
   `apps/web/dist` (§5). Get a preview URL live today; no code changes required for this step alone.
2. **Pin the Node version** — an `engines` field or `NODE_VERSION` build variable (§5).
3. **Fix the pdf-lib code-split** (§4.1) — the single highest-leverage fix; cuts real weight off every first load.
4. **Extend the new footer with a direct source/licence link** (§4.2) — the attribution half is done (§3.1);
   ten more minutes closes the AGPL network-use gap the rest of the way.
5. **Ship the `_headers` CSP file + a favicon** (§4.5, §4.6) — cheap, do them together.
6. **Add a CI workflow running `npm run check`** (§4.4) — protects the 996-test discipline once deploys are
   automatic.
7. **Run the DR-4/DR-5/§D GPU acceptance passes on the live preview URL** (§6.2) — the real reason a GPU-backed
   preview link is valuable: it's the first chance anyone has had to actually test the pointer-placement gesture
   and the 3D render on real hardware.
8. **Schedule the mathjs bump** (§4.3) — breaking change, wants its own test pass; not urgent given the low
   practical exposure.
9. **Nominate the structural engineer, start the reference-case sign-off** (§6.1) — the long-lead item; start it
   in parallel with everything above, not after.
10. **Attach the production domain** — only once 1–8 are done and §6's engineering sign-off is at least underway.
