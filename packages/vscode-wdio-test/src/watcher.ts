import { dirname } from 'node:path'

import { log } from '@vscode-wdio/logger'
import { normalizePath, FileWatcherManager, type WatchPattern } from '@vscode-wdio/utils'
import * as vscode from 'vscode'
import type { RepositoryManager } from './manager.js'

export class TestfileWatcher extends FileWatcherManager {
    constructor(private readonly _repositoryManager: RepositoryManager) {
        super()
    }

    public enable() {
        this.createWatchers()
    }

    protected getFilePatterns(): WatchPattern[] {
        return this._repositoryManager.repos.reduce((patterns, repo) => {
            const configDirPath = dirname(repo.wdioConfigPath)
            for (const pattern of repo.specPatterns) {
                patterns.push({
                    base: vscode.Uri.file(configDirPath),
                    pattern,
                })
            }
            return patterns
        }, [] as WatchPattern[])
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
        const promises = this._repositoryManager.repos.reduce((repos, repo) => {
            if (!isCreated && !repo.getSpecByFilePath(specFilePath)) {
                return repos
            }
            repos.push(repo.reloadSpecFiles([normalizePath(specFilePath)]))
            return repos
        }, [] as Promise<void>[])
        log.debug(`Affected repository are ${promises.length} repositories`)
        await Promise.all(promises)
    }

    /**
     * Handle file deletion
     */
    protected async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const specFilePath = uri.fsPath
        log.debug(`Test file deleted: ${specFilePath}`)
        const count = this._repositoryManager.repos.reduce((counter, repo) => {
            if (!repo.getSpecByFilePath(specFilePath)) {
                return counter
            }
            repo.removeSpecFile(specFilePath)
            return ++counter
        }, 0)
        log.debug(`Affected repository are ${count} repositories`)
    }
}
