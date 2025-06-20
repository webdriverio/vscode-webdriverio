import { ExtensionConfigManager } from '@vscode-wdio/config'
import { log } from '@vscode-wdio/logger'
import { RepositoryManager } from '@vscode-wdio/test'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
vi.mock('@vscode-wdio/config', () => {
    const ExtensionConfigManager = vi.fn()
    ExtensionConfigManager.prototype.initialize = vi.fn(() => Promise.resolve())
    ExtensionConfigManager.prototype.dispose = vi.fn(() => Promise.resolve())
    ExtensionConfigManager.prototype.getWdioConfigPaths = vi.fn(() => ['/test/wdio.conf.ts'])
    ExtensionConfigManager.prototype.listener = vi.fn()
    ExtensionConfigManager.prototype.on = vi.fn()

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
            expect(vi.mocked(RepositoryManager).mock.instances[0].initialize).toHaveBeenCalled()
            expect(vi.mocked(RepositoryManager).mock.instances[0].registerToTestController).toHaveBeenCalled()

            // Verify context subscriptions
            expect(fakeContext.subscriptions.length).toBeGreaterThan(0)
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
