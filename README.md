<h1 align="center">WebdriverIO extension for Visual Studio Code.</h1>

## Features

- **Run**, WebdriverIO tests in Visual Studio Code.

## Requirements

- Visual Studio Code version >= 1.98.0
- WebdriverIO version >= v9.0.0
- Node.js version >= 18.0.0 (follows WebdriverIO)

- `@wdio/json-reporter` should be installed and configured at `wdio.config.js` as follows
    ```
    reporters: [
      ['json', { stdout: true }]
    ],
    ```

## 🚧🚧　Extension Settings 🚧🚧

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `myExtension.enable`: Enable/disable this extension.
- `myExtension.thing`: Set to `blah` to do something.

## 🚧🚧　Known Issues　🚧🚧

Calling out known issues can help limit users opening duplicate issues against your extension.

---

## 🚧🚧　Following extension guidelines　🚧🚧

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## 🚧🚧　Working with Markdown　🚧🚧

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

- Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
- Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
- Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## 🚧🚧　For more information　🚧🚧

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)
