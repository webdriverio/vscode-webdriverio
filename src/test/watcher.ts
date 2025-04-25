import { repositoryManager } from './manager.js'
import { configManager } from '../config/index.js'
import { log } from '../utils/logger.js'
import { FileWatcherManager } from '../utils/watcher.js'

import type * as vscode from 'vscode'

export class TestfileWatcher extends FileWatcherManager {
    constructor() {
        super()
        this.onFileCreate((uri) => this.handleFileChange(uri, true))
        this.onFileChange((uri) => this.handleFileChange(uri, false))
        this.onFileDelete((uri) => this.handleFileDelete(uri))
        configManager.on('update:testFilePattern', () => this.refreshWatchers())
    }

    /**
     * Handle file changes (create or modify)
     */
    async handleFileChange(uri: vscode.Uri, isCreated: boolean = false): Promise<void> {
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
    async handleFileDelete(uri: vscode.Uri): Promise<void> {
        const specFilePath = uri.fsPath
        log.debug(`Test file deleted: ${specFilePath}`)

        const repos = repositoryManager.repos.filter((repo) => repo.getSpecByFilePath(uri.fsPath))
        log.debug(`Affected repository are ${repos.length} repositories`)

        repos.map(async (repo) => {
            repo.removeSpecFile(repo.normalizePath(specFilePath))
        })
    }
}
