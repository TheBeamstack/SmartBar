# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261011-11 SmartBar: Dependabot PR #9 (undici 7.29.0 to 7.29.1, wrangler 4.130.0 to 4.147.0) is merge-as-is
- opened: 2026-10-11T07:09Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #9
- what: triage verdict merge-as-is for PR #9, whose body opens "Bumps undici to 7.29.1 and updates ancestor dependency wrangler. These dependencies need to be updated together." and names GHSA-w293-vg96-wgc3, GHSA-rfgv-xxqx-mfg5, GHSA-3wwx-pv8p-q78v, GHSA-rx4f-c7p8-82vq, GHSA-2jfj-6hjv-fm6j, GHSA-3xpg-4rpp-hhhm, GHSA-pmjh-fq2x-6v4x, GHSA-8436-99hf-9mmv, GHSA-2gqq-gqf2-x968 and GHSA-r53p-7pc4-xj5r as fixed in undici 7.29.1; it moves dev-scope wrangler ^4.130.0 to ^4.147.0 in package.json and, in package-lock.json, undici 7.29.0 to 7.29.1 under miniflare 5.20260908.0-alpha to 5.20261001.0-alpha, workerd 1.20260908.1 to 1.20261001.1 and sharp 0.35.2 to 0.35.4 (37 entries)
- why: node_modules/undici 7.29.0, main's only undici, is inside all six open undici alerts and PR #9's 7.29.1 is each one's first patched version, so it fixes #38 GHSA-w293-vg96-wgc3 (high, >= 7.24.1 < 7.29.1), #40 GHSA-pmjh-fq2x-6v4x (medium, >= 7.11.0 < 7.29.1), #41 GHSA-2gqq-gqf2-x968 (low, >= 7.1.0 < 7.29.1), #43 GHSA-r53p-7pc4-xj5r (low, >= 7.0.0 < 7.29.1), #45 GHSA-2jfj-6hjv-fm6j (medium, >= 7.0.0 < 7.29.1) and #46 GHSA-8436-99hf-9mmv (low, >= 7.0.0 < 7.29.1), each development scope, transitive, package-lock.json; its sharp 0.35.4 also fixes open alert #36 GHSA-rgj7-g3m4-5g8c (high, < 0.35.4, patched 0.35.4), which its body does not name; wrangler stays in major 4; MERGEABLE/CLEAN, 0 behind main d69435d, check run "Workers Builds: smartbar" SUCCESS on head a6e2d28
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?state=open&per_page=100'`; `gh pr view 9 -R TheBeamstack/SmartBar --json body,files,headRefOid,mergeable,mergeStateStatus,statusCheckRollup`; `gh api repos/TheBeamstack/SmartBar/compare/main...a6e2d28 --jq .merge_base_commit.sha` → d69435d, then `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/package-lock.json?ref=<sha>'` and `package.json` at d69435d and a6e2d28
- need: merge PR #9
- cleared: -
