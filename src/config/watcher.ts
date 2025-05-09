import { convertUriToPath, TestfileWatcher, type RepositoryManager } from '../test/index.js'
import { normalizePath } from '../utils/normalize.js'
import { FileWatcherManager, type WatchPattern } from '../utils/watcher.js'

import type * as vscode from 'vscode'
import type { ServerManager } from '../api/index.js'
import type { ExtensionConfigManager } from '../config/index.js'

export class ConfigFileWatcher extends FileWatcherManager {
    private readonly testfileWatcher
    constructor(
        public readonly configManager: ExtensionConfigManager,
        private readonly serverManager: ServerManager,
        private readonly repositoryManager: RepositoryManager,
    ) {
        super()
        this.testfileWatcher = new TestfileWatcher(repositoryManager)
    }

    public enable() {
        this.createWatchers()
        this.configManager.on('update:configFilePattern', () => this.refreshWatchers())
        this.testfileWatcher.enable()
    }

    protected getFilePatterns(): WatchPattern[] {
        return this.configManager.globalConfig.configFilePattern.map((pattern)=>({ pattern }))
    }

    protected async handleFileCreate(uri: vscode.Uri): Promise<void> {
        const wdioConfigPath = normalizePath(convertUriToPath(uri))
        const workspaceUris = await this.configManager.addWdioConfig(wdioConfigPath)
        await Promise.all(workspaceUris.map(async (workspaceUri)=>
            await this.repositoryManager.addWdioConfig(workspaceUri, wdioConfigPath)))

        this.testfileWatcher.refreshWatchers()
    }

    protected async handleFileChange(uri: vscode.Uri): Promise<void> {
        await Promise.all(this.repositoryManager.repos.reduce((repos, repo) => {
            if ( normalizePath(repo.wdioConfigPath) === normalizePath(convertUriToPath(uri))) {
                repos.push(repo.reloadSpecFiles())
            }
            return repos
        }, [] as Promise<void>[]))
        this.testfileWatcher.refreshWatchers()
    }

    protected async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const wdioConfigPath = normalizePath(convertUriToPath(uri))
        const workspaceUris = this.configManager.removeWdioConfig(wdioConfigPath)
        for (const workspaceUri of workspaceUris) {
            this.repositoryManager.removeWdioConfig(workspaceUri, wdioConfigPath)
            await this.serverManager.reorganize(this.configManager.getWdioConfigPaths())
        }
        this.testfileWatcher.refreshWatchers()
    }

    public dispose(): void {
        this.testfileWatcher.dispose()
        super.dispose()
    }
}
