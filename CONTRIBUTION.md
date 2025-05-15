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

# Package structure

![Package structure](./assets/build.png 'Package structure')
