import * as vscode from 'vscode'
import { configureTests } from './commands/configureTests.js'
import { configManager, testControllerId } from './config/index.js'
import { discoverTests } from './test/discover.js'
import { createRunHandler } from './utils/runHandler.js'
import { log } from './utils/logger.js'
import { WorkerManager } from './api/server.js'
import { TestRegistry } from './test/registry.js'

export async function activate(context: vscode.ExtensionContext) {
    const extension = new WdioExtension()
    context.subscriptions.push(extension)
    await extension.activate()
}

export function deactivate() {
    // Clean up resources when extension is deactivated
}

class WdioExtension {
    private _testController: vscode.TestController

    private _disposables: vscode.Disposable[] = []
    private _loadingTestItem: vscode.TestItem
    private _workerManager: WorkerManager | null = null

    constructor() {
        this._testController = vscode.tests.createTestController(testControllerId, 'WebdriverIO')
        this._loadingTestItem = this._testController.createTestItem('_resolving', 'Resolving WebdriverIO...')
    }

    async activate() {
        log.info('WebDriverIO Runner extension is now active')

        // Start worker process
        try {
            this._workerManager = new WorkerManager()
            await this._workerManager.start()
        } catch (error) {
            const errorMessage = `Failed to start worker process: ${error instanceof Error ? error.message : String(error)}`
            log.error(errorMessage)
            vscode.window.showErrorMessage('Failed to start WebDriverIO worker process')
            throw new Error(errorMessage)
        }
        const testRegistry = new TestRegistry(this._testController)

        const runHandler = createRunHandler(testRegistry, this._workerManager)

        this._testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true)
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.spec.{js,ts}')

        this._disposables = [
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration(configManager.listener),
            this._testController,
            watcher,
            testRegistry,
        ]
        discoverTests(testRegistry)
    }
    async dispose() {
        if (this._workerManager) {
            await this._workerManager.stop()
            this._workerManager = null
        }
        this._disposables.forEach((d) => d.dispose())
        this._disposables = []
    }
}
