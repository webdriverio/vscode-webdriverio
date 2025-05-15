import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createRpcClient } from '../src/client.js'
import { startWorker } from '../src/index.js'
import type { ExtensionApi } from '@vscode-wdio/types/api'
import type { LoggerInterface } from '@vscode-wdio/types/utils'
import type { WebSocket } from 'ws'

// Mock the modules
vi.mock('../src/client.js', () => {
    return {
        createRpcClient: vi.fn(),
    }
})

// Create a backup of the original process
const originalProcess = process

describe('worker/index', () => {
    // Setup mocks for process environment and event handlers
    const mockExit = vi.fn()
    const mockOn = vi.fn()
    const mockConsoleError = vi.fn()

    // Mock for WebSocket
    const mockWs = {
        close: vi.fn(),
    }

    // Mock for Logger
    const mockLog = {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    }

    beforeEach(() => {
        // Reset all mocks
        vi.resetAllMocks()

        // Setup process mocks
        globalThis.process = {
            ...originalProcess,
            exit: mockExit as any,
            on: mockOn,
            env: { ...originalProcess.env },
        }

        // Setup console.error mock
        globalThis.console.error = mockConsoleError

        // Setup createRpcClient mock
        vi.mocked(createRpcClient).mockReturnValue({
            ws: mockWs as unknown as WebSocket,
            client: vi.fn() as unknown as ExtensionApi,
            log: mockLog as unknown as LoggerInterface,
        })
    })

    afterEach(() => {
        // Restore original process
        global.process = originalProcess

        // Restore console
        vi.restoreAllMocks()
    })

    it('should exit with error if WS URL is not provided', async () => {
        // Arrange
        delete process.env.WDIO_EXTENSION_WORKER_WS_URL

        // Act
        startWorker()

        // Assert
        expect(mockConsoleError).toHaveBeenCalledWith(
            'Server URL is not specified. Use WDIO_EXTENSION_WORKER_WS_URL environment variable.'
        )
        expect(mockExit).toHaveBeenCalledWith(1)
        expect(createRpcClient).not.toHaveBeenCalled()
    })

    it('should create RPC client with correct parameters when WS URL is provided', async () => {
        // Arrange
        const testCid = 'test-cid-123'
        const testWsUrl = 'ws://localhost:8080'
        process.env.WDIO_EXTENSION_WORKER_CID = testCid
        process.env.WDIO_EXTENSION_WORKER_WS_URL = testWsUrl

        // Act
        startWorker()

        // Assert
        expect(createRpcClient).toHaveBeenCalledWith(testCid, testWsUrl)
        expect(mockExit).not.toHaveBeenCalled()
    })

    it('should use empty string for CID if environment variable is not set', async () => {
        // Arrange
        const testWsUrl = 'ws://localhost:8080'
        delete process.env.WDIO_EXTENSION_WORKER_CID
        process.env.WDIO_EXTENSION_WORKER_WS_URL = testWsUrl

        // Act
        startWorker()

        // Assert
        expect(createRpcClient).toHaveBeenCalledWith('', testWsUrl)
    })

    it('should register handlers for SIGINT and SIGTERM signals', async () => {
        // Arrange
        process.env.WDIO_EXTENSION_WORKER_WS_URL = 'ws://localhost:8080'

        // Act
        startWorker()

        // Find the signal handlers by extracting the first argument of each call
        const eventTypes = vi.mocked(process.on).mock.calls.map((call) => call[0])

        // Assert
        expect(eventTypes).toContain('SIGINT')
        expect(eventTypes).toContain('SIGTERM')
    })

    it('should close WebSocket and exit on SIGINT', async () => {
        // Arrange
        process.env.WDIO_EXTENSION_WORKER_WS_URL = 'ws://localhost:8080'

        // Act
        startWorker()

        // Find and execute the SIGINT handler
        const sigintHandler = vi.mocked(process.on).mock.calls.find((call) => call[0] === 'SIGINT')?.[1]
        if (sigintHandler) {
            sigintHandler()
        }

        // Assert
        expect(mockLog.info).toHaveBeenCalledWith('Worker received SIGINT, shutting down')
        expect(mockWs.close).toHaveBeenCalled()
        expect(mockExit).toHaveBeenCalledWith(0)
    })

    it('should close WebSocket and exit on SIGTERM', async () => {
        // Arrange
        process.env.WDIO_EXTENSION_WORKER_WS_URL = 'ws://localhost:8080'

        // Act
        startWorker()

        // Find and execute the SIGTERM handler
        const sigtermHandler = vi.mocked(process.on).mock.calls.find((call) => call[0] === 'SIGTERM')?.[1]
        if (sigtermHandler) {
            sigtermHandler()
        }

        // Assert
        expect(mockLog.info).toHaveBeenCalledWith('Worker received SIGTERM, shutting down')
        expect(mockWs.close).toHaveBeenCalled()
        expect(mockExit).toHaveBeenCalledWith(0)
    })
})
