import { ExtensionConfigManager } from '@vscode-wdio/config'
import { log } from '@vscode-wdio/logger'
import { WdioWorkerManager } from '@vscode-wdio/server'
import { RepositoryManager } from '@vscode-wdio/test'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { activate, deactivate } from '../src/extension.js'

// Mock dependencies
vi.mock('vscode', async () => {
    const mockVscode = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...mockVscode,
        commands: {
            registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
        },
        workspace: {
            onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
        },
        tests: {
            createTestController: vi.fn(() => ({ dispose: vi.fn() })),
        },
    }
})

vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))
vi.mock('@vscode-wdio/server', () => {
    const WdioWorkerManager = vi.fn()
    WdioWorkerManager.prototype.start = vi.fn(() => Promise.resolve())
    WdioWorkerManager.prototype.dispose = vi.fn(() => Promise.resolve())

    return { WdioWorkerManager }
})
vi.mock('@vscode-wdio/config', () => {
    const ExtensionConfigManager = vi.fn()
    ExtensionConfigManager.prototype.initialize = vi.fn(() => Promise.resolve())
    ExtensionConfigManager.prototype.dispose = vi.fn(() => Promise.resolve())
    ExtensionConfigManager.prototype.getWdioConfigPaths = vi.fn(() => ['/test/wdio.conf.ts'])
    ExtensionConfigManager.prototype.listener = vi.fn()

    const ConfigFileWatcher = vi.fn()
    ConfigFileWatcher.prototype.enable = vi.fn()
    ConfigFileWatcher.prototype.dispose = vi.fn()
    return {
        ExtensionConfigManager,
        ConfigFileWatcher,
    }
})
vi.mock('@vscode-wdio/test', () => {
    const RepositoryManager = vi.fn()
    RepositoryManager.prototype.initialize = vi.fn(() => Promise.resolve())
    RepositoryManager.prototype.registerToTestController = vi.fn(() => {})
    RepositoryManager.prototype.dispose = vi.fn(() => Promise.resolve())
    RepositoryManager.prototype.repos = [
        {
            discoverAllTests: vi.fn(() => Promise.resolve([])),
        },
    ]
    const TestfileWatcher = vi.fn()
    TestfileWatcher.prototype.dispose = vi.fn()
    return {
        RepositoryManager,
        TestfileWatcher,
    }
})
vi.mock('../src/commands/configureTests.js', () => ({
    configureTests: vi.fn(),
}))

describe('extension', () => {
    let fakeContext: any

    beforeEach(() => {
        vi.resetAllMocks()

        // Create fake context with subscriptions array
        fakeContext = {
            subscriptions: [],
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
        deactivate()
    })

    describe('activate', () => {
        it('should successfully activate the extension', async () => {
            // Act
            await activate(fakeContext)

            // Assert
            expect(log.info).toHaveBeenCalledWith('WebdriverIO Runner extension is now active')
            // vi.mocked(TestRunner).mock.instances[0].run
            //
            expect(vi.mocked(ExtensionConfigManager).mock.instances[0].initialize).toHaveBeenCalled()
            expect(vi.mocked(WdioWorkerManager).mock.instances[0].start).toHaveBeenCalled()
            expect(vi.mocked(RepositoryManager).mock.instances[0].initialize).toHaveBeenCalled()
            expect(vi.mocked(RepositoryManager).mock.instances[0].registerToTestController).toHaveBeenCalled()

            // Verify context subscriptions
            expect(fakeContext.subscriptions.length).toBeGreaterThan(0)
        })

        it('should handle server start error gracefully', async () => {
            // Arrange
            const errorMessage = 'Failed to start server'
            vi.mocked(WdioWorkerManager.prototype.start).mockRejectedValueOnce(new Error(errorMessage))

            // Act
            await activate(fakeContext)

            // Assert
            expect(log.error).toHaveBeenCalledWith(`Failed to start WebdriverIO worker process: ${errorMessage}`)
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                `Failed to start WebdriverIO worker process: ${errorMessage}`
            )
        })

        it('should continue activation even when workerManager.start rejects', async () => {
            // Arrange
            vi.mocked(WdioWorkerManager.prototype.start).mockRejectedValueOnce(new Error('Server failed'))

            // Act
            await activate(fakeContext)

            // Assert
            expect(vi.mocked(RepositoryManager).mock.instances[0].initialize).toHaveBeenCalled()
            expect(vi.mocked(RepositoryManager).mock.instances[0].registerToTestController).toHaveBeenCalled()
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Server failed'))
        })
    })

    describe('deactivate', () => {
        it('should dispose the extension instance when activate has been called', async () => {
            // Arrange - First activate the extension
            await activate(fakeContext)

            // Act
            await deactivate()

            // Assert
            expect(fakeContext.subscriptions.length).toBeGreaterThan(0)

            // The dispose method should clean up the internal disposables
            // When we call deactivate again, it should not throw
            expect(() => deactivate()).not.toThrow()
        })

        it('should not throw error when called without activate', () => {
            // Act & Assert
            expect(() => deactivate()).not.toThrow()
        })
    })
})
