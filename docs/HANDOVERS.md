# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261011-12 SmartBar: open vite, esbuild and mathjs alerts no Dependabot PR fixes need product work; sharp alert #36 is covered by PR #9
- opened: 2026-10-11T07:36Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #9
- what: triage verdicts for open alerts #1-#7, #9, #10, #24, #25 and #36; bump needs product work for vite #1 GHSA-4w7w-66w2-5vf9 (medium, patched 6.4.2), #2 GHSA-fx2h-pf6j-xcff (high, patched 6.4.3) and #3 GHSA-v6wh-96g9-6wx3 (medium, patched 6.4.3), development, direct, apps/web/package.json, and #5 GHSA-4w7w-66w2-5vf9 (medium, patched 6.4.2), #9 GHSA-fx2h-pf6j-xcff (high, patched 6.4.3) and #10 GHSA-v6wh-96g9-6wx3 (medium, patched 6.4.3), development, transitive, package-lock.json; for esbuild #4 GHSA-67mh-4wv8-2f99 (medium, development, transitive, package-lock.json, patched 0.25.0); for mathjs #6 GHSA-jvff-x2qm-6286 and #7 GHSA-29qv-4j9f-fjw5 (high, runtime, transitive, package-lock.json, patched 15.2.0) and #24 GHSA-jvff-x2qm-6286 and #25 GHSA-29qv-4j9f-fjw5 (high, runtime, direct, packages/core/package.json, patched 15.2.0); covered by an open PR for sharp #36 GHSA-rgj7-g3m4-5g8c (high, development, transitive, package-lock.json, patched 0.35.4), fixed by PR #9 (H-20261011-11), this record's item as the only open PR that fixes any of the twelve; none dismissable
- why: the alert API puts mathjs at runtime scope in packages/core/package.json, "25 GHSA-29qv-4j9f-fjw5 high runtime direct mathjs packages/core/package.json >= 13.1.1, < 15.2.0 15.2.0" and "24 GHSA-jvff-x2qm-6286 high runtime direct mathjs packages/core/package.json >= 13.1.0, < 15.2.0 15.2.0"; packages/core declares mathjs ^13.2.3 and main d69435d locks 13.2.3, two majors below 15.2.0; apps/web declares vite ^5.4.9 and main locks vite 5.4.21 with esbuild 0.21.5 under it; vite 6.4.3 needs esbuild ^0.25.0, outside #4's <= 0.24.2, and vitest 2.1.9 needs vite ^5.0.0, so a vite 5.4.21 stays locked until vitest moves too (H-20261011-07); PR #7 hoists vite 8.2.2 but keeps apps/web/node_modules/vite 5.4.21 and its esbuild 0.21.5, and no open PR changes mathjs; PR #9 moves sharp 0.35.2 to 0.35.4; each alert's vulnerable range contains the version main locks, so none is dismissable as not affected
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?state=open&per_page=100'`; `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/<path>?ref=<sha>'` for package-lock.json at main d69435d and the heads of PRs #1-#9, and for package.json, apps/web/package.json and packages/core/package.json at d69435d; `npm view vite@6.4.3 dependencies.esbuild` → ^0.25.0; `npm view vitest@2.1.9 dependencies.vite` → ^5.0.0
- need: open a product task that moves packages/core's mathjs to at least 15.2.0 and apps/web's vite to at least 6.4.3
- cleared: -
