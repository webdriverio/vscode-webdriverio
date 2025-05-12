<h1 align="center">WebdriverIO extension for Visual Studio Code.</h1>

<p align="center">
  <a title="WebdriverIO extension for Visual Studio Code" href="https://github.com/webdriverio/vscode-webdriverio"><img src="./assets/vscode-webdriverio.png" alt="WebdriverIO extension for Visual Studio Code" width="50%" /></a>
</p>

## Features

- **Run** WebdriverIO tests in Visual Studio Code.
- **All of the frameworks supported by WebdriverIO** can be used with this extension.

## Requirements

- Visual Studio Code version >= 1.98.0
- WebdriverIO version >= v9.0.0
- Node.js version >= 18.0.0 (follows WebdriverIO)

## Usage

You can manage tests both from the Testing view.

The WebdriverIO uses vscode's `TestController' APIs to provide a unified testing experience.<br>
You can read the official guides about how to run the tests in the VSCode Documentation.

### Testing view

![Testing view](./assets/testing-view.png 'Testing view')

The toolbar at the top provides various commands to manage test execution:

- **Refresh Tests**: To reload your test suite, reflecting any new changes.
- **Run Tests**: To start testing all cases that are currently visible.
- **Debug Tests**: To begin a debugging session for the tests.
- **Show Output**: To display detailed logs from test executions.
- **Miscellaneous Settings**: To customize the Testing view, such as sorting and grouping tests.

Icons next to each test indicate their status

- passed (checkmark)
- failed (cross)
- skipped (arrow)
- running or loading (spinner)
- not executed (dot)

### Test File

![Test File](./assets/testing-file.png 'Test File')

When you open a test file, you could notice test icons in the gutter next to each test case.

You can do the following actions:

- **Run a Single Test:** Click the test icon next to a test case to run that specific test.
- **More Options:** Right-click the test icon to open a context menu with additional options:
    - `Run Test`: Execute the selected test case.
    - `Debug Test`: Execute the selected test case with a debugging session.
    - `Reveal in Test Explorer`: Locate and highlight the test in the centralized Testing view.

## 　Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `webdriverio.configFilePattern`: Glob pattern for WebdriverIO configuration file
- `webdriverio.logLevel`: Set the logLevel
- `webdriverio.showOutput`: Show WebdriverIO output in the test result when set `true` this option
