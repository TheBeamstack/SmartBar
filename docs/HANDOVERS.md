# HANDOVERS — H- records handed to this repo for its steward to dispose

Append-only, one record per handover. Only `cleared:` is ever edited, by the steward who disposes it
(TheBeamstack/diwan `docs/seats/hamadi.md`, R22).

## H-20261011-14 SmartBar: secret scanning and push protection are disabled on this public repo
- opened: 2026-10-11T10:04Z
- by: zayd
- from: Custodianship
- scope: item
- item: PR #13
- what: on public TheBeamstack/SmartBar every secret-scanning feature in security_and_analysis reads disabled and only Dependabot security updates read enabled, `{"dependabot_security_updates":{"status":"enabled"},"secret_scanning":{"status":"disabled"},"secret_scanning_non_provider_patterns":{"status":"disabled"},"secret_scanning_push_protection":{"status":"disabled"},"secret_scanning_validity_checks":{"status":"disabled"}}`; Dependabot alerts are on; the item is PR #13, the PR that carries this record, because no PR can address a repository setting
- why: with secret scanning and push protection off, a credential pushed to this public repo is neither blocked before it lands nor reported after; each is a repository admin setting, enabled by the owner alone, and this lane changes none (Custodianship `docs/INVARIANTS.md` §1-2)
- evidence: `gh api repos/TheBeamstack/SmartBar --jq .security_and_analysis`; `gh api -i repos/TheBeamstack/SmartBar/vulnerability-alerts` → 204 No Content (404 when disabled); `gh api repos/TheBeamstack/SmartBar --jq .visibility` → public
- need: route enabling secret scanning and push protection on SmartBar to the owner as an owner action
- cleared: -
