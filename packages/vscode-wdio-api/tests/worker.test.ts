import * as childProcess from 'node:child_process'
import { EventEmitter } from 'node:events'
import * as http from 'node:http'

import { createBirpc } from 'birpc'
import getPort from 'get-port'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createWss } from '../src/utils.js'
import { WdioExtensionWorker } from '../src/worker.js'
import type { ExtensionApi } from '@vscode-wdio/types/api'
import type { ExtensionConfigManagerInterface } from '@vscode-wdio/types/config'
import type * as WebSocket from 'ws'

// Mock dependencies
vi.mock('node:child_process')
vi.mock('node:http')
vi.mock('ws', () => {
    const WebSocketServer = EventEmitter
    return { WebSocketServer }
})
vi.mock('birpc', () => {
    return {
        createBirpc: vi.fn(),
    }
})
vi.mock('get-port')

vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))

vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('../src/utils.js', () => {
    return {
        loggingFn: vi.fn(),
        createWss: vi.fn(),
        resolveNodePath: vi.fn(async () => '/path/to/node'),
    }
})

describe('WdioExtensionWorker', () => {
    let worker: WdioExtensionWorker
    let mockChildProcess: any
    let mockStdout: EventEmitter
    let mockStderr: EventEmitter
    let mockServer: any
    let mockWss: WebSocket.WebSocketServer
    let mockWs: any
    let mockBirpc: any

    beforeEach(() => {
        // Reset mocks
        vi.resetAllMocks()

        // Setup childProcess mock
        mockStdout = new EventEmitter()
        mockStderr = new EventEmitter()
        mockChildProcess = {
            stdout: mockStdout,
            stderr: mockStderr,
            on: vi.fn(),
            kill: vi.fn(),
            exitCode: null,
            killed: false,
        }
        vi.mocked(childProcess.spawn).mockReturnValue(mockChildProcess as any)

        // Setup HTTP server mock
        mockServer = {
            listen: vi.fn().mockReturnThis(),
            unref: vi.fn(),
            close: vi.fn().mockImplementation((cb) => cb && cb(null)),
        }
        vi.mocked(http.createServer).mockReturnValue(mockServer as any)

        // Setup WebSocketServer mock
        mockWs = new EventEmitter()
        mockWs.send = vi.fn()
        mockWs.close = vi.fn()

        mockWss = new EventEmitter() as WebSocket.WebSocketServer
        mockWss.close = vi.fn().mockImplementation((cb) => cb && cb(null))
        // vi.mocked(WebSocket.WebSocketServer).mockReturnValue(mockWss as any)

        // Setup getPort mock
        vi.mocked(getPort).mockResolvedValue(12345)

        // Setup birpc mock
        mockBirpc = {
            ping: vi.fn().mockResolvedValue('pong'),
            shutdown: vi.fn().mockResolvedValue(undefined),
        }
        vi.mocked(createBirpc).mockReturnValue(mockBirpc)

        // Create worker instance
        worker = new WdioExtensionWorker(
            { globalConfig: { workerIdleTimeout: 600 } } as unknown as ExtensionConfigManagerInterface,
            '#1',
            '/test/path'
        )
    })

    afterEach(() => {
        for (const disposable of (worker as any).disposables) {
            disposable.dispose()
        }
        vi.clearAllMocks()
    })

    describe('start', () => {
        it('should start the worker process and setup WebSocket server', async () => {
            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            // Check if port is obtained
            expect(getPort).toHaveBeenCalled()

            // Check if HTTP server is created and started
            expect(http.createServer).toHaveBeenCalled()
            expect(mockServer.listen).toHaveBeenCalledWith(12345)
            expect(mockServer.unref).toHaveBeenCalled()

            // Check if WebSocket server is created
            expect(createWss).toHaveBeenCalledWith(mockServer)

            // Check if worker process is spawned with correct arguments
            expect(childProcess.spawn).toHaveBeenCalledWith(
                '/path/to/node',
                expect.any(Array),
                expect.objectContaining({
                    cwd: '/test/path',
                    env: expect.objectContaining({
                        WDIO_EXTENSION_WORKER_CID: '#1',
                        WDIO_EXTENSION_WORKER_WS_URL: 'ws://localhost:12345',
                        FORCE_COLOR: '1',
                    }),
                    stdio: 'pipe',
                })
            )

            // Verify listeners are set
            expect(mockChildProcess.on).toHaveBeenCalledWith('exit', expect.any(Function))
        })

        it('should not start if worker is already running', async () => {
            // Set worker process to simulate already running state
            ;(worker as any)._workerProcess = {}

            await worker.start()

            // Verify that spawn wasn't called
            expect(childProcess.spawn).not.toHaveBeenCalled()
        })

        it('should handle errors during startup', async () => {
            // Force getPort to fail
            vi.mocked(getPort).mockRejectedValue(new Error('Port error'))

            await expect(worker.start()).rejects.toThrow('Port error')
        })
    })

    describe('waitForStart', () => {
        it('should connect to worker and setup RPC communication', async () => {
            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            const connectPromise = worker.waitForStart()

            // Simulate WebSocket connection
            mockWss.emit('connection', mockWs)

            await connectPromise

            // Verify birpc was created
            expect(createBirpc).toHaveBeenCalled()
            expect((worker as any)._workerConnected).toBe(true)
            expect((worker as any)._workerRpc).toBe(mockBirpc)

            // Verify birpc arguments
            const server = vi.mocked(createBirpc).mock.calls[0][0] as ExtensionApi
            expect(server).toHaveProperty('log')
            expect(typeof server.log).toBe('function')
        })

        it('should handle connection timeout', async () => {
            vi.useFakeTimers()
            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            const connectPromise = worker.waitForStart()

            // Advance timer to trigger timeout
            vi.advanceTimersByTime(11000)

            await expect(connectPromise).rejects.toThrow('Worker connection timeout')

            vi.useRealTimers()
        })

        it('should handle WebSocket errors', async () => {
            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            const connectPromise = worker.waitForStart()
            const spyStop = vi.spyOn(worker, 'stop')

            // Simulate WebSocket connection
            mockWss.emit('connection', mockWs)
            await connectPromise

            // Simulate error event
            mockWs.emit('error', new Error('WebSocket error'))

            expect(spyStop).toHaveBeenCalled()
        })

        it('should handle WebSocket close event', async () => {
            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            const connectPromise = worker.waitForStart()

            // Simulate WebSocket connection
            mockWss.emit('connection', mockWs)

            await connectPromise

            // Verify initial state
            expect((worker as any)._workerConnected).toBe(true)

            // Simulate close event
            mockWs.emit('close')

            // Verify state after close
            expect((worker as any)._workerConnected).toBe(false)
            expect((worker as any)._workerRpc).toBe(null)
        })
    })

    describe('stop', () => {
        it('should gracefully shutdown worker via RPC when connected', async () => {
            // Setup worker state
            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            const connectPromise = worker.waitForStart()
            mockWss.emit('connection', mockWs)
            await connectPromise

            // shutdown
            await worker.stop()

            // Verify shutdown was called
            expect(mockBirpc.shutdown).toHaveBeenCalled()

            // Verify WebSocket server and HTTP server were closed
            expect(mockWss.close).toHaveBeenCalled()
            expect(mockServer.close).toHaveBeenCalled()

            // Verify worker state was reset
            expect((worker as any)._workerProcess).toBe(null)
            expect((worker as any)._workerRpc).toBe(null)
            expect((worker as any)._workerConnected).toBe(false)
        })

        it('should force kill worker process when RPC shutdown fails', async () => {
            // Setup worker state
            vi.mocked(createBirpc).mockReturnValue({
                shutdown: vi.fn().mockRejectedValue(new Error('Shutdown failed')),
            } as any)

            vi.mocked(createWss).mockReturnValueOnce(mockWss)
            await worker.start()
            const connectPromise = worker.waitForStart()
            mockWss.emit('connection', mockWs)
            await connectPromise

            vi.useFakeTimers()
            const stopping = worker.stop()
            vi.advanceTimersByTime(1100)
            await stopping
            vi.useRealTimers()

            // Verify kill was called with SIGTERM first
            expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM')

            // Set up conditions for SIGKILL
            mockChildProcess.exitCode = null
            mockChildProcess.killed = false

            // Now SIGKILL should be called
            expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL')
        })

        it('should handle errors when closing servers', async () => {
            // Setup worker state with servers that error on close
            const errorServer = {
                close: vi.fn().mockImplementation((cb) => cb && cb(new Error('Server close error'))),
            }
            const errorWss = {
                close: vi.fn().mockImplementation((cb) => cb && cb(new Error('WSS close error'))),
            }

            ;(worker as any)._workerRpc = null
            ;(worker as any)._workerConnected = false
            ;(worker as any)._workerProcess = null
            ;(worker as any)._wss = errorWss
            ;(worker as any)._server = errorServer

            await worker.stop()

            // Verify close was called despite errors
            expect(errorWss.close).toHaveBeenCalled()
            expect(errorServer.close).toHaveBeenCalled()
        })
    })

    describe('workerOutHandler', () => {
        it('should emit stdout event with payload', () => {
            const emitSpy = vi.spyOn(worker, 'emit')

            // Call the handler
            ;(worker as any).workerOutHandler('stdout', Buffer.from('test message'))

            // Verify emit was called with correct arguments
            expect(emitSpy).toHaveBeenCalledWith('stdout', 'test message')
        })

        it('should emit stderr event with payload', () => {
            const emitSpy = vi.spyOn(worker, 'emit')

            // Call the handler
            ;(worker as any).workerOutHandler('stderr', Buffer.from('error message'))

            // Verify emit was called with correct arguments
            expect(emitSpy).toHaveBeenCalledWith('stderr', 'error message')
        })
    })

    describe('setListeners', () => {
        it('should set event listeners on child process', () => {
            const workerOutSpy = vi.spyOn(worker as any, 'workerOutHandler')

            // Call the method
            ;(worker as any).setListeners(mockChildProcess)

            // Simulate stdout and stderr events
            mockStdout.emit('data', 'stdout data')
            mockStderr.emit('data', 'stderr data')

            // Verify workerOutHandler was called
            expect(workerOutSpy).toHaveBeenCalledWith('stdout', 'stdout data')
            expect(workerOutSpy).toHaveBeenCalledWith('stderr', 'stderr data')

            // Simulate exit event
            mockChildProcess.on.mock.calls.find((call: string[]) => call[0] === 'exit')[1](0)

            // Verify worker state was reset
            expect((worker as any)._workerProcess).toBe(null)
            expect((worker as any)._workerRpc).toBe(null)
            expect((worker as any)._workerConnected).toBe(false)
        })
    })

    describe('ensureConnected', () => {
        it('should restart worker if not connected', async () => {
            // Setup worker state
            ;(worker as any)._workerConnected = false

            const stopSpy = vi.spyOn(worker, 'stop').mockResolvedValue()
            const startSpy = vi.spyOn(worker, 'start').mockResolvedValue()

            await worker.ensureConnected()

            // Verify stop and start were called
            expect(stopSpy).toHaveBeenCalled()
            expect(startSpy).toHaveBeenCalled()
        })

        it('should do nothing if already connected', async () => {
            // Setup worker state
            ;(worker as any)._workerConnected = true

            const stopSpy = vi.spyOn(worker, 'stop').mockResolvedValue()
            const startSpy = vi.spyOn(worker, 'start').mockResolvedValue()

            await worker.ensureConnected()

            // Verify stop and start were not called
            expect(stopSpy).not.toHaveBeenCalled()
            expect(startSpy).not.toHaveBeenCalled()
        })
    })

    describe('rpc', () => {
        it('should return RPC interface when connected', () => {
            // Setup worker state
            ;(worker as any)._workerRpc = mockBirpc
            ;(worker as any)._workerConnected = true

            // Verify RPC is returned
            expect(worker.rpc.loadWdioConfig).toBe(mockBirpc.loadWdioConfig)
        })

        it('should throw error when not connected', () => {
            // Setup worker state
            ;(worker as any)._workerRpc = mockBirpc
            ;(worker as any)._workerConnected = false

            // Verify error is thrown
            expect(() => worker.rpc).toThrow('Worker not connected')
        })

        it('should throw error when RPC is null', () => {
            // Setup worker state
            ;(worker as any)._workerRpc = null
            ;(worker as any)._workerConnected = true

            // Verify error is thrown
            expect(() => worker.rpc).toThrow('Worker not connected')
        })
    })

    describe('isConnected', () => {
        it('should return true when connected', () => {
            // Setup worker state
            ;(worker as any)._workerConnected = true

            // Verify isConnected returns true
            expect(worker.isConnected()).toBe(true)
        })

        it('should return false when not connected', () => {
            // Setup worker state
            ;(worker as any)._workerConnected = false

            // Verify isConnected returns false
            expect(worker.isConnected()).toBe(false)
        })
    })

    describe('startHealthCheck', () => {
        it('should start interval for health check', () => {
            vi.useFakeTimers()

            // Setup worker state
            ;(worker as any)._workerRpc = mockBirpc
            ;(worker as any)._workerConnected = true

            // Call the method
            ;(worker as any).startHealthCheck()

            // Check if an interval was created (by checking disposables)
            expect((worker as any).disposables.length).toBeGreaterThanOrEqual(1)

            // Fast forward time to trigger interval
            vi.advanceTimersByTime(60000)

            // Verify ping was called
            expect(mockBirpc.ping).toHaveBeenCalled()

            vi.useRealTimers()
        })

        it('should handle health check failure and reconnect', async () => {
            vi.useFakeTimers()

            // Setup worker state
            ;(worker as any)._workerRpc = {
                ping: vi.fn().mockRejectedValue(new Error('Ping failed')),
            }
            ;(worker as any)._workerConnected = true

            const ensureConnectedSpy = vi.spyOn(worker, 'ensureConnected').mockResolvedValue()

            // Call the method
            ;(worker as any).startHealthCheck()

            // Fast forward time to trigger interval
            vi.advanceTimersByTime(60000)

            // Need to await pending promises
            await Promise.resolve()

            // Verify ensureConnected was called
            expect(ensureConnectedSpy).toHaveBeenCalled()

            vi.useRealTimers()
        })

        it('should handle unexpected ping response', async () => {
            vi.useFakeTimers()

            // Setup worker state
            ;(worker as any)._workerRpc = {
                ping: vi.fn().mockResolvedValue('not pong'),
            }
            ;(worker as any)._workerConnected = true

            const ensureConnectedSpy = vi.spyOn(worker, 'ensureConnected').mockResolvedValue()

            // Call the method
            ;(worker as any).startHealthCheck()

            // Fast forward time to trigger interval
            vi.advanceTimersByTime(60000)

            // Need to await pending promises
            await Promise.resolve()

            // Verify ensureConnected was called
            expect(ensureConnectedSpy).toHaveBeenCalled()

            vi.useRealTimers()
        })

        it('should skip health check when not connected', () => {
            vi.useFakeTimers()

            // Setup worker state
            ;(worker as any)._workerConnected = false

            // Call the method
            ;(worker as any).startHealthCheck()

            // Fast forward time to trigger interval
            vi.advanceTimersByTime(60000)

            // Verify ping was not called because worker is not connected
            expect(mockBirpc.ping).not.toHaveBeenCalled()

            vi.useRealTimers()
        })
    })
})
