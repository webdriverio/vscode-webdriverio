import v8 from 'node:v8'

import { createBirpc } from 'birpc'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocket } from 'ws'

import { LOG_LEVEL } from '../../src/constants.js'
import { createRpcClient } from '../../src/worker/client.js'
import * as handler from '../../src/worker/handler.js'
import * as logger from '../../src/worker/logger.js'

// Mock dependencies
vi.mock('ws')
vi.mock('birpc')
vi.mock('node:v8')
vi.mock('../../src/worker/handler.js')
vi.mock('../../src/worker/logger.js')

describe('client', () => {
    // Mock WebSocket
    const mockWebSocket = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
    }

    // Mock Logger
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        trace: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    }

    // Mock Worker
    const mockWorker = {
        runTest: vi.fn(),
        loadWdioConfig: vi.fn(),
        readSpecs: vi.fn(),
        ping: vi.fn().mockResolvedValue('pong'),
        shutdown: vi.fn(),
    }

    // Mock process
    const originalProcess = process
    const mockProcess = {
        ...process,
        pid: 12345,
        exit: vi.fn(),
    }

    beforeEach(() => {
        // Reset all mocks
        vi.resetAllMocks()

        // Setup WebSocket mock
        vi.mocked(WebSocket).mockImplementation(() => mockWebSocket as any)

        // Setup createWorker mock
        vi.mocked(handler.createWorker).mockReturnValue(mockWorker)

        // Setup getLogger mock
        vi.mocked(logger.getLogger).mockReturnValue(mockLogger)

        // Setup createBirpc mock
        vi.mocked(createBirpc).mockReturnValue({} as any)

        // Setup v8 mock
        vi.mocked(v8.serialize).mockImplementation((data) => Buffer.from(JSON.stringify(data)))
        vi.mocked(v8.deserialize).mockImplementation((buffer) => JSON.parse(buffer.toString()))

        // Setup process mock
        vi.stubGlobal('process', mockProcess)
    })

    afterEach(() => {
        // Restore original process
        global.process = originalProcess
        vi.restoreAllMocks()
    })

    it('should create WebSocket connection with correct URL', () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Act
        createRpcClient(cid, wsUrl)

        // Assert
        expect(WebSocket).toHaveBeenCalledWith(wsUrl)
    })

    it('should initialize logger with client', () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Act
        const { log } = createRpcClient(cid, wsUrl)

        // Assert
        expect(logger.getLogger).toHaveBeenCalled()
        expect(log).toBe(mockLogger)
    })

    it('should log debug messages on initialization', () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Act
        createRpcClient(cid, wsUrl)

        // Assert
        expect(mockLogger.debug).toHaveBeenCalledWith(`Starting WebdriverIO worker (PID: ${mockProcess.pid})`)
        expect(mockLogger.debug).toHaveBeenCalledWith(`Connecting the extension server: ${wsUrl}`)
    })

    it('should register WebSocket event handlers', () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Act
        createRpcClient(cid, wsUrl)

        // Assert
        expect(mockWebSocket.on).toHaveBeenCalledWith('open', expect.any(Function))
        expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should create worker and initialize birpc on WebSocket open', () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Act
        createRpcClient(cid, wsUrl)

        // Extract and call the 'open' event handler
        const openHandler = vi.mocked(mockWebSocket.on).mock.calls.find((call) => call[0] === 'open')?.[1]
        if (openHandler) {
            openHandler()
        }

        // Assert
        expect(handler.createWorker).toHaveBeenCalledWith(
            expect.objectContaining({
                log: mockLogger,
                ws: mockWebSocket,
                shutdownRequested: false,
                pendingCalls: expect.any(Array),
            })
        )

        expect(createBirpc).toHaveBeenCalledWith(
            mockWorker,
            expect.objectContaining({
                post: expect.any(Function),
                on: expect.any(Function),
                serialize: v8.serialize,
                deserialize: expect.any(Function),
            })
        )
    })

    it('should execute pending calls when connection is established', async () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'
        const mockRpc = {
            log: vi.fn().mockResolvedValue(undefined),
        }

        // Setup birpc mock to return our mock rpc
        vi.mocked(createBirpc).mockReturnValue(mockRpc as any)

        // Act
        const { client } = createRpcClient(cid, wsUrl)

        // Create a pending call by calling log before connection is established
        const logPromise = client.log(LOG_LEVEL.INFO, 'Test message')

        // Extract and call the 'open' event handler to establish connection
        const openHandler = vi.mocked(mockWebSocket.on).mock.calls.find((call) => call[0] === 'open')?.[1]
        if (openHandler) {
            openHandler()
        }

        // Wait for the log promise to resolve
        await logPromise

        // Assert
        expect(mockRpc.log).toHaveBeenCalledWith(LOG_LEVEL.INFO, '[WORKER test-client-123] Test message')
    })

    it('should format log messages with client ID if provided', async () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'
        const mockRpc = {
            log: vi.fn().mockResolvedValue(undefined),
        }

        // Setup birpc mock to return our mock rpc
        vi.mocked(createBirpc).mockReturnValue(mockRpc as any)

        // Act
        const { client } = createRpcClient(cid, wsUrl)

        // Extract and call the 'open' event handler to establish connection
        const openHandler = vi.mocked(mockWebSocket.on).mock.calls.find((call) => call[0] === 'open')?.[1]
        if (openHandler) {
            openHandler()
        }

        // Call log with established connection
        await client.log(LOG_LEVEL.INFO, 'Test message')

        // Assert
        expect(mockRpc.log).toHaveBeenCalledWith(LOG_LEVEL.INFO, '[WORKER test-client-123] Test message')
    })

    it('should format log messages without client ID if not provided', async () => {
        // Arrange
        const cid = ''
        const wsUrl = 'ws://localhost:8080'
        const mockRpc = {
            log: vi.fn().mockResolvedValue(undefined),
        }

        // Setup birpc mock to return our mock rpc
        vi.mocked(createBirpc).mockReturnValue(mockRpc as any)

        // Act
        const { client } = createRpcClient(cid, wsUrl)

        // Extract and call the 'open' event handler to establish connection
        const openHandler = vi.mocked(mockWebSocket.on).mock.calls.find((call) => call[0] === 'open')?.[1]
        if (openHandler) {
            openHandler()
        }

        // Call log with established connection
        await client.log(LOG_LEVEL.INFO, 'Test message')

        // Assert
        expect(mockRpc.log).toHaveBeenCalledWith(LOG_LEVEL.INFO, '[WORKER] Test message')
    })

    it('should not exit process after WebSocket close if shutdown was not requested', () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Act
        createRpcClient(cid, wsUrl)

        // Extract and call the 'close' event handler
        const closeHandler = vi.mocked(mockWebSocket.on).mock.calls.find((call) => call[0] === 'close')?.[1]
        if (closeHandler) {
            closeHandler()
        }

        // Assert
        expect(mockProcess.exit).not.toHaveBeenCalled()
    })

    it('should reject pending calls if RPC is not initialized', async () => {
        // Arrange
        const cid = 'test-client-123'
        const wsUrl = 'ws://localhost:8080'

        // Setup birpc mock to return null
        vi.mocked(createBirpc).mockReturnValue(null as any)

        // Act
        const { client } = createRpcClient(cid, wsUrl)

        // Create a pending call
        const logPromise = client.log(LOG_LEVEL.INFO, 'Test message')

        // Extract and call the 'open' event handler
        const openHandler = vi.mocked(mockWebSocket.on).mock.calls.find((call) => call[0] === 'open')?.[1]
        if (openHandler) {
            openHandler()
        }

        // Assert
        await expect(logPromise).rejects.toThrow('RPC not initialized')
    })
})
