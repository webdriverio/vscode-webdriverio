# Changelog

> **Tags:**
>
> - :boom: [Breaking Change]
> - :rocket: [New Feature]
> - :bug: [Bug Fix]
> - :memo: [Documentation]
> - :house: [Internal]
> - :nail_care: [Polish]

---

## v0.4.2 (2025-07-05)

#### :nail_care: Polish

- `vscode-wdio-config`, `vscode-webdriverio`
    - [#77](https://github.com/webdriverio/vscode-webdriverio/pull/77) chore: use vscode.glob instead of glob ([@mato533](https://github.com/mato533))
- `vscode-wdio-reporter`, `vscode-wdio-types`, `vscode-wdio-worker`, `vscode-webdriverio`
    - [#76](https://github.com/webdriverio/vscode-webdriverio/pull/76) feat: Standardization of test execution methods in Windows ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

## v0.4.1 (2025-06-28)

#### :nail_care: Polish

- `vscode-wdio-test`, `vscode-wdio-types`, `vscode-wdio-worker`
    - [#75](https://github.com/webdriverio/vscode-webdriverio/pull/75) refactor: improve performance and coverage of `@vscode-wdio/test` ([@mato533](https://github.com/mato533))
- `vscode-wdio-server`, `vscode-wdio-test`, `vscode-wdio-types`, `vscode-webdriverio`
    - [#70](https://github.com/webdriverio/vscode-webdriverio/pull/70) feat: simplification of the startup process ([@mato533](https://github.com/mato533))

#### :house: Internal

- `vscode-webdriverio`
    - [#74](https://github.com/webdriverio/vscode-webdriverio/pull/74) feat: build license file for vscode-webdriverio ([@mato533](https://github.com/mato533))
    - [#69](https://github.com/webdriverio/vscode-webdriverio/pull/69) ci: hardening security of Github actions ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

## v0.4.0 (2025-06-19)

#### :rocket: New Feature

- `vscode-wdio-config`, `vscode-wdio-constants`, `vscode-wdio-server`, `vscode-wdio-test`, `vscode-wdio-types`, `vscode-wdio-utils`, `vscode-wdio-worker`, `vscode-webdriverio`
    - [#67](https://github.com/webdriverio/vscode-webdriverio/pull/67) feat: load and unload env variables at worker ([@mato533](https://github.com/mato533))
- `vscode-wdio-config`, `vscode-wdio-constants`, `vscode-wdio-logger`, `vscode-wdio-server`, `vscode-wdio-test`, `vscode-wdio-types`, `vscode-wdio-utils`, `vscode-wdio-worker`, `vscode-webdriverio`
    - [#62](https://github.com/webdriverio/vscode-webdriverio/pull/62) feat: automatically terminate worker processes when idle timeout has expired ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

## v0.3.2 (2025-06-14)

#### :bug: Bug Fix

- `vscode-wdio-test`, `vscode-wdio-worker`
    - [#58](https://github.com/webdriverio/vscode-webdriverio/pull/58) fix: update error handling for loading wdio config file ([@mato533](https://github.com/mato533))

#### :nail_care: Polish

- `vscode-wdio-worker`
    - [#61](https://github.com/webdriverio/vscode-webdriverio/pull/61) chore: remove babel dependency ([@mato533](https://github.com/mato533))
- `vscode-wdio-worker`, `vscode-webdriverio`
    - [#60](https://github.com/webdriverio/vscode-webdriverio/pull/60) feat: module separation of worker module ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

## v0.3.1 (2025-06-10)

#### :house: Internal

- [#55](https://github.com/webdriverio/vscode-webdriverio/pull/55) chore(deps-dev): dependancy updates includes Vulnerability Countermeasures ([@dependabot[bot]](https://github.com/apps/dependabot))

## v0.3.0 (2025-06-07)

#### :memo: Documentation

- [#52](https://github.com/webdriverio/vscode-webdriverio/pull/52) docs: update about pre-requests ([@mato533](https://github.com/mato533))

#### :house: Internal

- [#51](https://github.com/webdriverio/vscode-webdriverio/pull/51) test: add E2E for multi workspace scenario ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

## v0.2.2-next.0 (2025-06-04)

#### :bug: Bug Fix

- `vscode-wdio-api`, `vscode-wdio-test`
    - [#50](https://github.com/webdriverio/vscode-webdriverio/pull/50) fix: fix a setting error when the test target was not a SPEC file ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

#### Pre-release information

##### Visual Studio Marketplace

- v0.2.1749072678

## v0.2.1-next.0 (2025-06-03)

#### :rocket: New Feature

- `vscode-wdio-logger`
    - [#41](https://github.com/webdriverio/vscode-webdriverio/pull/41) feat: add the ability to write log to file ([@mato533](https://github.com/mato533))

#### :bug: Bug Fix

- `vscode-webdriverio`
    - [#47](https://github.com/webdriverio/vscode-webdriverio/pull/47) fix: update default value of 'webdriverio.configFilePattern' ([@mato533](https://github.com/mato533))

#### :nail_care: Polish

- `vscode-wdio-constants`, `vscode-wdio-types`
    - [#49](https://github.com/webdriverio/vscode-webdriverio/pull/49) fix: change the location of definition of type related configurations ([@mato533](https://github.com/mato533))
- `vscode-wdio-api`, `vscode-wdio-logger`, `vscode-wdio-reporter`, `vscode-webdriverio`
    - [#48](https://github.com/webdriverio/vscode-webdriverio/pull/48) chore: update eslint rule no-console ([@mato533](https://github.com/mato533))

#### :memo: Documentation

- [#44](https://github.com/webdriverio/vscode-webdriverio/pull/44) docs: update the README.md ([@mato533](https://github.com/mato533))

#### :house: Internal

- Other
    - [#45](https://github.com/webdriverio/vscode-webdriverio/pull/45) ci: update dry-run logic of `git push` ([@mato533](https://github.com/mato533))
    - [#43](https://github.com/webdriverio/vscode-webdriverio/pull/43) style: update the format rule for YAML ([@mato533](https://github.com/mato533))
    - [#38](https://github.com/webdriverio/vscode-webdriverio/pull/38) ci: use cached vscode at E2E tests ([@mato533](https://github.com/mato533))
- `vscode-webdriverio`
    - [#42](https://github.com/webdriverio/vscode-webdriverio/pull/42) test: add smoke test for updating spec files ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

#### Pre-release information

##### Visual Studio Marketplace

- v0.2.1748979762

## v0.2.0-next.0 (2025-05-31)

#### :rocket: New Feature

- `vscode-wdio-constants`, `vscode-webdriverio`
    - [#37](https://github.com/webdriverio/vscode-webdriverio/pull/37) feat: support vscode@1.96.0 ([@mato533](https://github.com/mato533))

#### :bug: Bug Fix

- `vscode-wdio-config`, `vscode-wdio-test`, `vscode-wdio-utils`, `vscode-wdio-worker`
    - [#36](https://github.com/webdriverio/vscode-webdriverio/pull/36) fix: fix not refrecting configuration change due to drive letter inconsistencies ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

> Package as v0.2.1748712328

## v0.1.1-next.0 (2025-05-28)

#### :memo: Documentation

- [#35](https://github.com/webdriverio/vscode-webdriverio/pull/35) docs: update README about the current status ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

> Package as v0.1.117484166

## v0.1.0 (2025-05-28)

#### :memo: Documentation

- [#35](https://github.com/webdriverio/vscode-webdriverio/pull/35) docs: update README about the current status ([@mato533](https://github.com/mato533))

#### Committers: 1

- [@mato533](https://github.com/mato533)

## v0.1.0-next.0 (2025-05-27)

#### :rocket: New Feature

- All packages
    - Initial release

> Package as v0.1.1748333580
