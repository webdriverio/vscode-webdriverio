import { log } from '../utils/logger.js'
import { normalizePath } from '../utils/normalize.js'
import { FileWatcherManager } from '../utils/watcher.js'

import type * as vscode from 'vscode'
import type { RepositoryManager } from './manager.js'
import type { ExtensionConfigManager } from '../config/index.js'

export class TestfileWatcher extends FileWatcherManager {
    constructor(
        public readonly configManager: ExtensionConfigManager,
        private readonly repositoryManager: RepositoryManager
    ) {
        super()
    }

    public enable() {
        this.createWatchers()
        this.configManager.on('update:testFilePattern', () => this.refreshWatchers())
    }

    protected getFilePatterns(): string[] {
        return this.configManager.globalConfig.testFilePattern || []
    }
    protected async handleFileCreate(uri: vscode.Uri): Promise<void> {
        await this._handleFileCreateAndChange(uri, true)
    }
    protected async handleFileChange(uri: vscode.Uri): Promise<void> {
        await this._handleFileCreateAndChange(uri, false)
    }

    /**
     * Handle file changes (create or modify)
     */
    private async _handleFileCreateAndChange(uri: vscode.Uri, isCreated: boolean = false): Promise<void> {
        const specFilePath = uri.fsPath
        log.debug(`Test file ${isCreated ? 'created' : 'changed'}: ${specFilePath}`)

        // If a Spec file is newly created, attempt to read in all repositories,
        // as it is unclear which configuration file should be reflected.
        const repos = isCreated
            ? this.repositoryManager.repos
            : this.repositoryManager.repos.filter((repo) => repo.getSpecByFilePath(uri.fsPath))

        log.debug(`Affected repository are ${repos.length} repositories`)
        await Promise.all(repos.map(async (repo) => await repo.reloadSpecFiles([normalizePath(specFilePath)])))
    }

    /**
     * Handle file deletion
     */
    protected async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const specFilePath = uri.fsPath
        log.debug(`Test file deleted: ${specFilePath}`)

        const repos = this.repositoryManager.repos.filter((repo) => repo.getSpecByFilePath(uri.fsPath))
        log.debug(`Affected repository are ${repos.length} repositories`)

        repos.map(async (repo) => {
            repo.removeSpecFile(normalizePath(specFilePath))
        })
    }
}
