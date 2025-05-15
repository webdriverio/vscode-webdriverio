import { convertUriToPath, normalizePath, FileWatcherManager, type WatchPattern } from '@vscode-wdio/utils'
import type { ServerManagerInterface } from '@vscode-wdio/types/api'
import type { ExtensionConfigManagerInterface } from '@vscode-wdio/types/config'
import type { RepositoryManagerInterface } from '@vscode-wdio/types/test'
import type * as vscode from 'vscode'

export class ConfigFileWatcher extends FileWatcherManager {
    constructor(
        public readonly configManager: ExtensionConfigManagerInterface,
        private readonly serverManager: ServerManagerInterface,
        private readonly repositoryManager: RepositoryManagerInterface,
        private readonly testfileWatcher: FileWatcherManager
    ) {
        super()
    }

    public enable() {
        this.createWatchers()
        this.configManager.on('update:configFilePattern', () => this.refreshWatchers())
        this.testfileWatcher.enable()
    }

    protected getFilePatterns(): WatchPattern[] {
        return this.configManager.globalConfig.configFilePattern.map((pattern) => ({ pattern }))
    }

    protected async handleFileCreate(uri: vscode.Uri): Promise<void> {
        const wdioConfigPath = normalizePath(convertUriToPath(uri))
        const workspaceUris = await this.configManager.addWdioConfig(wdioConfigPath)
        await Promise.all(
            workspaceUris.map(
                async (workspaceUri) => await this.repositoryManager.addWdioConfig(workspaceUri, wdioConfigPath)
            )
        )

        this.testfileWatcher.refreshWatchers()
    }

    protected async handleFileChange(uri: vscode.Uri): Promise<void> {
        await Promise.all(
            this.repositoryManager.repos.reduce((repos, repo) => {
                if (normalizePath(repo.wdioConfigPath) === normalizePath(convertUriToPath(uri))) {
                    repos.push(repo.reloadSpecFiles())
                }
                return repos
            }, [] as Promise<void>[])
        )
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
        super.dispose()
    }
}
