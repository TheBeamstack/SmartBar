# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261019-01 SmartBar: Dependabot alert #52 (source-map-js GHSA-68fv-2mgg-jv7q) is covered by open PR #16
- opened: 2026-10-19T11:43Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #16
- what: triage verdict covered by an open PR for open alert #52 GHSA-68fv-2mgg-jv7q (CVE-2026-93749, high, development scope, package-lock.json, vulnerable >= 1.0.0, < 1.2.2, first patched 1.2.2), "source-map-js allows event-loop denial of service through indexed source-map section offsets"; of open SmartBar Dependabot PRs #1-#9 and #16 only PR #16 fixes it, moving the lock's one copy node_modules/source-map-js from 1.2.1 to 1.2.2 and changing nothing else; PR #7 also touches that entry but leaves it at 1.2.1; not dismissable
- why: the alert API reads `{"created_at":"2026-10-18T13:52:45Z","cve":"CVE-2026-93749","dismissed_at":null,"fixed_at":null,"ghsa":"GHSA-68fv-2mgg-jv7q","manifest":"package-lock.json","number":52,"patched":"1.2.2","pkg":"source-map-js","range":">= 1.0.0, < 1.2.2","scope":"development","severity":"high","state":"open"}`; main d69435d locks node_modules/source-map-js at 1.2.1 (dev), inside the range, so it is not dismissable as not affected; its dependents there are postcss (^1.2.1) and magicast (^1.2.0), both satisfied by 1.2.2; PR #16's head 9991d0d is 1 ahead and 0 behind main, MERGEABLE, and its only file is package-lock.json (+3 -3: version, resolved, integrity)
- evidence: `gh api repos/TheBeamstack/SmartBar/dependabot/alerts/52`; `gh pr list -R TheBeamstack/SmartBar --author app/dependabot --state open --json number,title,headRefName,headRefOid,mergeable` → PRs #1-#9 and #16; `gh pr diff <n> -R TheBeamstack/SmartBar` for n = 1..9, 16 → source-map-js lines change only in PR #7 and PR #16; `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/package-lock.json?ref=<sha>'` at d69435de4d879e5ce5e66eced712545f3f854a75 (1.2.1), 9991d0ddfe4eae4d92751e743b736709b599b6fa (1.2.2) and 43118179477f2b4bfdfd72dc5b4a90d347ba6f82 (1.2.1); `gh api repos/TheBeamstack/SmartBar/compare/main...9991d0ddfe4eae4d92751e743b736709b599b6fa` → ahead_by 1, behind_by 0; `npm view source-map-js@1.2.2 version` → 1.2.2
- need: dispose of alert #52 by deciding PR #16, whose merge moves node_modules/source-map-js to 1.2.2
- cleared: -
