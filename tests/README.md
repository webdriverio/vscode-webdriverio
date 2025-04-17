# Basic directions for unit testing

Basically, we take `vitest` as our first choice. Because we want to make the most of the advantages it offers, such as faster testing, compatibility with ESMs, easy mocking, etc.

The second option is the `vscode-test-cli` with `mocha`. The advantage of this is that the integration behavers between functions provided by VSCode and target functions can be tested in action. However, there are some issues about performance or compatibility issues with libraries created in ESM (which contain internal WebdriverIO packages). Therefore, we choose to use it only for limited purposes, such as testing functions that are built on the assumption of VScode functionality.

The combined test with WebdriverIO,VSCode and this extension is the responsibility of E2E testing.

# How to treat the two options?

We distinguish by the name of the file whether the test is to be run in `vitest` or in `vscode-test-cli`.

|   testing tool    | prefix of filename   | example                      |
| :---------------: | -------------------- | ---------------------------- |
|     `vitest`      | `tests/**/*.test.ts` | `tests/config/index.test.ts` |
| `vscode-test-cli` | `tests/**/*.spec.ts` | `tests/extension.spec.ts`    |
