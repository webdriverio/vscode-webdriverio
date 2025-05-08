import { normalize } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { ConfigFileWatcher } from '../../src/config/watcher.js'
import { FileWatcherManager } from '../../src/utils/watcher.js'
import type * as vscode from 'vscode'
import type { ServerManager } from '../../src/api/index.js'
import type { ExtensionConfigManager } from '../../src/config/index.js'
import type { RepositoryManager } from '../../src/test/index.js'

vi.mock('vscode')

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
    log: {
        debug: vi.fn(),
    },
}))

// Mock functions from test/index.js
vi.mock('../../src/test/index.js', () => ({
    convertUriToPath: vi.fn((uri) => uri.fsPath),
}))

// Mock normalizePath function
vi.mock('../../src/utils/normalize.js', () => ({
    normalizePath: vi.fn((path) => normalize(path)),
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

describe('ConfigFileWatcher', () => {
    let watcher: ConfigFileWatcher
    let mockConfigManager: ExtensionConfigManager
    let mockServerManager: ServerManager
    let mockRepositoryManager: RepositoryManager
    let mockRepo1: any
    let mockRepo2: any
    let mockUri: vscode.Uri

    beforeEach(() => {
        vi.clearAllMocks()

        // Create mock URI
        mockUri = {
            fsPath: '/path/to/wdio.conf.js',
        } as unknown as vscode.Uri

        // Create mock repositories
        mockRepo1 = {
            wdioConfigPath: '/path/to/wdio.conf.js',
            reloadSpecFiles: vi.fn().mockResolvedValue(undefined),
        }

        mockRepo2 = {
            wdioConfigPath: '/path/to/other/wdio.conf.js',
            reloadSpecFiles: vi.fn().mockResolvedValue(undefined),
        }

        // Create mock repository manager
        mockRepositoryManager = {
            repos: [mockRepo1, mockRepo2],
            addWdioConfig: vi.fn(),
            removeWdioConfig: vi.fn(),
        } as unknown as RepositoryManager

        // Create mock server manager
        mockServerManager = {
            reorganize: vi.fn().mockResolvedValue(undefined),
        } as unknown as ServerManager

        // Create mock config manager
        mockConfigManager = {
            on: vi.fn(),
            globalConfig: {
                configFilePattern: ['**/wdio.conf.{js,ts}'],
            },
            addWdioConfig: vi.fn().mockReturnValue(['workspaceUri1', 'workspaceUri2']),
            removeWdioConfig: vi.fn().mockReturnValue(['workspaceUri1']),
            getWdioConfigPaths: vi.fn().mockReturnValue(['/path/to/wdio.conf.js']),
        } as unknown as ExtensionConfigManager

        // Create the watcher instance
        watcher = new ConfigFileWatcher(mockConfigManager, mockServerManager, mockRepositoryManager)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('enable', () => {
        it('should create watchers and register event handler for config file pattern updates', () => {
            // Setup
            const createWatchersMock = vi.fn()
            Object.defineProperty(FileWatcherManager.prototype, 'createWatchers', { value: createWatchersMock })

            // Execute
            watcher.enable()

            // Verify
            expect(createWatchersMock).toHaveBeenCalled()
            expect(mockConfigManager.on).toHaveBeenCalledWith('update:configFilePattern', expect.any(Function))
        })

        it('should refresh watchers when config file pattern is updated', () => {
            // Setup
            const refreshWatchersMock = vi.fn()
            FileWatcherManager.prototype.refreshWatchers = refreshWatchersMock
            let callback: Function | undefined

            // Mock the 'on' method to capture the callback
            mockConfigManager.on = vi.fn().mockImplementation((event, cb) => {
                if (event === 'update:configFilePattern') {
                    callback = cb
                }
            })

            // Execute
            watcher.enable()
            callback?.()

            // Verify
            expect(refreshWatchersMock).toHaveBeenCalled()
        })
    })

    describe('getFilePatterns', () => {
        it('should return config file patterns from global config', () => {
            // Setup
            const expectedPatterns = ['**/wdio.conf.{js,ts}']
            mockConfigManager.globalConfig.configFilePattern = expectedPatterns

            // Execute
            const result = watcher['getFilePatterns']()

            // Verify
            expect(result).toEqual(expectedPatterns)
        })

        it('should return empty array if no patterns are defined', () => {
            // Setup
            mockConfigManager.globalConfig.configFilePattern = []

            // Execute
            const result = watcher['getFilePatterns']()

            // Verify
            expect(result).toEqual([])
        })
    })

    describe('handleFileCreate', () => {
        it('should add new WebdriverIO config file to config manager and repositories', async () => {
            // Execute
            await watcher['handleFileCreate'](mockUri)

            // Verify
            expect(mockConfigManager.addWdioConfig).toHaveBeenCalledWith(normalize('/path/to/wdio.conf.js'))
            expect(mockRepositoryManager.addWdioConfig).toHaveBeenCalledWith(
                'workspaceUri1',
                normalize('/path/to/wdio.conf.js')
            )
            expect(mockRepositoryManager.addWdioConfig).toHaveBeenCalledWith(
                'workspaceUri2',
                normalize('/path/to/wdio.conf.js')
            )
        })
    })

    describe('handleFileChange', () => {
        it('should reload spec files for affected repositories', () => {
            // Execute
            watcher['handleFileChange'](mockUri)

            // Verify
            expect(mockRepo1.reloadSpecFiles).toHaveBeenCalled()
            expect(mockRepo2.reloadSpecFiles).not.toHaveBeenCalled() // Different config path
        })

        it('should not reload spec files if no repositories are affected', () => {
            // Setup
            const unrelatedUri = {
                fsPath: '/path/to/unrelated/wdio.conf.js',
            } as unknown as vscode.Uri

            // Execute
            watcher['handleFileChange'](unrelatedUri)

            // Verify
            expect(mockRepo1.reloadSpecFiles).not.toHaveBeenCalled()
            expect(mockRepo2.reloadSpecFiles).not.toHaveBeenCalled()
        })
    })

    describe('handleFileDelete', () => {
        it('should remove config file from config manager and repositories', async () => {
            // Execute
            await watcher['handleFileDelete'](mockUri)

            // Verify
            expect(mockConfigManager.removeWdioConfig).toHaveBeenCalledWith(normalize('/path/to/wdio.conf.js'))
            expect(mockRepositoryManager.removeWdioConfig).toHaveBeenCalledWith(
                'workspaceUri1',
                normalize('/path/to/wdio.conf.js')
            )
            expect(mockServerManager.reorganize).toHaveBeenCalledWith(['/path/to/wdio.conf.js'])
        })
    })
})
