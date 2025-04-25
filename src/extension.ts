import * as vscode from 'vscode'

import { ServerManager } from './api/index.js'
import { configureTests } from './commands/configureTests.js'
import { ExtensionConfigManager } from './config/index.js'
import { EXTENSION_ID } from './constants.js'
import { TestfileWatcher, RepositoryManager } from './test/index.js'
import { log } from './utils/logger.js'

let extension: WdioExtension | null = null
export async function activate(context: vscode.ExtensionContext) {
    extension = new WdioExtension()
    context.subscriptions.push(extension)
    await extension.activate()
}

export async function deactivate() {
    if (extension) {
        await extension.dispose()
        extension = null
    }
}

class WdioExtension implements vscode.Disposable {
    private _disposables: vscode.Disposable[] = []

    constructor(
        private controller = vscode.tests.createTestController(EXTENSION_ID, 'WebdriverIO'),
        private configManager = new ExtensionConfigManager(),
        private serverManager = new ServerManager()
    ) {}

    async activate() {
        log.info('WebdriverIO Runner extension is now active')

        await this.configManager.initialize()
        const configPaths = this.configManager.getWdioConfigPaths()

        // Start worker process asynchronously
        const starting = this.serverManager.start(configPaths).catch(async (error) => {
            const errorMessage = `Failed to start worker process: ${error instanceof Error ? error.message : String(error)}`
            log.error(errorMessage)
            vscode.window.showErrorMessage('Failed to start WebdriverIO worker process')
        })

        // Create Manages and watchers
        const repositoryManager = new RepositoryManager(this.controller, this.configManager, this.serverManager)
        const testfileWatcher = new TestfileWatcher(this.configManager, repositoryManager)

        this._disposables = [
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration((event) => this.configManager.listener(event)),
            testfileWatcher,
            repositoryManager,
            this.serverManager,
            this.configManager,
            this.controller,
        ]

        // Initialize
        try {
            await starting
            await repositoryManager.initialize()
            Promise.all(
                repositoryManager.repos.map(async (repo) => {
                    await repo.discoverAllTests()
                })
            ).then(() => repositoryManager.registerToTestController())

            // Enable watchers
            testfileWatcher.enable()
        } catch (error) {
            console.log(error)
        }
    }

    async dispose() {
        await Promise.all(this._disposables.map(async (d) => await d.dispose()))
        this._disposables = []
    }
}
