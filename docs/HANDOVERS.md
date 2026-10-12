# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261012-01 SmartBar: Dependabot alert #50 (brace-expansion GHSA-q2hr-2g5m-vwhr) is covered by open PR #7, which itself needs product work
- opened: 2026-10-12T20:09Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #7
- what: triage verdict covered by an open PR for open alert #50 GHSA-q2hr-2g5m-vwhr (CVE-2026-102277, medium, development scope, package-lock.json, vulnerable >= 2.0.0, < 2.1.7, first patched 2.1.7), "brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service"; of open SmartBar Dependabot PRs #1-#9 only PR #7 fixes it, because its package-lock.json deletes node_modules/glob/node_modules/brace-expansion 2.1.1 with glob and minimatch; PR #2 only moves that copy to 2.1.4, below 2.1.7 (H-20261011-02); PR #7 is already handed over as needs product work (H-20261011-07), so this fix waits on that disposition; not dismissable
- why: the alert API reads `{"cve":"CVE-2026-102277","created_at":"2026-10-12T18:55:39Z","dismissed_at":null,"ghsa":"GHSA-q2hr-2g5m-vwhr","manifest":"package-lock.json","number":50,"patched":"2.1.7","pkg":"brace-expansion","range":">= 2.0.0, < 2.1.7","scope":"development","severity":"medium","state":"open"}`; main d69435d locks that copy at 2.1.1, inside the range, so it is not dismissable as not affected; at PR #7's head 4311817 (1 ahead and 0 behind main, MERGEABLE) package-lock.json has no package path ending in brace-expansion, minimatch or glob, and package.json moves vitest and @vitest/coverage-v8 to ^5.0.0; if PR #7 is replaced, 2.1.7 (on npm) fits the copy's one dependent, dev-scope node_modules/glob/node_modules/minimatch 9.0.9 at ^2.0.2, as a package-lock.json change only; 2.1.7 also clears auto_dismissed #49 and #51 on the same copy (patched 2.1.6, 2.1.5); root node_modules/brace-expansion 5.0.6 is outside #50's range
- evidence: `gh api repos/TheBeamstack/SmartBar/dependabot/alerts/50`; `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr list -R TheBeamstack/SmartBar --author app/dependabot --state open --json number,title,headRefName` → PRs #1-#9; `gh pr diff <n> -R TheBeamstack/SmartBar` for n = 1..9 → only PR #7 has the line `-    "node_modules/glob/node_modules/brace-expansion": {`, and PR #2 moves its version 2.1.1 to 2.1.4; `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/<path>?ref=<sha>'` for package-lock.json and package.json at d69435de4d879e5ce5e66eced712545f3f854a75 and 43118179477f2b4bfdfd72dc5b4a90d347ba6f82; `gh api repos/TheBeamstack/SmartBar/compare/main...43118179477f2b4bfdfd72dc5b4a90d347ba6f82` → ahead_by 1, behind_by 0; `npm view brace-expansion@2.1.7 version` → 2.1.7
- need: dispose of alert #50 together with PR #7 under H-20261011-07, so that merging PR #7 or the product task that replaces it leaves node_modules/glob/node_modules/brace-expansion absent or at least 2.1.7
- cleared: -
