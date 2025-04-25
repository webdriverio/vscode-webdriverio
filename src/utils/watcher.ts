import * as vscode from 'vscode'

import { log } from '../utils/logger.js'
import type { ExtensionConfigManager } from '../config/index.js'

/**
 * Manages file watchers for WebdriverIO test files
 */
export class FileWatcherManager implements vscode.Disposable {
    private _watchers: vscode.Disposable[] = []
    private _fileCreateHandlers: ((uri: vscode.Uri) => void)[] = []
    private _fileChangeHandlers: ((uri: vscode.Uri) => void)[] = []
    private _fileDeleteHandlers: ((uri: vscode.Uri) => void)[] = []

    /**
     * Create a new FileWatcherManager
     */
    constructor(protected configManager: ExtensionConfigManager) {
        this.createWatchers()
    }

    /**
     * Add a handler for file create events
     * @param handler The handler function to call when a file changes
     * @returns This FileWatcherManager instance for chaining
     */
    protected onFileCreate(handler: (uri: vscode.Uri) => void): FileWatcherManager {
        this._fileCreateHandlers.push(handler)
        return this
    }

    /**
     * Add a handler for file change events
     * @param handler The handler function to call when a file changes
     * @returns This FileWatcherManager instance for chaining
     */
    protected onFileChange(handler: (uri: vscode.Uri) => void): FileWatcherManager {
        this._fileChangeHandlers.push(handler)
        return this
    }

    /**
     * Add a handler for file delete events
     * @param handler The handler function to call when a file is deleted
     * @returns This FileWatcherManager instance for chaining
     */
    protected onFileDelete(handler: (uri: vscode.Uri) => void): FileWatcherManager {
        this._fileDeleteHandlers.push(handler)
        return this
    }

    /**
     * Recreate watchers based on current configuration
     */
    public refreshWatchers(): void {
        log.debug('Refreshing file watchers based on current configuration')
        this.disposeWatchers()
        this.createWatchers()
    }

    /**
     * Create file watchers for all configured test patterns
     */
    private createWatchers(): void {
        // Get test file pattern from configuration
        const patterns = this.configManager.globalConfig.testFilePattern || []

        // Split pattern by comma and create watchers for each
        log.debug(`Creating file watchers for patterns: ${patterns.join(', ')}`)

        for (const pattern of patterns) {
            const watcher = vscode.workspace.createFileSystemWatcher(pattern)

            // Add event handlers
            watcher.onDidCreate((uri) => this._handleFileCreate(uri))
            watcher.onDidChange((uri) => this._handleFileChange(uri))
            watcher.onDidDelete((uri) => this._handleFileDelete(uri))

            this._watchers.push(watcher)
        }
    }

    /**
     * Handle file create events
     * @param uri The URI of the changed file
     */
    private _handleFileCreate(uri: vscode.Uri): void {
        log.debug(`File created: ${uri.fsPath}`)
        for (const handler of this._fileChangeHandlers) {
            handler(uri)
        }
    }

    /**
     * Handle file change events
     * @param uri The URI of the changed file
     */
    private _handleFileChange(uri: vscode.Uri): void {
        log.debug(`File changed: ${uri.fsPath}`)
        for (const handler of this._fileChangeHandlers) {
            handler(uri)
        }
    }

    /**
     * Handle file delete events
     * @param uri The URI of the deleted file
     */
    private _handleFileDelete(uri: vscode.Uri): void {
        log.debug(`File deleted: ${uri.fsPath}`)
        for (const handler of this._fileDeleteHandlers) {
            handler(uri)
        }
    }

    /**
     * Dispose all watchers
     */
    private disposeWatchers(): void {
        for (const watcher of this._watchers) {
            watcher.dispose()
        }
        this._watchers = []
    }

    /**
     * Dispose this manager and all its watchers
     */
    public dispose(): void {
        this.disposeWatchers()
        this._fileChangeHandlers = []
        this._fileDeleteHandlers = []
    }
}
