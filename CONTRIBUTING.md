# Development

How to develop and build this extension:

- Fork the project.
- Clone the project somewhere on your computer

    ```bash
    $ git clone git@github.com:<your-username>/vscode-webdriverio.git
    ```

- Set up the project via:

    ```bash
    # if you have not installed the PNPM, Please install globally
    $ npm install -g pnpm
    ```

    ```bash
    $ pnpm install
    ```

- Implement the code which you want to achieve.
- Run the unit test via:

    ```bash
    # run the complete unit test suite
    $ pnpm test:unit

    # run test for a specific sub project (e.g. vscode-webdriverio)
    $ npx vitest ./packages/vscode-webdriverio/tests
    ```

- And run the extension via press F5
  The build process with the watch option will be start as background process.
  After that the changeset will be applied soon.

- Get the coverage report via:

    ```bash
    $ pnpm coverage
    ```

## Reporting New Issues

When [opening a new issue](https://github.com/webdriverio/vscode-webdriverio/issues/new/choose), always make sure to fill out the issue template. **This step is very important!** Not doing so may result in your issue not managed in a timely fashion. Don't take this personally if this happens, and feel free to open a new issue once you've gathered all the information required by the template.

- **One issue, one bug:** Please report a single bug per issue.
- **Provide reproduction steps:** List all the steps necessary to reproduce the issue. The person reading your bug report should be able to follow these steps to reproduce your issue with minimal effort.

### Providing a reproducible example

A reproducible example is a simple, self-contained script or program that demonstrates the issue or bug you're experiencing. The goal is to allow others to recreate the problem easily and efficiently.

Steps to Create a Reproducible Example:

1. Isolate the Problem:

- Narrow down your code to the smallest amount that still reproduces the issue.
- Remove any non-essential code or dependencies that are not related to the problem.

2. Ensure that others can run your example and reproduce the issue:

- It should not require any non-standard setup unless absolutely necessary, e.g. remove any need for special software or services like CI vendors.
- Document steps necessary to execute the reproducible example

3. Share project

- Create a new public GitHub repository and push your reproducible example to it.
- Share the link to the repository in the issue.
- Document what behavior you observe and what behavior you would expect

**Note:** if you can't provide a reproducible example we unfortunately are forced to close the issue.

## Proposing a Change

We are happy for every idea you have that improves the usability of the framework. If you have an idea about a new feature please raise a [feature request](https://github.com/webdriverio/vscode-webdriverio/issues/new?template=--feature-request.md) first to get feedback by the maintainer team on it. This lets us reach an agreement on your proposal before you put significant effort into it.

If you’re only fixing a bug, it’s fine to submit a pull request right away, but we still recommend to file an issue detailing what you’re fixing. This is helpful in case we don’t accept that specific fix but want to keep track of the issue.

### Work With The Code

If you make any changes to the code, you want to test it quickly to see if they do what you expect. There are a couple of ways to do that in WebdriverIO. For one, you can link single sub-packages into your own project to see if the changes you've made have the effect you expected.

Another way to test changes in WebdriverIO Extension is by using its [sample directory](https://github.com/webdriverio/vscode-webdriverio/tree/main/samples) or by running its [E2E test suite](https://github.com/webdriverio/vscode-webdriverio/tree/main/e2e). The sample directory is a set of sample that use WebdriverIO Extension in various of ways. Here, you need to open as workspace using VSCode. With the E2E test suite you can run various flavors of WebdriverIO Extension within a predefined execution scenario.

### Make a Pull Request

Once you have a fix implemented or finished a feature implementation you can make a pull request. Your changes needs to be pushed on your WebdriverIO Extension fork. In the GitHub UI you should see a button popping up that allows you to raise a PR to the main repository.

We already provide a template for you to fill out. There are not many rules to follow here. Just try to explain your change with as much detail as possible. Make sure that you have written enough unit tests for your changes otherwise the code coverage check will let the build fail.

Like in many Open Source projects we ask you to sign a **CLA** which is a Contributor License Agreement that ensures that all contributions to the project are licensed under the project's respective open source license, which is MIT. It regulates the legal implications of you providing us (as the OpenJS Foundation) code changes.

The WebdriverIO maintainer will review your pull request as soon as possible. They will then either approve and merge your changes, request modifications or close with an explanation.

### Analyze the output of the `vscode.OutputChannel`

If you would to read or save the log message of vscode.OutputChannel, you can set the directory path of the log file as environment variable `VSCODE_WDIO_TRACE_LOG_PATH`.
Then You will then find a file called `vscode-webdriverio.log`, which contains log messages for all levels.

e.g.

```bash
$ VSCODE_WDIO_TRACE_LOG_PATH=/path/to/log code .

# Execute some test on the vscode with our extension.

$ ls /path/to/log
vscode-webdriverio.log

$ cat /path/to/log/vscode-webdriverio.log
[01-15 15:03:40+00:00] [INFO]  WebdriverIO Runner extension is now active
[01-15 15:03:40+00:00] [DEBUG] Target workspace path: D:\a\vscode-webdriverio\vscode-webdriverio\samples\e2e\mocha
[01-15 15:03:40+00:00] [DEBUG] Detecting the configuration file for WebdriverIO...: **/wdio.conf.{ts,js}
```

### Package structure

This Extension consists of several packages. Eventually, these packages will be bundled with `esbuild` and published as an Extension of VSCode.

**Foundation Layer**<br>
├── @vscode-wdio/constants<br>
<br>
**Core Layer**<br>
├── @vscode-wdio/logger (constants)<br>
└── @vscode-wdio/types (constants)<br>
<br>
**Utility Layer**<br>
├─ @vscode-wdio/utils (constants, logger)<br>
└─ @vscode-wdio/reporter (constants)<br>
<br>
**Service Layer**<br>
@vscode-wdio/config (constants, logger, utils)<br>
└── @vscode-wdio/server (constants, logger, utils)<br>
<br>
**Integration Layer**<br>
├── @vscode-wdio/worker (constants, utils)<br>
└─ @vscode-wdio/test (api, config, constants, logger, utils)<br>
<br>
**Application Layer**<br>
└── vscode-webdriverio<br>
<br>
![Package structure](./assets/build.png 'Package structure')
