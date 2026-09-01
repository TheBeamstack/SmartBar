# SmartBar

**SmartBar** is a parametric rebar-detailing and code-checking application for
reinforced-concrete steel — it lays out longitudinal and transverse
reinforcement, checks it against code packs derived from **BAEL 91 (rev. 99)**,
**Eurocode 2 (EN 1992-1-1:2004+AC:2010)** and **RPS 2011**, and produces bar
bending schedules, shop drawings and section views (DXF / PDF exports).

SmartBar is a [Beamstack](https://beam-stack.com) project. The internal package
namespace is `rebarconfig`.

---

## ⚠ Engineering disclaimer — provisional, unratified structural constants

**The structural constants shipped in SmartBar's code packs are provisional and
unratified.** Each pack in `packages/codepacks` — `bael-constants.json`,
`ec2-constants.json` and `rps-2011.json` — is flagged `"_provisional": true`. No
licensed or otherwise qualified structural engineer has reviewed, ratified, or
signed off on these values, on the tolerance bands applied to them, or on the
drawing and section conventions. The project's own ratification gates
(`G-BAEL`, `G-EC2`, `G-RPS`, `G-TOL`, `G-COUPE`) are open.

Accordingly:

- SmartBar's output is **not** a substitute for structural design, calculation,
  or verification by a qualified engineer.
- A **PASS** result means only that the input satisfied a provisional rule as
  implemented in this software. It is not a statement that a design is correct,
  that it conforms to any standard, or that it is safe to build.
- SmartBar's output **must not be relied upon for construction**, fabrication,
  procurement, tendering, or any other purpose with physical or financial
  consequence, unless every governing value and result has been independently
  verified and accepted by a qualified structural engineer who takes
  professional responsibility for it.
- Nothing in this software certifies conformity with BAEL 91-99, EN 1992-1-1,
  RPS 2011, or any other standard. **Where this software and a published
  standard disagree, the published standard governs.**

This records a known limitation of the current release. It does not narrow the
disclaimer of warranty and limitation of liability in Sections 15-17 of the GNU
Affero General Public License v3.0, under which this software is provided
**without any warranty**. See [`NOTICE`](NOTICE).

---

## Licence

**SmartBar** is a [Beamstack](https://beam-stack.com) project on the
**Open tier** of the [Beamstack License Framework](https://github.com/TheBeamstack/beamstack-licensing).

Licensed under the **GNU Affero General Public License v3.0 only**
(SPDX `AGPL-3.0-only`) — see [`LICENSE`](LICENSE). This is genuine, OSI-approved
open source: you may use, study, modify, self-host, and redistribute it under
that licence's terms. If you run a modified version as a network service, AGPL
§13 requires you to offer users your source.

**Trademarks.** "Beamstack", "SmartBar", and the Beamstack logo are
trademarks — see [`TRADEMARKS.md`](TRADEMARKS.md). The licence grants no rights
in them: **a fork must use a different name.**

**Commercial licence.** SmartBar is also available under a commercial
licence for organisations that need to keep their own modifications closed:
askdaoudi@gmail.com.

**Contributing.** See [`CONTRIBUTING.md`](CONTRIBUTING.md); contributions
require the [Beamstack CLA](CLA.md).

© 2026 Beamstack. Rights holder of record pending incorporation: Abdellah Daoudi
(sole proprietor, Morocco).
