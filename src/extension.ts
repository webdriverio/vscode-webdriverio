import * as vscode from 'vscode'
import { runTest } from './commands/runTest.js'
import { configureTests } from './commands/configureTests.js'
import { testControllerId } from './utils/config.js'
import { discoverTests } from './utils/discover.js'
import { createRunHandler } from './utils/runner.js'

export async function activate(context: vscode.ExtensionContext) {
    const extension = new WdioExtension()
    context.subscriptions.push(extension)
    await extension.activate()
}

export function deactivate() {
    // Clean up resources when extension is deactivated
}

class WdioExtension {
    #testController: vscode.TestController

    private disposables: vscode.Disposable[] = []
    private loadingTestItem: vscode.TestItem

    constructor() {
        this.#testController = vscode.tests.createTestController(testControllerId, 'WebdriverIO')
        this.loadingTestItem = this.#testController.createTestItem('_resolving', 'Resolving Vitest...')
    }

    async activate() {
        console.log('WebDriverIO Runner extension is now active')
        const runHandler = createRunHandler(this.#testController)

        this.#testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true)
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.spec.{js,ts}')

        this.disposables = [
            vscode.commands.registerCommand('webdriverio-runner.runTest', async () => {
                await runTest('test')
            }),
            vscode.commands.registerCommand('webdriverio-runner.runSpec', async () => {
                await runTest('spec')
            }),
            vscode.commands.registerCommand('webdriverio-runner.runAllTests', async () => {
                await runTest('all')
            }),
            vscode.commands.registerCommand('webdriverio-runner.configureTests', configureTests),
            watcher,
        ]
        discoverTests(this.#testController)
    }
    async dispose() {
        this.disposables.forEach((d) => d.dispose())
        this.disposables = []
    }
}
