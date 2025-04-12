import * as vscode from 'vscode'
import { runTest } from './commands/runTest.js'
import { configureTests } from './commands/configureTests.js'
import { configManager, testControllerId } from './config/config.js'
import { discoverTests } from './utils/discover.js'
import { createRunHandler } from './utils/runner.js'
import { log } from './utils/logger.js'

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
        this.loadingTestItem = this.#testController.createTestItem('_resolving', 'Resolving WebdriverIO...')
    }

    async activate() {
        log.info('WebDriverIO Runner extension is now active')
        const runHandler = createRunHandler(this.#testController)

        this.#testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true)
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.spec.{js,ts}')

        this.disposables = [
            vscode.commands.registerCommand('webdriverio.runTest', async () => {
                await runTest('test')
            }),
            vscode.commands.registerCommand('webdriverio.runSpec', async () => {
                await runTest('spec')
            }),
            vscode.commands.registerCommand('webdriverio.runAllTests', async () => {
                await runTest('all')
            }),
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration(configManager.listener),
            watcher,
        ]
        discoverTests(this.#testController)
    }
    async dispose() {
        this.disposables.forEach((d) => d.dispose())
        this.disposables = []
    }
}
