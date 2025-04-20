import * as vscode from 'vscode'
import { configureTests } from './commands/configureTests.js'
import { configManager, testControllerId } from './config/index.js'
import { createRunHandler } from './utils/runHandler.js'
import { log } from './utils/logger.js'
import { WorkerManager } from './api/server.js'
import { TestRegistry } from './test/registry.js'
import path from 'node:path'

import type { FileWatcherManager } from './test/watcher.js'

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
    private _testRegistry: TestRegistry | null = null
    private _fileWatcherManager: FileWatcherManager | null = null

    constructor() {
        this._testController = vscode.tests.createTestController(testControllerId, 'WebdriverIO')
        this._loadingTestItem = this._testController.createTestItem('_resolving', 'Resolving WebdriverIO Tests...')
        this._loadingTestItem.sortText = '.0' // show at first line
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

        // Create test registry
        this._testRegistry = new TestRegistry(this._testController, this._loadingTestItem)
        const runHandler = createRunHandler(this._testRegistry, this._workerManager)

        // Create run profile
        this._testController.createRunProfile('Run Tests', vscode.TestRunProfileKind.Run, runHandler, true)

        // Set up refresh handler for test explorer UI
        this._testController.refreshHandler = async () => {
            log.info('Refreshing WebDriverIO tests...')
            await this.refreshTests()
        }

        // Create file watchers
        const fileWatchers = this.createFileWatchers()

        this._disposables = [
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration(configManager.listener),
            this._testController,
            ...fileWatchers,
            this._testRegistry,
        ]
        await this._testRegistry.discoverAllTests()
    }
    /**
     * Create file watchers for test files based on configured patterns
     */
    private createFileWatchers(): vscode.Disposable[] {
        const testFilePattern = configManager.globalConfig.testFilePattern
        const patterns = testFilePattern.split(',').map((p) => p.trim())
        log.debug(`Creating file watchers for patterns: ${patterns.join(', ')}`)

        const watchers: vscode.Disposable[] = []

        for (const pattern of patterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern)

            // Add event handlers
            watcher.onDidChange((uri) => this.handleFileChange(uri))
            watcher.onDidCreate((uri) => this.handleFileChange(uri))
            watcher.onDidDelete((uri) => this.handleFileDelete(uri))

            watchers.push(watcher)
        }

        return watchers
    }
    /**
     * Refresh WebDriverIO tests
     */
    private async refreshTests(): Promise<void> {
        if (!this._testRegistry) {
            return
        }

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Reloading WebDriverIO tests...',
                cancellable: false,
            },
            async () => {
                try {
                    if (!this._testRegistry) {
                        return
                    }
                    // Clear existing tests
                    this._testRegistry.clearTests()
                    // Discover tests again
                    await this._testRegistry.discoverAllTests()

                    vscode.window.showInformationMessage('WebDriverIO tests reloaded successfully')
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    log.error(`Failed to reload tests: ${errorMessage}`)
                    vscode.window.showErrorMessage(`Failed to reload WebDriverIO tests: ${errorMessage}`)
                }
            }
        )
    }

    /**
     * Handle file changes (create or modify)
     */
    private async handleFileChange(uri: vscode.Uri): Promise<void> {
        log.debug(`Test file changed: ${uri.fsPath}`)

        if (this._testRegistry) {
            log.info(`Reloading changed file: ${path.basename(uri.fsPath)}`)
            await this._testRegistry.reloadSpecFiles([uri.fsPath])
        }
    }

    /**
     * Handle file deletion
     */
    private async handleFileDelete(uri: vscode.Uri): Promise<void> {
        log.debug(`Test file deleted: ${uri.fsPath}`)

        if (this._testRegistry) {
            log.info(`Removing deleted file from test registry: ${path.basename(uri.fsPath)}`)
            this._testRegistry.removeSpecFile(uri.fsPath)
        }
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
