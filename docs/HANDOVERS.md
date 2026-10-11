# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261011-01 SmartBar: Dependabot PR #1 (postcss 8.5.15 to 8.5.28, nanoid 3.3.15 to 3.3.18) is merge-as-is
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #1
- what: triage verdict merge-as-is for PR #1, which bumps dev-scope postcss 8.5.15 to 8.5.28 and nanoid 3.3.15 to 3.3.18 in package-lock.json only, so it carries PR #3's whole change (H-20261011-03)
- why: it fixes open alerts #15 GHSA-r28c-9q8g-f849 (high, patched 8.5.18) and #20 GHSA-fxqj-rqcc-2cmp (medium, patched 8.5.23) and auto_dismissed #22 GHSA-28wg-ghj8-5hjv (high, patched 3.3.16) and #23 GHSA-2v37-7h3g-55p8 (high, patched 3.3.18); node_modules/postcss 8.5.15 is main's only postcss; MERGEABLE/CLEAN at main d69435d, no check run on its head
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr diff 1 -R TheBeamstack/SmartBar`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`; `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/package-lock.json?ref=main'`
- need: merge PR #1
- cleared: -

## H-20261011-02 SmartBar: Dependabot PR #2 (brace-expansion 2.1.1 to 2.1.4 and 5.0.6 to 5.0.9) is merge-as-is
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #2
- what: triage verdict merge-as-is for PR #2, which bumps dev-scope brace-expansion 5.0.6 to 5.0.9 and glob's nested 2.1.1 to 2.1.4 in package-lock.json only
- why: it fixes open alerts #11 and #12 GHSA-3jxr-9vmj-r5cp (high, patched 5.0.7 and 2.1.2) and auto_dismissed #16-#19 GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895; 5.0.9 stays inside auto_dismissed #47 GHSA-6j4f-fj2g-mc7p (patched 5.0.10) and #48 GHSA-qhr7-859c-m2p7 (patched 5.0.11); MERGEABLE/CLEAN, no check run on its head
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr view 2 -R TheBeamstack/SmartBar --json body`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`
- need: merge PR #2
- cleared: -

## H-20261011-03 SmartBar: Dependabot PR #3 (nanoid 3.3.15 to 3.3.18) is superseded by PR #1
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #3
- what: triage verdict superseded for PR #3, whose only version change, dev-scope nanoid 3.3.15 to 3.3.18 in package-lock.json, PR #1 also makes (H-20261011-01)
- why: it addresses no open alert, only auto_dismissed #22 GHSA-28wg-ghj8-5hjv (high, patched 3.3.16) and #23 GHSA-2v37-7h3g-55p8 (high, patched 3.3.18), which PR #1 fixes too; its other lockfile lines toggle only `peer` flags against its older merge-base 519a6c3; MERGEABLE/CLEAN, no check run on its head
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr diff 3 -R TheBeamstack/SmartBar`; `gh pr diff 1 -R TheBeamstack/SmartBar`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`
- need: close PR #3 unmerged once PR #1 is merged
- cleared: -

## H-20261011-04 SmartBar: Dependabot PR #4 (fast-uri 3.1.2 to 3.1.6) is merge-as-is
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #4
- what: triage verdict merge-as-is for PR #4, which bumps dev-scope fast-uri 3.1.2 to 3.1.6 in package-lock.json only
- why: it fixes open alerts #13 GHSA-4c8g-83qw-93j6, #14 GHSA-v2hh-gcrm-f6hx, #21 GHSA-7p8r-x3mc-p8w7, #26 GHSA-fph4-wmhf-6fwf, #27 GHSA-f65p-4m7j-42xc and #29 GHSA-jqff-g426-hqxp (all high, patched at or below 3.1.6); MERGEABLE/CLEAN, no check run on its head
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr view 4 -R TheBeamstack/SmartBar --json body`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`
- need: merge PR #4
- cleared: -

