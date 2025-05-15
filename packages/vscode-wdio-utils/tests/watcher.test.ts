import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { FileWatcherManager, type WatchPattern } from '../src/watcher.js'

// Mock vscode module
vi.mock('vscode', async () => {
    const mockVscode = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...mockVscode,
        RelativePattern: vi.fn(),
    }
})

// Mock logger module
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

// Create a concrete implementation of FileWatcherManager for testing
class TestFileWatcherManager extends FileWatcherManager {
    public handleFileCreateCalls = 0
    public handleFileChangeCalls = 0
    public handleFileDeleteCalls = 0
    public lastHandledUri: vscode.Uri | null = null
    public filePatterns: WatchPattern[] = [
        {
            pattern: '**/*.test.ts',
        },
    ]
    constructor() {
        super()
    }

    protected getFilePatterns(): WatchPattern[] {
        return this.filePatterns
    }

    protected handleFileCreate(uri: vscode.Uri): void {
        this.handleFileCreateCalls++
        this.lastHandledUri = uri
    }

    protected handleFileChange(uri: vscode.Uri): void {
        this.handleFileChangeCalls++
        this.lastHandledUri = uri
    }

    protected handleFileDelete(uri: vscode.Uri): void {
        this.handleFileDeleteCalls++
        this.lastHandledUri = uri
    }

    // Expose private methods for testing
    public exposeCreateWatchers(): void {
        this.createWatchers()
    }

    public exposeHandleFileCreate(uri: vscode.Uri): void {
        this['_handleFileCreate'](uri)
    }

    public exposeHandleFileChange(uri: vscode.Uri): void {
        this['_handleFileChange'](uri)
    }

    public exposeHandleFileDelete(uri: vscode.Uri): void {
        this['_handleFileDelete'](uri)
    }

    // Get access to internal watchers for verification
    public getWatchers(): vscode.Disposable[] {
        return this['_watchers']
    }
    public enable(): void {
        // pass
    }
}

