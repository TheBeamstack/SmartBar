# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261012-01 SmartBar: Dependabot alert #50 (brace-expansion GHSA-q2hr-2g5m-vwhr) is fixed by no open PR; bump needs product work
- opened: 2026-10-12T20:09Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #15
- what: triage verdict bump needs product work for open alert #50 GHSA-q2hr-2g5m-vwhr (CVE-2026-102277, medium, development scope, package-lock.json, vulnerable >= 2.0.0, < 2.1.7, first patched 2.1.7), "brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service"; no open SmartBar Dependabot PR fixes it: of PRs #1-#9 only PR #2 moves this copy, node_modules/glob/node_modules/brace-expansion 2.1.1 to 2.1.4, below 2.1.7 (H-20261011-02); the item is PR #15, the PR that carries this record, because no open PR fixes the alert; not dismissable
- why: the alert API reads `{"cve":"CVE-2026-102277","created_at":"2026-10-12T18:55:39Z","dismissed_at":null,"ghsa":"GHSA-q2hr-2g5m-vwhr","manifest":"package-lock.json","number":50,"patched":"2.1.7","pkg":"brace-expansion","range":">= 2.0.0, < 2.1.7","scope":"development","severity":"medium","state":"open"}`; main d69435d locks that copy at 2.1.1, inside the range, so it is not dismissable as not affected; its one dependent, dev-scope node_modules/glob/node_modules/minimatch 9.0.9, declares ^2.0.2, so 2.1.7 (on npm) needs a package-lock.json change and no manifest change, which this lane does not make (Custodianship `docs/INVARIANTS.md` §1-2); 2.1.7 also clears auto_dismissed #49 and #51 on the same copy (patched 2.1.6, 2.1.5); root node_modules/brace-expansion 5.0.6 is outside #50's range
- evidence: `gh api repos/TheBeamstack/SmartBar/dependabot/alerts/50`; `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr list -R TheBeamstack/SmartBar --author app/dependabot --state open --json number,title,headRefName` → PRs #1-#9; `gh pr diff 2 -R TheBeamstack/SmartBar`; `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/package-lock.json?ref=main'` at d69435d; `npm view brace-expansion@2.1.7 version` → 2.1.7
- need: open a product task that moves package-lock.json's node_modules/glob/node_modules/brace-expansion to at least 2.1.7
- cleared: -
