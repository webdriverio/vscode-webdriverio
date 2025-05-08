import { convertUriToPath, type RepositoryManager } from '../test/index.js'
import { normalizePath } from '../utils/normalize.js'
import { FileWatcherManager } from '../utils/watcher.js'

import type * as vscode from 'vscode'
import type { ServerManager } from '../api/index.js'
import type { ExtensionConfigManager } from '../config/index.js'

export class ConfigFileWatcher extends FileWatcherManager {
    constructor(
        public readonly configManager: ExtensionConfigManager,
        private readonly serverManager: ServerManager,
        private readonly repositoryManager: RepositoryManager
    ) {
        super()
    }

    public enable() {
        this.createWatchers()
        this.configManager.on('update:configFilePattern', () => this.refreshWatchers())
    }

    protected getFilePatterns(): string[] {
        return this.configManager.globalConfig.configFilePattern || []
    }

    protected async handleFileCreate(uri: vscode.Uri): Promise<void> {
        const wdioConfigPath = normalizePath(convertUriToPath(uri))
        const workspaceUris = await this.configManager.addWdioConfig(wdioConfigPath)
        for (const workspaceUri of workspaceUris) {
            this.repositoryManager.addWdioConfig(workspaceUri, wdioConfigPath)
        }
    }

    protected handleFileChange(uri: vscode.Uri): void | Promise<void> {
        const targetRepos = this.repositoryManager.repos.filter((repo) => {
            return normalizePath(repo.wdioConfigPath) === normalizePath(convertUriToPath(uri))
        })
        targetRepos.map((repo) => {
            repo.reloadSpecFiles()
        })
    }

    protected async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const wdioConfigPath = normalizePath(convertUriToPath(uri))
        const workspaceUris = this.configManager.removeWdioConfig(wdioConfigPath)
        for (const workspaceUri of workspaceUris) {
            this.repositoryManager.removeWdioConfig(workspaceUri, wdioConfigPath)
            await this.serverManager.reorganize(this.configManager.getWdioConfigPaths())
        }
    }
}
