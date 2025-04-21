import * as vscode from 'vscode'
import { configureTests } from './commands/configureTests.js'
import { configManager } from './config/index.js'
import { serverManager } from './api/index.js'
import { repositoryManager } from './test/index.js'
import { log } from './utils/logger.js'
// import path from 'node:path'

let extension: WdioExtension | null = null
export async function activate(context: vscode.ExtensionContext) {
    extension = new WdioExtension()
    context.subscriptions.push(extension)
    await extension.activate()
}

export function deactivate() {
    if (extension) {
        extension.dispose()
        extension = null
    }
}

class WdioExtension implements vscode.Disposable {
    // private _testController: vscode.TestController

    private _disposables: vscode.Disposable[] = []
    constructor() {
        // this._loadingTestItem = this._testController.createTestItem('_resolving', 'Resolving WebdriverIO Tests...')
        // this._loadingTestItem.sortText = '.0' // show? at first line
    }

    async activate() {
        log.info('WebDriverIO Runner extension is now active')

        // // path to the configuration file for wdio (e.g. /path/to/wdio.config.js)
        await configManager.initialize()
        const configPaths = configManager.getWdioConfigPaths()

        // Start worker process
        try {
            await serverManager.start(configPaths)
        } catch (error) {
            const errorMessage = `Failed to start worker process: ${error instanceof Error ? error.message : String(error)}`
            log.error(errorMessage)
            vscode.window.showErrorMessage('Failed to start WebDriverIO worker process')
            return
        }

        // Set up refresh handler for test explorer UI
        repositoryManager.controller.refreshHandler = async () => {
            log.info('Refreshing WebDriverIO tests...')
            await this.refreshTests()
        }

        // Create file watchers
        const fileWatchers = this.createFileWatchers()

        this._disposables = [
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration(configManager.listener),
            ...fileWatchers,
            serverManager,
            repositoryManager,
            configManager,
        ]

        // await new Promise((resolve) => setTimeout(resolve, 3000))
        await repositoryManager.initialize()
        Promise.all(
            repositoryManager.repos.map(async (repo) => {
                await repo.discoverAllTests()
            })
        ).then(() => repositoryManager.registerToTestController())
    }
    /**
     * Create file watchers for test files based on configured patterns
     */
    private createFileWatchers() {
        const testFilePattern = configManager.globalConfig.testFilePattern
        const patterns = testFilePattern.split(',').map((p) => p.trim())
        log.debug(`Creating file watchers for patterns: ${patterns.join(', ')}`)

        const watchers: vscode.Disposable[] = []

        for (const pattern of patterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern)

            // Add event handlers
            watcher.onDidCreate((uri) => this.handleFileChange(uri, true))
            watcher.onDidChange((uri) => this.handleFileChange(uri))
            watcher.onDidDelete((uri) => this.handleFileDelete(uri))

            watchers.push(watcher)
        }

        return watchers
    }
    /**
     * Handle file changes (create or modify)
     */
    private async handleFileChange(uri: vscode.Uri, isCreated: boolean = false): Promise<void> {
        const specFilePath = uri.fsPath
        log.debug(`Test file ${isCreated ? 'created' : 'changed'}: ${specFilePath}`)

        // If a Spec file is newly created, attempt to read in all repositories,
        // as it is unclear which configuration file should be reflected.
        const repos = isCreated
            ? repositoryManager.repos
            : repositoryManager.repos.filter((repo) => repo.getSpecByFilePath(uri.fsPath))

        log.debug(`Affected repository are ${repos.length} repositories`)
        await Promise.all(repos.map(async (repo) => await repo.reloadSpecFiles([repo.normalizePath(specFilePath)])))
    }

    /**
     * Handle file deletion
     */
    private async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const specFilePath = uri.fsPath
        log.debug(`Test file deleted: ${specFilePath}`)

        const repos = repositoryManager.repos.filter((repo) => repo.getSpecByFilePath(uri.fsPath))
        log.debug(`Affected repository are ${repos.length} repositories`)

        repos.map(async (repo) => {
            repo.removeSpecFile(repo.normalizePath(specFilePath))
        })
    }

    /**
     * Refresh WebDriverIO tests
     */
    private async refreshTests(): Promise<void> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Reloading WebDriverIO tests...',
                cancellable: false,
            },
            async () => {
                try {
                    for (const repo of repositoryManager.repos) {
                        // Clear existing tests
                        repo.clearTests()
                        // Discover tests again
                        await repo.discoverAllTests()
                    }

                    vscode.window.showInformationMessage('WebDriverIO tests reloaded successfully')
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    log.error(`Failed to reload tests: ${errorMessage}`)
                    vscode.window.showErrorMessage(`Failed to reload WebDriverIO tests: ${errorMessage}`)
                }
            }
        )
    }

    async dispose() {
        this._disposables.forEach((d) => d.dispose())
        this._disposables = []
    }
}
