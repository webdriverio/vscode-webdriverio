import * as vscode from 'vscode'
import { configureTests } from './commands/configureTests.js'
import { configManager, testControllerId } from './config/config.js'
import { discoverTests } from './utils/discover.js'
import { createRunHandler } from './utils/runner.js'
import { log } from './utils/logger.js'
import { WorkerManager } from './manager.js'

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
    private workerManager: WorkerManager | null = null

    constructor() {
        this.#testController = vscode.tests.createTestController(testControllerId, 'WebdriverIO')
        this.loadingTestItem = this.#testController.createTestItem('_resolving', 'Resolving WebdriverIO...')
    }

    async activate() {
        log.info('WebDriverIO Runner extension is now active')

        // Start worker process
        try {
            this.workerManager = new WorkerManager()
            await this.workerManager.start()
        } catch (error) {
            log.info(`Failed to start worker process: ${error instanceof Error ? error.message : String(error)}`)
            vscode.window.showErrorMessage('Failed to start WebDriverIO worker process')
        }

        const runHandler = createRunHandler(this.#testController, this.workerManager)

        this.#testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true)
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.spec.{js,ts}')

        this.disposables = [
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration(configManager.listener),
            watcher,
        ]
        discoverTests(this.#testController)
    }
    async dispose() {
        if (this.workerManager) {
            await this.workerManager.stop()
            this.workerManager = null
        }
        this.disposables.forEach((d) => d.dispose())
        this.disposables = []
    }
}