describe('FileWatcherManager', () => {
    let fileWatcherManager: TestFileWatcherManager
    const testUri = { fsPath: '/path/to/test.ts' } as vscode.Uri

    beforeEach(() => {
        // Reset all mocks before each test
        vi.resetAllMocks()

        vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue({
            onDidCreate: vi.fn(),
            onDidChange: vi.fn(),
            onDidDelete: vi.fn(),
            dispose: vi.fn(),
        } as unknown as vscode.FileSystemWatcher)

        fileWatcherManager = new TestFileWatcherManager()
    })

    afterEach(() => {
        // Clean up after each test
        fileWatcherManager.dispose()
    })

    describe('Event handlers registration', () => {
        it('should register file create event handlers', () => {
            const handler = vi.fn()
            fileWatcherManager.onFileCreate(handler)

            // Trigger the event
            fileWatcherManager['_handleFileCreate'](testUri)

            // Verify both default and custom handlers were called
            expect(fileWatcherManager.handleFileCreateCalls).toBe(1)
            expect(handler).toHaveBeenCalledWith(testUri)
        })

        it('should register file change event handlers', () => {
            const handler = vi.fn()
            fileWatcherManager.onFileChange(handler)

            // Trigger the event
            fileWatcherManager.exposeHandleFileChange(testUri)

            // Verify both default and custom handlers were called
            expect(fileWatcherManager.handleFileChangeCalls).toBe(1)
            expect(handler).toHaveBeenCalledWith(testUri)
        })

        it('should register file delete event handlers', () => {
            const handler = vi.fn()
            fileWatcherManager.onFileDelete(handler)

            // Trigger the event
            fileWatcherManager.exposeHandleFileDelete(testUri)

            // Verify both default and custom handlers were called
            expect(fileWatcherManager.handleFileDeleteCalls).toBe(1)
            expect(handler).toHaveBeenCalledWith(testUri)
        })

        it('should support method chaining for event registration', () => {
            const result = fileWatcherManager.onFileCreate(vi.fn()).onFileChange(vi.fn()).onFileDelete(vi.fn())

            expect(result).toBe(fileWatcherManager)
        })
    })

    describe('Watcher management', () => {
        it('should create watchers for all file patterns', () => {
            const mockCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher
            fileWatcherManager.filePatterns = [{ pattern: '**/*.test.ts' }, { pattern: '**/*.spec.ts' }]

            fileWatcherManager.exposeCreateWatchers()

            expect(mockCreateFileSystemWatcher).toHaveBeenCalledTimes(2)
            expect(mockCreateFileSystemWatcher).toHaveBeenCalledWith('**/*.test.ts')
            expect(mockCreateFileSystemWatcher).toHaveBeenCalledWith('**/*.spec.ts')
        })

        it('should create watchers for all file patterns with base directory path', () => {
            const mockCreateFileSystemWatcher = vscode.workspace.createFileSystemWatcher
            fileWatcherManager.filePatterns = [
                {
                    pattern: '**/*.test.ts',
                    base: { fsPath: '/path/to' } as vscode.Uri,
                },
                {
                    pattern: '**/*.spec.ts',
                    base: { fsPath: '/path/to' } as vscode.Uri,
                },
            ]

            fileWatcherManager.exposeCreateWatchers()

            expect(mockCreateFileSystemWatcher).toHaveBeenCalledTimes(2)
            expect(vscode.RelativePattern).toHaveBeenCalledTimes(2)
        })

        it('should dispose all watchers when refreshing', () => {
            // Create some watchers first
            fileWatcherManager.exposeCreateWatchers()
            const watchers = fileWatcherManager.getWatchers()
            const mockDispose = watchers[0].dispose

            fileWatcherManager.refreshWatchers()

            expect(mockDispose).toHaveBeenCalled()
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled()
        })

        it('should dispose all watchers when disposing the manager', () => {
            // Create some watchers first
            fileWatcherManager.exposeCreateWatchers()
            const watchers = fileWatcherManager.getWatchers()
            const mockDispose = watchers[0].dispose

            fileWatcherManager.dispose()

            expect(mockDispose).toHaveBeenCalled()
            expect(fileWatcherManager.getWatchers().length).toBe(0)
        })
    })

    describe('Event handlers', () => {
        it('should call registered handlers for file create events', () => {
            const mockOnDidCreate = vi.fn()
            vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue({
                onDidCreate: mockOnDidCreate,
                onDidChange: vi.fn(),
                onDidDelete: vi.fn(),
                dispose: vi.fn(),
            } as unknown as vscode.FileSystemWatcher)

            fileWatcherManager.exposeCreateWatchers()

            // Get the callback that was registered with onDidCreate
            const callback = vi.mocked(mockOnDidCreate).mock.calls[0][0]

            // Call the callback directly with a test URI
            callback(testUri)

            expect(fileWatcherManager.handleFileCreateCalls).toBe(1)
        })

        it('should call registered handlers for file change events', () => {
            const mockOnDidChange = vi.fn()
            vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue({
                onDidCreate: vi.fn(),
                onDidChange: mockOnDidChange,
                onDidDelete: vi.fn(),
                dispose: vi.fn(),
            } as unknown as vscode.FileSystemWatcher)

            fileWatcherManager.exposeCreateWatchers()

            // Get the callback that was registered with onDidCreate
            const callback = vi.mocked(mockOnDidChange).mock.calls[0][0]

            // Call the callback directly with a test URI
            callback(testUri)

            expect(fileWatcherManager.handleFileChangeCalls).toBe(1)
        })

        it('should call registered handlers for file delete events', () => {
            const mockOnDidDelete = vi.fn()
            vi.mocked(vscode.workspace.createFileSystemWatcher).mockReturnValue({
                onDidCreate: vi.fn(),
                onDidChange: vi.fn(),
                onDidDelete: mockOnDidDelete,
                dispose: vi.fn(),
            } as unknown as vscode.FileSystemWatcher)

            fileWatcherManager.exposeCreateWatchers()

            // Get the callback that was registered with onDidCreate
            const callback = vi.mocked(mockOnDidDelete).mock.calls[0][0]

            // Call the callback directly with a test URI
            callback(testUri)

            expect(fileWatcherManager.handleFileDeleteCalls).toBe(1)
        })
    })
})
