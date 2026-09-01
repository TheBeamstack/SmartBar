# Third-party notices — SmartBar

SmartBar is built on the third-party packages listed below. Each is
distributed by its own authors under its own licence; none is owned by Beamstack.
The full licence text of each ships inside that package's own distribution.

This file is one of the Notice Files that must travel with the software in every
redistribution.

## Runtime dependencies

| Package | Version (pin/range) | Licence | SPDX | Notes |
|---|---|---|---|---|
| react | `^18.3.1` | MIT | `MIT` | `apps/web` UI |
| react-dom | `^18.3.1` | MIT | `MIT` | `apps/web` UI |
| three | `^0.169.0` | MIT | `MIT` | 3D viewport |
| @react-three/fiber | `^8.17.10` | MIT | `MIT` | React renderer for three.js |
| @react-three/drei | `^9.114.0` | MIT | `MIT` | three.js helpers |
| zustand | `^4.5.5` | MIT | `MIT` | state store |
| mathjs | `^13.2.3` | Apache-2.0 | `Apache-2.0` | `packages/core` numerics |
| pdf-lib | `^1.17.1` | MIT | `MIT` | `packages/exporters` PDF output |

Internal workspace packages (`@rebarconfig/core`, `@rebarconfig/codepacks`,
`@rebarconfig/exporters`) are part of this repository and are covered by its own
`LICENSE`, not by this table.

## Build / dev-only dependencies

| Package | Version | Licence | SPDX |
|---|---|---|---|
| typescript | `^5.6.3` | Apache-2.0 | `Apache-2.0` |
| vite | `^5.4.9` | MIT | `MIT` |
| @vitejs/plugin-react | `^4.3.2` | MIT | `MIT` |
| vitest | `^2.1.8` | MIT | `MIT` |
| @vitest/coverage-v8 | `^2.1.9` | MIT | `MIT` |
| jsdom | `^25.0.1` | MIT | `MIT` |
| @testing-library/react | `^16.0.1` | MIT | `MIT` |
| @testing-library/jest-dom | `^6.5.0` | MIT | `MIT` |
| @testing-library/user-event | `^14.5.2` | MIT | `MIT` |
| ajv | `^8.17.1` | MIT | `MIT` |
| ajv-formats | `^3.0.1` | MIT | `MIT` |
| tsx | `^4.19.2` | MIT | `MIT` |
| @types/node, @types/react, @types/react-dom, @types/three | (various) | MIT | `MIT` |

## Compatibility review

- **No copyleft dependencies.** Every direct dependency above is permissive
  (MIT or Apache-2.0). There is no GPL, LGPL, AGPL, MPL, or source-available
  dependency in the direct dependency set.
- **Compatibility with the project licence.** SmartBar is licensed
  `AGPL-3.0-only`. MIT is compatible one-way (MIT code may be combined into an
  AGPL-3.0 work). Apache-2.0 is compatible with GPL-3.0/AGPL-3.0 one-way
  (Apache-2.0 → AGPL-3.0 is permitted; the reverse is not). No dependency
  imposes a condition that conflicts with AGPL-3.0-only.
- **Verification status.** The licences above were read from the packages'
  published metadata for the versions ranged here. This table covers **direct**
  dependencies only; a full transitive SBOM scan has not been run and remains
  outstanding.
