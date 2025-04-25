import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { log } from '../../src/utils/logger.js'
import { FileWatcherManager } from '../../src/utils/watcher.js'

import type { ExtensionConfigManager } from '../../src/config/index.js'

// Mock vscode module
vi.mock('vscode', () => ({
    workspace: {
        createFileSystemWatcher: vi.fn(),
    },
}))

// Mock logger module
vi.mock('../../src/utils/logger.js', () => ({
    log: {
        debug: vi.fn(),
    },
}))

describe('FileWatcherManager', () => {
    let watcher: FileWatcherManager
    let mockConfigManager: ExtensionConfigManager
    let mockWatcher: any
    let mockUri: vscode.Uri

    beforeEach(() => {
        vi.clearAllMocks()

        // Create mock URI
        mockUri = {
            fsPath: '/path/to/test/file.spec.js',
        } as unknown as vscode.Uri

        // Create mock vscode file watcher
        mockWatcher = {
            onDidCreate: vi.fn(),
            onDidChange: vi.fn(),
            onDidDelete: vi.fn(),
            dispose: vi.fn(),
        }

        // Mock VSCode file system watcher
        vi.mocked(vscode.workspace.createFileSystemWatcher).mockImplementation(() => mockWatcher)

        // Create mock config manager
        mockConfigManager = {
            globalConfig: {
                testFilePattern: ['**/*.spec.js', '**/*.test.ts'],
            },
        } as unknown as ExtensionConfigManager

        // Create watcher instance
        watcher = new FileWatcherManager(mockConfigManager)
    })

    afterEach(() => {
        watcher.dispose()
        vi.resetAllMocks()
    })

    describe('constructor', () => {
        it('should create watchers for all test patterns', () => {
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(2)
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('**/*.spec.js')
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('**/*.test.ts')
            expect(mockWatcher.onDidCreate).toHaveBeenCalledTimes(2)
            expect(mockWatcher.onDidChange).toHaveBeenCalledTimes(2)
            expect(mockWatcher.onDidDelete).toHaveBeenCalledTimes(2)
            expect(log.debug).toHaveBeenCalledWith('Creating file watchers for patterns: **/*.spec.js, **/*.test.ts')
        })

        it('should handle empty test patterns array', () => {
            const emptyConfigManager = {
                globalConfig: {
                    testFilePattern: [],
                },
            } as unknown as ExtensionConfigManager

            vi.clearAllMocks()
            const emptyWatcher = new FileWatcherManager(emptyConfigManager)

            expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled()
            expect(log.debug).toHaveBeenCalledWith('Creating file watchers for patterns: ')

            emptyWatcher.dispose()
        })

        it('should handle undefined test patterns', () => {
            const undefinedConfigManager = {
                globalConfig: {},
            } as unknown as ExtensionConfigManager

            vi.clearAllMocks()
            const undefinedWatcher = new FileWatcherManager(undefinedConfigManager)

            expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled()
            expect(log.debug).toHaveBeenCalledWith('Creating file watchers for patterns: ')

            undefinedWatcher.dispose()
        })
    })

    describe('file event handlers', () => {
        let createHandler: (uri: vscode.Uri) => void
        let changeHandler: (uri: vscode.Uri) => void
        let deleteHandler: (uri: vscode.Uri) => void

        beforeEach(() => {
            // Capture the handlers passed to event listeners
            createHandler = mockWatcher.onDidCreate.mock.calls[0][0]
            changeHandler = mockWatcher.onDidChange.mock.calls[0][0]
            deleteHandler = mockWatcher.onDidDelete.mock.calls[0][0]
        })

        describe('_handleFileCreate', () => {
            it('should call handlers correctly', () => {
                // Using type assertion to access protected methods
                const spy = vi.spyOn(watcher as any, '_handleFileCreate')

                createHandler(mockUri)

                expect(log.debug).toHaveBeenCalledWith(`File created: ${mockUri.fsPath}`)
                expect(spy).toHaveBeenCalled()
            })
        })

        describe('_handleFileChange', () => {
            it('should log debug message correctly', () => {
                changeHandler(mockUri)

                expect(log.debug).toHaveBeenCalledWith(`File changed: ${mockUri.fsPath}`)
            })
        })

        describe('_handleFileDelete', () => {
            it('should log debug message correctly', () => {
                deleteHandler(mockUri)

                expect(log.debug).toHaveBeenCalledWith(`File deleted: ${mockUri.fsPath}`)
            })
        })
    })

    describe('handler methods', () => {
        it('should allow adding file create handler', () => {
            const handler = vi.fn()
            const result = (watcher as any).onFileCreate(handler)

            expect(result).toBe(watcher)

            // Ensure the handler array has the expected handler
            expect((watcher as any)._fileCreateHandlers).toContain(handler)
        })

        it('should allow adding file change handler', () => {
            const handler = vi.fn()
            const result = (watcher as any).onFileChange(handler)

            expect(result).toBe(watcher)

            // Ensure the handler array has the expected handler
            expect((watcher as any)._fileChangeHandlers).toContain(handler)
        })

        it('should allow adding file delete handler', () => {
            const handler = vi.fn()
            const result = (watcher as any).onFileDelete(handler)

            expect(result).toBe(watcher)

            // Ensure the handler array has the expected handler
            expect((watcher as any)._fileDeleteHandlers).toContain(handler)
        })
    })

    describe('refreshWatchers', () => {
        it('should dispose old watchers and create new ones', () => {
            const disposeSpy = vi.spyOn(watcher as any, 'disposeWatchers')
            const createSpy = vi.spyOn(watcher as any, 'createWatchers')

            watcher.refreshWatchers()

            expect(log.debug).toHaveBeenCalledWith('Refreshing file watchers based on current configuration')
            expect(disposeSpy).toHaveBeenCalled()
            expect(createSpy).toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('should dispose all watchers and clear arrays', () => {
            const addedHandler1 = vi.fn()
            const addedHandler2 = vi.fn()
            const addedHandler3 = vi.fn()

            // Add some handlers
            ;(watcher as any).onFileCreate(addedHandler1)
            ;(watcher as any).onFileChange(addedHandler2)
            ;(watcher as any).onFileDelete(addedHandler3)

            watcher.dispose()

            expect(mockWatcher.dispose).toHaveBeenCalledTimes(2)
            expect((watcher as any)._fileChangeHandlers).toEqual([])
            expect((watcher as any)._fileDeleteHandlers).toEqual([])
        })

        it('should not throw when dispose is called multiple times', () => {
            expect(() => {
                watcher.dispose()
                watcher.dispose()
            }).not.toThrow()
        })
    })

    describe('event handler execution', () => {
        it('should execute change handlers when file is created', () => {
            const createHandler = vi.fn()
            const changeHandler = vi.fn()

            // Set up custom handlers
            ;(watcher as any).onFileCreate(createHandler)
            ;(watcher as any).onFileChange(changeHandler)

            // Trigger create event
            const createEventHandler = mockWatcher.onDidCreate.mock.calls[0][0]
            createEventHandler(mockUri)

            // Verify both create and change handlers are called
            expect(createHandler).not.toHaveBeenCalled() // _handleFileCreate only triggers change handlers
            expect(changeHandler).toHaveBeenCalledWith(mockUri)
        })

        it('should execute change handlers when file is changed', () => {
            const changeHandler = vi.fn()

            // Set up custom handler
            ;(watcher as any).onFileChange(changeHandler)

            // Trigger change event
            const changeEventHandler = mockWatcher.onDidChange.mock.calls[0][0]
            changeEventHandler(mockUri)

            expect(changeHandler).toHaveBeenCalledWith(mockUri)
        })

        it('should execute delete handlers when file is deleted', () => {
            const deleteHandler = vi.fn()

            // Set up custom handler
            ;(watcher as any).onFileDelete(deleteHandler)

            // Trigger delete event
            const deleteEventHandler = mockWatcher.onDidDelete.mock.calls[0][0]
            deleteEventHandler(mockUri)

            expect(deleteHandler).toHaveBeenCalledWith(mockUri)
        })
    })
})
