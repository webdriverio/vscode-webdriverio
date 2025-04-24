import * as vscode from 'vscode'
import { configureTests } from './commands/configureTests.js'
import { configManager } from './config/index.js'
import { serverManager } from './api/index.js'
import { TestfileWatcher, repositoryManager } from './test/index.js'
import { log } from './utils/logger.js'

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
    private _disposables: vscode.Disposable[] = []

    async activate() {
        log.info('WebDriverIO Runner extension is now active')

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

        // Create file watchers
        const testfileWatcher = new TestfileWatcher()

        this._disposables = [
            vscode.commands.registerCommand('webdriverio.configureTests', configureTests),
            vscode.workspace.onDidChangeConfiguration((event) => configManager.listener(event)),
            testfileWatcher,
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

    async dispose() {
        this._disposables.forEach((d) => d.dispose())
        this._disposables = []
    }
}