## H-20261011-05 SmartBar: Dependabot PR #5 (fflate 0.6.10 to 0.6.11) is merge-as-is
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #5
- what: triage verdict merge-as-is for PR #5, which bumps the runtime-scope fflate nested under three-stdlib 0.6.10 to 0.6.11 in package-lock.json only
- why: it fixes open alert #28 GHSA-px8p-9vwx-vf98 (medium, runtime, patched 0.6.11); the root fflate 0.8.3 is outside that range; a runtime patch bump with no check run on its head, MERGEABLE/CLEAN
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh api -H 'Accept: application/vnd.github.raw' 'repos/TheBeamstack/SmartBar/contents/package-lock.json?ref=main'`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`
- need: merge PR #5
- cleared: -

## H-20261011-06 SmartBar: Dependabot PR #6 (browserslist 4.28.4 to 4.28.9, baseline-browser-mapping 2.10.38 to 2.11.21) is merge-as-is
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #6
- what: triage verdict merge-as-is for PR #6, which bumps dev-scope browserslist 4.28.4 to 4.28.9 with baseline-browser-mapping 2.10.38 to 2.11.21, caniuse-lite, electron-to-chromium, node-releases and update-browserslist-db in package-lock.json only, so it carries PR #8's whole change (H-20261011-08)
- why: it fixes open alerts #31 GHSA-73wf-gq98-2v4g (high, patched 4.28.7) and #34 GHSA-w5vr-8v7q-w6rv (medium, patched 2.11.0) and auto_dismissed #30 GHSA-c83g-rgw3-j3cx; MERGEABLE/CLEAN, no check run on its head
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr diff 6 -R TheBeamstack/SmartBar`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`
- need: merge PR #6
- cleared: -

## H-20261011-07 SmartBar: Dependabot PR #7 (vitest family 2.1.9 to 5.0.0) needs product work and is the only fix for critical GHSA-5xrq-8626-4rwp
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #7
- what: triage verdict needs product work for PR #7, which moves vitest, @vitest/coverage-v8 and @vitest/mocker 2.1.9 to 5.0.0 in package.json and the hoisted vite 5.4.21 to 8.2.2 in package-lock.json
- why: it fixes open critical alert #8 GHSA-5xrq-8626-4rwp (vitest, patched 3.2.6) and #32/#35 GHSA-82fw-gwwq-j7x9 (medium, patched 4.1.11), and no other open Dependabot PR touches vitest; a three-major test-toolchain jump with no check run on its head is a migration, not a bump
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr diff 7 -R TheBeamstack/SmartBar` (package.json vitest ^2.1.8 to ^5.0.0; node_modules/vite 8.2.2); `gh pr diff 9 -R TheBeamstack/SmartBar | grep -cE '^[-+] +"node_modules/(vitest|@vitest/)'` → 0
- need: replace PR #7 with a product task that moves vitest to at least 4.1.11 and runs SmartBar's test suite on it
- cleared: -

## H-20261011-08 SmartBar: Dependabot PR #8 (baseline-browser-mapping 2.10.38 to 2.11.21) is superseded by PR #6
- opened: 2026-10-11T05:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #8
- what: triage verdict superseded for PR #8, whose whole change, dev-scope baseline-browser-mapping 2.10.38 to 2.11.21 in package-lock.json, PR #6 also makes (H-20261011-06)
- why: the one alert it fixes, open #34 GHSA-w5vr-8v7q-w6rv (medium, patched 2.11.0), PR #6 fixes too; MERGEABLE/CLEAN, no check run on its head
- evidence: `gh api 'repos/TheBeamstack/SmartBar/dependabot/alerts?per_page=100'`; `gh pr diff 8 -R TheBeamstack/SmartBar`; `gh pr diff 6 -R TheBeamstack/SmartBar`; `gh pr list -R TheBeamstack/SmartBar --state open --json number,mergeable,mergeStateStatus,files,statusCheckRollup`
- need: close PR #8 unmerged once PR #6 is merged
- cleared: -
