import { log } from '@vscode-wdio/logger'
import * as vscode from 'vscode'

export type WatchPattern = {
    base?: vscode.Uri
    pattern: string
}

/**
 * Manages file watchers for WebdriverIO test files
 */
export abstract class FileWatcherManager implements vscode.Disposable {
    private _watchers: vscode.Disposable[] = []
    private _fileCreateHandlers: ((uri: vscode.Uri) => void)[] = [this.handleFileCreate.bind(this)]
    private _fileChangeHandlers: ((uri: vscode.Uri) => void)[] = [this.handleFileChange.bind(this)]
    private _fileDeleteHandlers: ((uri: vscode.Uri) => void)[] = [this.handleFileDelete.bind(this)]

    public abstract enable(): void
    protected abstract getFilePatterns(): WatchPattern[]

    protected abstract handleFileCreate(uri: vscode.Uri): void | Promise<void>

    protected abstract handleFileChange(uri: vscode.Uri): void | Promise<void>

    protected abstract handleFileDelete(uri: vscode.Uri): void | Promise<void>

    /**
     * Add a handler for file create events
     * @param handler The handler function to call when a file changes
     * @returns This FileWatcherManager instance for chaining
     */
    public onFileCreate(handler: (uri: vscode.Uri) => void): FileWatcherManager {
        this._fileCreateHandlers.push(handler)
        return this
    }

    /**
     * Add a handler for file change events
     * @param handler The handler function to call when a file changes
     * @returns This FileWatcherManager instance for chaining
     */
    public onFileChange(handler: (uri: vscode.Uri) => void): FileWatcherManager {
        this._fileChangeHandlers.push(handler)
        return this
    }

    /**
     * Add a handler for file delete events
     * @param handler The handler function to call when a file is deleted
     * @returns This FileWatcherManager instance for chaining
     */
    public onFileDelete(handler: (uri: vscode.Uri) => void): FileWatcherManager {
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
    protected createWatchers(): void {
        // Get test file pattern from configuration
        const patterns = this.getFilePatterns()

        // Split pattern by comma and create watchers for each

        for (const p of patterns) {
            log.debug(`Creating file watchers for patterns: ${p.pattern}${p.base ? ` base: ${p.base}` : ''}`)
            const watcher = p.base
                ? vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(p.base, p.pattern))
                : vscode.workspace.createFileSystemWatcher(p.pattern)

            // Add event handlers
            watcher.onDidCreate(this._handleFileCreate.bind(this))
            watcher.onDidChange(this._handleFileChange.bind(this))
            watcher.onDidDelete(this._handleFileDelete.bind(this))

            this._watchers.push(watcher)
        }
    }

    /**
     * Handle file create events
     * @param uri The URI of the changed file
     */
    private _handleFileCreate(uri: vscode.Uri): void {
        log.debug(`File created: ${uri.fsPath}`)
        for (const handler of this._fileCreateHandlers) {
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
