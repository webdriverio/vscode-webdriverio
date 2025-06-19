import { normalize } from 'node:path'

import { FileWatcherManager } from '@vscode-wdio/utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { ConfigFileWatcher } from '../src/watcher.js'
import type { IWorkerManager } from '@vscode-wdio/types/server'
import type { IRepositoryManager } from '@vscode-wdio/types/test'
import type { ExtensionConfigManager } from '../src/index.js'

// Mock dependencies
vi.mock('vscode', async () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

// Mock functions from test/index.js
vi.mock('../../src/test/index.js', () => {
    const TestfileWatcher = vi.fn()
    TestfileWatcher.prototype.enable = vi.fn()
    TestfileWatcher.prototype.refreshWatchers = vi.fn()
    return {
        TestfileWatcher,
        convertUriToPath: vi.fn((uri) => uri.fsPath),
    }
})

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

class MockTestFileWatcher extends FileWatcherManager {
    protected getFilePatterns() {
        return [{ pattern: '*.spec.ts' }]
    }
    protected handleFileCreate(_uri: vscode.Uri): void | Promise<void> {}
    protected handleFileChange(_uri: vscode.Uri): void | Promise<void> {}
    protected handleFileDelete(_uri: vscode.Uri): void | Promise<void> {}
    enable(): void {}
}

describe('ConfigFileWatcher', () => {
    let watcher: ConfigFileWatcher
    let mockConfigManager: ExtensionConfigManager
    let mockServerManager: IWorkerManager
    let mockRepositoryManager: IRepositoryManager
    let mockRepo1: any
    let mockRepo2: any
    let mockUri: vscode.Uri

    beforeEach(() => {
        vi.clearAllMocks()

        // Create mock URI
        mockUri = vscode.Uri.file('/path/to/wdio.conf.js')

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
        } as unknown as IRepositoryManager

        // Create mock server manager
        mockServerManager = {
            reorganize: vi.fn().mockResolvedValue(undefined),
        } as unknown as IWorkerManager

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
        watcher = new ConfigFileWatcher(
            mockConfigManager,
            mockServerManager,
            mockRepositoryManager,
            new MockTestFileWatcher()
        )
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
            ;(mockConfigManager.globalConfig.configFilePattern as any) = expectedPatterns

            // Execute
            const result = watcher['getFilePatterns']()

            // Verify
            expect(result).toEqual([{ pattern: '**/wdio.conf.{js,ts}' }])
        })

        it('should return empty array if no patterns are defined', () => {
            // Setup
            ;(mockConfigManager.globalConfig.configFilePattern as any) = []

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
