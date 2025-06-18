import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { createTestItem } from '../../../tests/utils.js'
import { DebugRunner, DebugSessionTerminatedError, WdioExtensionDebugWorker } from '../src/debug.js'
import * as runModule from '../src/run.js'
import * as workerModule from '../src/worker.js'

import type { IExtensionConfigManager } from '@vscode-wdio/types/config'

// Mock VSCode
vi.mock('vscode', async () => {
    const mockModule = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...mockModule,
        debug: {
            startDebugging: vi.fn(),
            stopDebugging: vi.fn(),
            onDidStartDebugSession: vi.fn(),
            onDidTerminateDebugSession: vi.fn(),
        },
    }
})

// Mock logger
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

const mockConfigManager = {
    globalConfig: {
        workerIdleTimeout: 600,
    },
} as unknown as IExtensionConfigManager

describe('DebugRunner', () => {
    let workspaceFolder: vscode.WorkspaceFolder
    let debugRunner: DebugRunner
    let mockToken: vscode.CancellationToken
    let mockWorker: WdioExtensionDebugWorker
    let mockWorkerResult: any
    let terminationCallback: (() => void) | null = null

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks()

        // Create mocks
        workspaceFolder = {
            uri: { fsPath: '/workspace' } as vscode.Uri,
            name: 'Test Workspace',
            index: 0,
        }

        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        }

        mockWorker = {
            cid: 'dummy-worker#1',
            start: vi.fn().mockResolvedValue(undefined),
            stop: vi.fn().mockResolvedValue(undefined),
            waitForStart: vi.fn().mockResolvedValue(undefined),
            setDebugTerminationCallback: vi.fn().mockImplementation((callback: () => void) => {
                terminationCallback = callback
            }),
            idleMonitor: {
                pauseTimer: vi.fn(),
                resumeTimer: vi.fn(),
            },
        } as unknown as WdioExtensionDebugWorker

        mockWorkerResult = {
            success: true,
            duration: 100,
            detail: [],
            log: 'All OK.',
        }

        // Mock TestRunner.run method
        vi.spyOn(runModule.TestRunner.prototype, 'run').mockImplementation(async () => {
            // Simulate a test execution that takes some time
            await new Promise((resolve) => setTimeout(resolve, 10))
            return mockWorkerResult
        })

        // Create debug runner instance
        debugRunner = new DebugRunner(mockConfigManager, workspaceFolder, mockToken, '/path/to/worker/cwd', mockWorker)
    })

    afterEach(() => {
        debugRunner.dispose()
        vi.restoreAllMocks()
        terminationCallback = null
    })

    it('should start worker and run test', async () => {
        // Create a test case test item
        const testData = createTestItem(['workspace', 'config', 'spec.js', 'MyTest'].join(TEST_ID_SEPARATOR), {
            isTestcase: true,
            repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
        })

        // Run the test
        const result = await debugRunner.run(testData.testItem, testData.metadata)

        // Assert worker start and waitForStart were called
        expect(mockWorker.start).toHaveBeenCalled()
        expect(mockWorker.waitForStart).toHaveBeenCalled()

        // Assert test was executed and returned correct result
        expect(result).toEqual(mockWorkerResult)
    })

    it('should throw DebugSessionTerminatedError when debug session terminates during run', async () => {
        // Create a test case test item
        const testData = createTestItem(['workspace', 'config', 'spec.js', 'MyTest'].join(TEST_ID_SEPARATOR), {
            isTestcase: true,
            repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
        })

        // Start running the test but don't await it yet
        const runPromise = debugRunner.run(testData.testItem, testData.metadata)

        // Wait a little to ensure the test run has started
        await new Promise((resolve) => setTimeout(resolve, 5))

        // Simulate debug session termination by calling the callback
        if (terminationCallback) {
            terminationCallback()
        }

        // Now the run should fail with DebugSessionTerminatedError
        await expect(runPromise).rejects.toThrow(DebugSessionTerminatedError)
    })

    it('should not throw error when debug session terminates after run completes', async () => {
        // Create a test case test item
        const testData = createTestItem(['workspace', 'config', 'spec.js', 'MyTest'].join(TEST_ID_SEPARATOR), {
            isTestcase: true,
            repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
        })

        // Run test and wait for it to complete
        const runPromise = debugRunner.run(testData.testItem, testData.metadata)

        // Now that run has completed, simulate debug session termination
        if (terminationCallback) {
            terminationCallback()
        }

        expect(async () => await runPromise).not.toThrow()
    })

    it('should dispose properly', async () => {
        // Call dispose
        await debugRunner.dispose()

        // Assert worker stop was called
        expect(mockWorker.stop).toHaveBeenCalled()
    })
})

