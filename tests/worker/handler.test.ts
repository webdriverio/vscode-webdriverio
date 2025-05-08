import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getLauncherInstance } from '../../src/worker/cli.js'
import { createWorker } from '../../src/worker/handler.js'
import * as parsers from '../../src/worker/parsers/index.js'
import * as test from '../../src/worker/test.js'

import type { WebSocket } from 'ws'
import type { LoadConfigOptions, WorkerApi } from '../../src/api/index.js'
import type { WorkerMetaContext } from '../../src/worker/types.js'

// Mock dependencies
vi.mock('../../src/worker/parsers/index.js')
vi.mock('../../src/worker/test.js')
vi.mock('../../src/worker/cli.js', () => {
    const getLauncherInstance = vi.fn(() =>
        Promise.resolve({
            initialize: vi.fn(),
            getProperty: vi.fn(() => ({
                getSpecs: vi.fn(() => ['spec1.js', ['spec2.js', 'spec3.js']]),
                getConfig: vi.fn(() => {
                    return { framework: 'mocha' }
                }),
            })),
        })
    )
    return { getLauncherInstance }
})

describe('handler', () => {
    // Mock context
    const mockContext: WorkerMetaContext = {
        log: {
            info: vi.fn(),
            debug: vi.fn(),
            trace: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
        },
        ws: {
            close: vi.fn(),
        } as unknown as WebSocket,
        shutdownRequested: false,
        pendingCalls: [],
    }

    // Mock the process.exit
    const originalExit = process.exit
    const mockExit = vi.fn()

    // Mock setTimeout
    const originalSetTimeout = global.setTimeout
    let timeoutCallbacks: Array<{ callback: Function; ms: number }> = []
    const mockSetTimeout = vi.fn((callback: Function, ms: number) => {
        timeoutCallbacks.push({ callback, ms })
        return 123 // Mock timer ID
    })

    // Save and mock console.error
    const originalConsoleError = console.error
    const mockConsoleError = vi.fn()

    // Create worker API
    let workerApi: WorkerApi

    beforeEach(() => {
        // Reset all mocks
        vi.resetAllMocks()
        timeoutCallbacks = []

        // Setup process.exit mock
        process.exit = mockExit as any

        // Setup setTimeout mock
        globalThis.setTimeout = mockSetTimeout as any

        // Setup console.error mock
        console.error = mockConsoleError

        // Reset context state
        mockContext.shutdownRequested = false
        mockContext.pendingCalls = []

        // Create worker instance for each test
        workerApi = createWorker(mockContext)

        // Setup mocks for bound functions
        vi.mocked(parsers.parse).mockResolvedValue([] as any)
        vi.mocked(test.runTest).mockResolvedValue({} as any)
    })

    afterEach(() => {
        // Restore original implementations
        process.exit = originalExit
        global.setTimeout = originalSetTimeout
        console.error = originalConsoleError
    })

    it('should return an object with all required API methods', () => {
        // Assert that the worker API has all required methods
        expect(workerApi).toHaveProperty('runTest')
        expect(workerApi).toHaveProperty('loadWdioConfig')
        expect(workerApi).toHaveProperty('readSpecs')
        expect(workerApi).toHaveProperty('ping')
        expect(workerApi).toHaveProperty('shutdown')
    })

    it('should bind runTest to the provided context', async () => {
        // Act
        await workerApi.runTest({} as any)

        // Assert
        expect(test.runTest).toHaveBeenCalled()
    })

    it('should bind readSpecs to the provided context', async () => {
        // Act
        await workerApi.readSpecs({} as any)

        // Assert
        expect(parsers.parse).toHaveBeenCalled()
    })

    it('should return "pong" for ping method', async () => {
        // Act
        const result = await workerApi.ping()

        // Assert
        expect(result).toBe('pong')
    })

    it('should log info and set shutdownRequested flag during shutdown', async () => {
        // Act
        await workerApi.shutdown()

        // Assert
        expect(mockContext.log.info).toHaveBeenCalledWith('Shutting down worker process')
        expect(mockContext.log.info).toHaveBeenCalledWith('Worker received shutdown request')
        expect(mockContext.shutdownRequested).toBe(true)
    })

    it('should close WebSocket connection during shutdown', async () => {
        // Act
        await workerApi.shutdown()

        // Assert
        expect(mockContext.ws.close).toHaveBeenCalled()
    })

    it('should set a safety timeout during shutdown', async () => {
        // Act
        await workerApi.shutdown()

        // Assert
        expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2000)

        // Verify the safety timeout callback will exit with code 0
        const safetyCallback = timeoutCallbacks.find((tc) => tc.ms === 2000)?.callback
        if (safetyCallback) {
            safetyCallback()
            expect(mockExit).toHaveBeenCalledWith(0)
        } else {
            throw new Error('Safety timeout callback not found')
        }
    })

    it('should handle errors during shutdown', async () => {
        // Arrange - Make ws.close throw an error
        mockContext.ws.close = vi.fn().mockImplementation(() => {
            throw new Error('WebSocket close error')
        })

        // Act
        await workerApi.shutdown()

        // Assert
        expect(mockConsoleError).toHaveBeenCalledWith('Error during shutdown:', expect.any(Error))
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    describe('loadWdioConfig', () => {
        // Create a mock context
        const mockContext: WorkerMetaContext = {
            log: {
                debug: vi.fn(),
                info: vi.fn(),
                trace: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
            },
            ws: {
                close: vi.fn(),
            } as unknown as WebSocket,
            shutdownRequested: false,
            pendingCalls: [],
        }

        const mockOptions: LoadConfigOptions = {
            configFilePath: '/path/to/wdio.conf.js',
        }

        it('should load WebdriverIO config and return framework and specs', async () => {
            // Arrange
            const mockInitialize = vi.fn()
            vi.mocked(getLauncherInstance).mockResolvedValue({
                initialize: mockInitialize,
                getProperty: vi.fn(() => ({
                    getSpecs: vi.fn(() => ['spec1.js', ['spec2.js', 'spec3.js']]),
                    getConfig: vi.fn(() => {
                        return { framework: 'mocha' }
                    }),
                })),
            } as any)
            // Act
            const result = await workerApi.loadWdioConfig.call(mockContext, mockOptions)

            // Assert
            expect(result).toEqual({
                framework: 'mocha',
                specs: ['spec1.js', 'spec2.js', 'spec3.js'],
            })
            expect(getLauncherInstance).toHaveBeenCalled()
            expect(mockInitialize).toHaveBeenCalled()
        })
    })
})
