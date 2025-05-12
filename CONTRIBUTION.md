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
    $ pnpm test:unit
    ```

    We are using 2 testing tools `vitest` and `vscode-test-cli`. Please see the [README.md](./tests/README.md) of the unit test.

- And run the extension via press F5

- Get the coverage report via:

    ```bash
    $ pnpm coverage
    ```

    and see the following files.

    - `coverage/merge/coverage-merge.json` (JSON format)
    - `coverage/report/index.html` (HTML format)
