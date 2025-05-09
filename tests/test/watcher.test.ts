import { normalize } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TestfileWatcher } from '../../src/test/watcher.js'
import { log } from '../../src/utils/logger.js'
import { FileWatcherManager } from '../../src/utils/watcher.js'
import type * as vscode from 'vscode'
import type { RepositoryManager } from '../../src/test/manager.js'

vi.mock('vscode', ()=>{
    return {
        Uri:{
            file:vi.fn((f)=>({ fsPath:f }))
        }
    }
})

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
    log: {
        debug: vi.fn(),
    },
}))

// Mock FileWatcherManager parent class
vi.mock('../../src/utils/watcher.js', () => {
    const FileWatcherManager = vi.fn()
    FileWatcherManager.prototype.onFileCreate = vi.fn()
    FileWatcherManager.prototype.onFileChange = vi.fn()
    FileWatcherManager.prototype.onFileDelete = vi.fn()
    FileWatcherManager.prototype.refreshWatchers = vi.fn()
    FileWatcherManager.prototype.createWatchers = vi.fn()
    return { FileWatcherManager }
})

describe('TestfileWatcher', () => {
    let watcher: TestfileWatcher
    let mockRepositoryManager: RepositoryManager
    let mockRepo1: any
    let mockRepo2: any
    let mockUri: vscode.Uri

    beforeEach(() => {
        vi.clearAllMocks()

        // Create mock URI
        mockUri = {
            fsPath: '/path/to/test/file.spec.js',
        } as unknown as vscode.Uri

        // Create mock repositories
        mockRepo1 = {
            getSpecByFilePath: vi.fn(),
            reloadSpecFiles: vi.fn().mockResolvedValue(undefined),
            removeSpecFile: vi.fn(),
        }

        mockRepo2 = {
            getSpecByFilePath: vi.fn(),
            reloadSpecFiles: vi.fn().mockResolvedValue(undefined),
            removeSpecFile: vi.fn(),
        }

        // Create mock repository manager
        mockRepositoryManager = {
            repos: [mockRepo1, mockRepo2],
        } as unknown as RepositoryManager

        // Create the watcher instance
        watcher = new TestfileWatcher( mockRepositoryManager)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('enable', () => {
        it('should register event handlers', () => {
            const mock = vi.fn()
            FileWatcherManager.prototype['createWatchers'] = mock

            watcher = new TestfileWatcher( mockRepositoryManager)

            // Execute
            watcher.enable()
            // Verify
            expect(mock).toHaveBeenCalled()
        })
    })

    describe('handleFileChange', () => {
        it('should process file creation correctly', async () => {
            // Execute
            await watcher['handleFileCreate'](mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file created: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 2 repositories')
            expect(mockRepo1.reloadSpecFiles).toHaveBeenCalledWith([normalize('/path/to/test/file.spec.js')])
            expect(mockRepo2.reloadSpecFiles).toHaveBeenCalledWith([normalize('/path/to/test/file.spec.js')])
        })

        it('should process file modification correctly', async () => {
            // Setup - only one repo contains the file
            mockRepo1.getSpecByFilePath.mockReturnValue(true)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await watcher['handleFileChange'](mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file changed: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 1 repositories')
            expect(mockRepo1.reloadSpecFiles).toHaveBeenCalledWith([normalize('/path/to/test/file.spec.js')])
            expect(mockRepo2.reloadSpecFiles).not.toHaveBeenCalled()
        })

        it('should handle when no repositories are affected', async () => {
            // Setup - no repos contain the file
            mockRepo1.getSpecByFilePath.mockReturnValue(false)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await watcher['handleFileChange'](mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file changed: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 0 repositories')
            expect(mockRepo1.reloadSpecFiles).not.toHaveBeenCalled()
            expect(mockRepo2.reloadSpecFiles).not.toHaveBeenCalled()
        })
    })

    describe('handleFileDelete', () => {
        it('should remove spec file from affected repositories', async () => {
            // Setup - only one repo contains the file
            mockRepo1.getSpecByFilePath.mockReturnValue(true)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await watcher['handleFileDelete'](mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file deleted: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 1 repositories')
            expect(mockRepo1.removeSpecFile).toHaveBeenCalledWith(normalize('/path/to/test/file.spec.js'))
            expect(mockRepo2.removeSpecFile).not.toHaveBeenCalled()
        })

        it('should handle when no repositories are affected by deletion', async () => {
            // Setup - no repos contain the file
            mockRepo1.getSpecByFilePath.mockReturnValue(false)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await watcher['handleFileDelete'](mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file deleted: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 0 repositories')
            expect(mockRepo1.removeSpecFile).not.toHaveBeenCalled()
            expect(mockRepo2.removeSpecFile).not.toHaveBeenCalled()
        })
    })
})
