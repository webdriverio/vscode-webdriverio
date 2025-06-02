import { ServerManager } from '@vscode-wdio/api'
import { ConfigFileWatcher, ExtensionConfigManager } from '@vscode-wdio/config'
import { EXTENSION_ID } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import { RepositoryManager, TestfileWatcher } from '@vscode-wdio/test'
import * as vscode from 'vscode'

let extension: WdioExtension | null = null
export async function activate(context: vscode.ExtensionContext) {
    extension = new WdioExtension()
    context.subscriptions.push(extension)
    return extension.activate()
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
        private serverManager = new ServerManager(configManager)
    ) {}

    async activate() {
        log.info('WebdriverIO Runner extension is now active')

        await this.configManager.initialize()
        const configPaths = this.configManager.getWdioConfigPaths()

        // Start worker process asynchronously
        const starting = this.serverManager.start(configPaths)

        // Create Manages and watchers
        const repositoryManager = new RepositoryManager(this.controller, this.configManager, this.serverManager)
        const testfileWatcher = new TestfileWatcher(repositoryManager)
        const configFileWatcher = new ConfigFileWatcher(
            this.configManager,
            this.serverManager,
            repositoryManager,
            testfileWatcher
        )

        this._disposables = [
            vscode.workspace.onDidChangeConfiguration((event) => this.configManager.listener(event)),
            testfileWatcher,
            configFileWatcher,
            repositoryManager,
            this.serverManager,
            this.configManager,
            this.controller,
        ]

        // Initialize
        try {
            try {
                await starting
            } catch (error) {
                const errorMessage = `Failed to start WebdriverIO worker process: ${error instanceof Error ? error.message : String(error)}`
                log.error(errorMessage)
                vscode.window.showErrorMessage(errorMessage)
            }
            await repositoryManager.initialize()
            return Promise.all(
                repositoryManager.repos.map(async (repo) => {
                    return await repo.discoverAllTests()
                })
            ).then(() => {
                repositoryManager.registerToTestController()
                // Enable watchers
                configFileWatcher.enable()
            })
        } catch (error) {
            console.log(error)
            log.error(String(error))
        }
    }

    dispose() {
        Promise.all(this._disposables.map(async (d) => await d.dispose())).then(() => {
            this._disposables = []
        })
    }
}
