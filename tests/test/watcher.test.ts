import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TestfileWatcher } from '../../src/test/watcher.js'
import { log } from '../../src/utils/logger.js'

import type * as vscode from 'vscode'
import type { ExtensionConfigManager } from '../../src/config/index.js'
import type { RepositoryManager } from '../../src/test/manager.js'

vi.mock('vscode')

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
    return { FileWatcherManager }
})

describe('TestfileWatcher', () => {
    let watcher: TestfileWatcher
    let mockConfigManager: ExtensionConfigManager
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
            normalizePath: vi.fn().mockImplementation((path) => path),
        }

        mockRepo2 = {
            getSpecByFilePath: vi.fn(),
            reloadSpecFiles: vi.fn().mockResolvedValue(undefined),
            removeSpecFile: vi.fn(),
            normalizePath: vi.fn().mockImplementation((path) => path),
        }

        // Create mock repository manager
        mockRepositoryManager = {
            repos: [mockRepo1, mockRepo2],
        } as unknown as RepositoryManager

        // Create mock config manager
        mockConfigManager = {
            on: vi.fn(),
        } as unknown as ExtensionConfigManager

        // Create the watcher instance
        watcher = new TestfileWatcher(mockConfigManager, mockRepositoryManager)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('enable', () => {
        it('should register event handlers', () => {
            watcher = new TestfileWatcher(mockConfigManager, mockRepositoryManager)
            // Setup
            const onFileCreateSpy = vi.spyOn(watcher as any, 'onFileCreate')
            const onFileChangeSpy = vi.spyOn(watcher as any, 'onFileChange')
            const onFileDeleteSpy = vi.spyOn(watcher as any, 'onFileDelete')

            // Execute
            watcher.enable()
            // Verify
            expect(onFileCreateSpy).toHaveBeenCalled()
            expect(onFileChangeSpy).toHaveBeenCalled()
            expect(onFileDeleteSpy).toHaveBeenCalled()
            expect(mockConfigManager.on).toHaveBeenCalledWith('update:testFilePattern', expect.any(Function))
        })
    })

    describe('handleFileChange', () => {
        it('should process file creation correctly', async () => {
            // Execute
            await (watcher as any).handleFileChange(mockUri, true)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file created: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 2 repositories')
            expect(mockRepo1.reloadSpecFiles).toHaveBeenCalledWith(['/path/to/test/file.spec.js'])
            expect(mockRepo2.reloadSpecFiles).toHaveBeenCalledWith(['/path/to/test/file.spec.js'])
        })

        it('should process file modification correctly', async () => {
            // Setup - only one repo contains the file
            mockRepo1.getSpecByFilePath.mockReturnValue(true)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await (watcher as any).handleFileChange(mockUri, false)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file changed: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 1 repositories')
            expect(mockRepo1.reloadSpecFiles).toHaveBeenCalledWith(['/path/to/test/file.spec.js'])
            expect(mockRepo2.reloadSpecFiles).not.toHaveBeenCalled()
        })

        it('should handle when no repositories are affected', async () => {
            // Setup - no repos contain the file
            mockRepo1.getSpecByFilePath.mockReturnValue(false)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await (watcher as any).handleFileChange(mockUri, false)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file changed: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 0 repositories')
            expect(mockRepo1.reloadSpecFiles).not.toHaveBeenCalled()
            expect(mockRepo2.reloadSpecFiles).not.toHaveBeenCalled()
        })

        it('should normalize paths when reloading spec files', async () => {
            // Setup
            mockRepo1.normalizePath.mockReturnValue('/normalized/path1')
            mockRepo2.normalizePath.mockReturnValue('/normalized/path2')
            mockRepo1.getSpecByFilePath.mockReturnValue(true)
            mockRepo2.getSpecByFilePath.mockReturnValue(true)

            // Execute
            await (watcher as any).handleFileChange(mockUri, false)

            // Verify
            expect(mockRepo1.reloadSpecFiles).toHaveBeenCalledWith(['/normalized/path1'])
            expect(mockRepo2.reloadSpecFiles).toHaveBeenCalledWith(['/normalized/path2'])
        })
    })

    describe('handleFileDelete', () => {
        it('should remove spec file from affected repositories', async () => {
            // Setup - only one repo contains the file
            mockRepo1.getSpecByFilePath.mockReturnValue(true)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await (watcher as any).handleFileDelete(mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file deleted: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 1 repositories')
            expect(mockRepo1.removeSpecFile).toHaveBeenCalledWith('/path/to/test/file.spec.js')
            expect(mockRepo2.removeSpecFile).not.toHaveBeenCalled()
        })

        it('should handle when no repositories are affected by deletion', async () => {
            // Setup - no repos contain the file
            mockRepo1.getSpecByFilePath.mockReturnValue(false)
            mockRepo2.getSpecByFilePath.mockReturnValue(false)

            // Execute
            await (watcher as any).handleFileDelete(mockUri)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test file deleted: /path/to/test/file.spec.js')
            expect(log.debug).toHaveBeenCalledWith('Affected repository are 0 repositories')
            expect(mockRepo1.removeSpecFile).not.toHaveBeenCalled()
            expect(mockRepo2.removeSpecFile).not.toHaveBeenCalled()
        })

        it('should normalize paths when removing spec files', async () => {
            // Setup
            mockRepo1.normalizePath.mockReturnValue('/normalized/path1')
            mockRepo2.normalizePath.mockReturnValue('/normalized/path2')
            mockRepo1.getSpecByFilePath.mockReturnValue(true)
            mockRepo2.getSpecByFilePath.mockReturnValue(true)

            // Execute
            await (watcher as any).handleFileDelete(mockUri)

            // Verify
            expect(mockRepo1.removeSpecFile).toHaveBeenCalledWith('/normalized/path1')
            expect(mockRepo2.removeSpecFile).toHaveBeenCalledWith('/normalized/path2')
        })
    })
})
