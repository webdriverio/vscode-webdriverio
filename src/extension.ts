import * as vscode from 'vscode'
import { runTest } from './commands/runTest.js'
import { configureTests } from './commands/configureTests.js'
import { TestExplorerProvider } from './views/testExplorer.js'
import { ResultViewProvider } from './views/resultView.js'
import { testControllerId } from './utils/config.js'
import { discoverTests } from './utils/discover.js'
import { createRunHandler } from './utils/runner.js'

export async function activate(context: vscode.ExtensionContext) {
    const extension = new WdioExtension(context)
    context.subscriptions.push(extension)
    await extension.activate()
}

export function deactivate() {
    // Clean up resources when extension is deactivated
}

class WdioExtension {
    #testController: vscode.TestController

    private disposables: vscode.Disposable[] = []
    private extensionUri: vscode.Uri
    private loadingTestItem: vscode.TestItem

    constructor(context: vscode.ExtensionContext) {
        this.#testController = vscode.tests.createTestController(testControllerId, 'WebdriverIO')
        this.extensionUri = context.extensionUri
        this.loadingTestItem = this.#testController.createTestItem('_resolving', 'Resolving Vitest...')
    }

    async activate() {
        console.log('WebDriverIO Runner extension is now active')
        // Register TestExplorer view
        const testExplorerProvider = new TestExplorerProvider()
        // Register ResultView
        const resultViewProvider = new ResultViewProvider(this.extensionUri)
        const runHandler = createRunHandler(this.#testController)

        this.#testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true)
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.spec.{js,ts}')

        this.disposables = [
            vscode.window.registerTreeDataProvider('webdriverio-tests', testExplorerProvider),
            vscode.window.registerWebviewViewProvider('webdriverio-results', resultViewProvider),

            vscode.commands.registerCommand('webdriverio-runner.runTest', async () => {
                await runTest('test', resultViewProvider)
            }),
            vscode.commands.registerCommand('webdriverio-runner.runSpec', async () => {
                await runTest('spec', resultViewProvider)
            }),
            vscode.commands.registerCommand('webdriverio-runner.runAllTests', async () => {
                await runTest('all', resultViewProvider)
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