describe('WdioExtensionDebugWorker', () => {
    let workspaceFolder: vscode.WorkspaceFolder
    let mockToken: vscode.CancellationToken
    let debugWorker: WdioExtensionDebugWorker
    let mockDebugSession: vscode.DebugSession
    let terminationCallback: (() => void) | null = null

    // Mock VSCode debug API
    beforeEach(() => {
        vi.clearAllMocks()

        // Setup mocks
        workspaceFolder = {
            uri: { fsPath: '/workspace' } as vscode.Uri,
            name: 'Test Workspace',
            index: 0,
        }

        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn().mockImplementation(() => {
                return { dispose: vi.fn() }
            }),
        }

        mockDebugSession = {
            id: 'debug-session-id',
            type: 'node',
            name: 'Debug Tests',
            configuration: {
                __name: 'wdio-debugger',
            },
        } as unknown as vscode.DebugSession

        // Mock VSCode debug API
        vi.mocked(vscode.debug.startDebugging).mockResolvedValue(true)
        vi.mocked(vscode.debug.stopDebugging).mockResolvedValue(undefined)
        vi.mocked(vscode.debug.onDidStartDebugSession).mockImplementation((callback) => {
            // Simulate debug session start
            setTimeout(() => callback(mockDebugSession), 10)
            return { dispose: vi.fn() }
        })
        vi.mocked(vscode.debug.onDidTerminateDebugSession).mockImplementation((callback) => {
            // Store the callback for later use in tests
            const wrappedCallback = (session: vscode.DebugSession) => {
                callback(session)
                // After original callback, if we have a termination callback set, call it
                if (terminationCallback) {
                    terminationCallback()
                }
            }

            return {
                dispose: vi.fn(),
                // Expose the callback for tests to call it
                callback: wrappedCallback,
            }
        })

        vi.spyOn(workerModule.WdioExtensionWorker.prototype as any, 'getServer').mockResolvedValue(
            'ws://localhost:1234'
        )
        vi.spyOn(workerModule.WdioExtensionWorker.prototype, 'waitForStart').mockResolvedValue(undefined)
        vi.spyOn(workerModule.WdioExtensionWorker.prototype, 'stop').mockResolvedValue(undefined)

        // Create worker instance
        debugWorker = new WdioExtensionDebugWorker(
            mockConfigManager,
            '#DEBUGGER1',
            '/path/to',
            workspaceFolder,
            mockToken
        )

        // Mock getServer method
        vi.spyOn(debugWorker as any, 'getServer').mockResolvedValue('ws://localhost:1234')
    })

    afterEach(() => {
        vi.restoreAllMocks()
        terminationCallback = null
    })

    it('should start debug session correctly', async () => {
        // Call start
        await debugWorker.start()

        // Assert startDebugging was called with correct parameters
        expect(vscode.debug.startDebugging).toHaveBeenCalledWith(
            workspaceFolder,
            expect.objectContaining({
                __name: 'wdio-debugger',
                name: 'Debug Tests',
                type: 'node',
                request: 'launch',
                cwd: '/path/to',
                autoAttachChildProcesses: true,
                env: expect.objectContaining({
                    WDIO_EXTENSION_WORKER_CID: '#DEBUGGER1',
                    WDIO_EXTENSION_WORKER_WS_URL: 'ws://localhost:1234',
                    FORCE_COLOR: '1',
                }),
            })
        )
    })

    it('should call debug termination callback when debug session terminates', async () => {
        // Setup termination callback
        const mockCallback = vi.fn()
        debugWorker.setDebugTerminationCallback(mockCallback)

        // Trigger debug session termination
        let terminateCallback: (session: vscode.DebugSession) => void
        vi.mocked(vscode.debug.onDidTerminateDebugSession).mockImplementation((callback) => {
            terminateCallback = callback
            return { dispose: vi.fn() }
        })

        // Call start
        await debugWorker.start()

        // Simulate session termination with the correct session
        terminateCallback!(mockDebugSession)

        // Assert debug termination callback was called
        expect(mockCallback).toHaveBeenCalled()
    })

    it('should setup cancellation token handler', async () => {
        // Call start
        await debugWorker.start()

        // Wait for onDidStartDebugSession callback to complete
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Assert onCancellationRequested was called
        expect(mockToken.onCancellationRequested).toHaveBeenCalled()
    })

    it('should stop debugging session on stop', async () => {
        // Call start
        await debugWorker.start()

        // Wait for onDidStartDebugSession callback to complete
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Call stop
        await debugWorker.stop()

        // Assert stopDebugging was called
        expect(vscode.debug.stopDebugging).toHaveBeenCalled()
    })

    it('should wait for start correctly', async () => {
        // Mock super.waitForStart
        const superWaitForStartSpy = vi
            .spyOn(Object.getPrototypeOf(WdioExtensionDebugWorker.prototype), 'waitForStart')
            .mockResolvedValue(undefined)

        // Start the worker
        await debugWorker.start()

        // Call waitForStart
        await debugWorker.waitForStart()

        // Assert super.waitForStart was called
        expect(superWaitForStartSpy).toHaveBeenCalled()
    })

    it('should handle cancellation during debug session start', async () => {
        // Set token to be cancelled
        mockToken.isCancellationRequested = true

        // Call start
        await debugWorker.start()

        // Wait for onDidStartDebugSession callback to complete
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Assert stopDebugging was called because token was cancelled
        expect(vscode.debug.stopDebugging).toHaveBeenCalledWith(mockDebugSession)
    })

    it('should handle cancellation after debug session start', async () => {
        // Start with token not cancelled
        mockToken.isCancellationRequested = false

        // Setup token to trigger cancellation callback
        const cancelCallback = vi.fn()
        mockToken.onCancellationRequested = vi.fn().mockImplementation((callback) => {
            cancelCallback.mockImplementation(callback)
            return { dispose: vi.fn() }
        })

        // Call start
        await debugWorker.start()

        // Wait for onDidStartDebugSession callback to complete
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Simulate cancellation
        await cancelCallback()

        // Assert stopDebugging was called after cancellation
        expect(vscode.debug.stopDebugging).toHaveBeenCalled()
    })

    it('should clean up on debug session termination', async () => {
        // Mock disposables
        const mockDisposable = { dispose: vi.fn() }
        ;(debugWorker as any).disposables = [mockDisposable]

        // Setup termination callback
        let terminateCallback: (session: vscode.DebugSession) => void
        vi.mocked(vscode.debug.onDidTerminateDebugSession).mockImplementation((callback) => {
            terminateCallback = callback
            return { dispose: vi.fn() }
        })

        // Call start
        await debugWorker.start()

        // Simulate session termination
        terminateCallback!(mockDebugSession)

        // Assert disposable.dispose was called
        expect(mockDisposable.dispose).toHaveBeenCalled()
    })

    it('should handle error in debug session startup', async () => {
        // Mock onDidStartDebugSession to throw an error in the callback
        vi.mocked(vscode.debug.onDidStartDebugSession).mockImplementation((callback) => {
            setTimeout(() => {
                try {
                    callback(mockDebugSession)
                    // Simulate an error
                    throw new Error('[birpc] rpc is closed')
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (_err) {
                    // This should be caught internally by the worker
                }
            }, 10)
            return { dispose: vi.fn() }
        })

        // Call start
        await debugWorker.start()

        // Call waitForStart - this should resolve despite the error
        await expect(debugWorker.waitForStart()).resolves.not.toThrow()
    })

    it('should handle other errors in debug session startup', async () => {
        // Mock onDidStartDebugSession to throw a different error
        vi.mocked(vscode.debug.startDebugging).mockRejectedValue(new Error('Some other error'))

        // Call start
        await debugWorker.start()

        // Call waitForStart - this should reject
        await expect(debugWorker.waitForStart()).rejects.toThrow('Failed to start debugging')
    })
})
