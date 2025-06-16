import { spawn, type ChildProcess } from 'node:child_process'
import { createServer as createHttpServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import * as v8 from 'node:v8'

import { log } from '@vscode-wdio/logger'
import { TypedEventEmitter } from '@vscode-wdio/utils'
import { createBirpc } from 'birpc'
import getPort from 'get-port'

import { WorkerIdleMonitor } from './idleMonitor.js'
import { createWss, loggingFn, resolveNodePath } from './utils.js'

import type { IExtensionConfigManager } from '@vscode-wdio/types/config'
import type {
    ExtensionApi,
    WdioExtensionWorkerEvents,
    IWdioExtensionWorker,
    WorkerApi,
    IWorkerIdleMonitor,
} from '@vscode-wdio/types/server'
import type * as vscode from 'vscode'
import type { WebSocketServer } from 'ws'

const WORKER_PATH = resolve(__dirname, 'worker.cjs')

export class WdioExtensionWorker extends TypedEventEmitter<WdioExtensionWorkerEvents> implements IWdioExtensionWorker {
    protected configManager: IExtensionConfigManager
    public cid: string
    protected cwd: string
    public idleMonitor: IWorkerIdleMonitor
    protected disposables: vscode.Disposable[] = []
    private _workerProcess: ChildProcess | null = null
    private _workerRpc: WorkerApi | null = null
    private _workerPort: number | null = null
    private _workerConnected = false
    private _server: Server | null = null
    private _wss: WebSocketServer | null = null

    constructor(configManager: IExtensionConfigManager, cid: string = '#0', cwd: string) {
        super()
        this.cid = cid
        this.cwd = cwd
        this.configManager = configManager

        // Initialize idle monitor
        const idleTimeout = this.configManager.globalConfig.workerIdleTimeout
        this.idleMonitor = new WorkerIdleMonitor(this.cid, { idleTimeout })

        // Forward idle timeout events
        this.idleMonitor.on('idleTimeout', () => {
            this.emit('idleTimeout', undefined)
        })

        const psListener = () => {
            if (this._workerProcess && !this._workerProcess.killed) {
                log.debug('Extension host exiting - ensuring worker process is terminated')
                try {
                    this._workerProcess.kill('SIGKILL')
                } catch (e) {
                    log.debug(e)
                }
            }
        }
        process.on('exit', psListener)

        this.disposables.push({
            dispose: () => {
                process.removeListener('exit', psListener)
            },
        })
    }

    protected async getServer() {
        // Find available port for WebSocket communication
        // Store server instances for proper cleanup
        this._workerPort = await getPort()
        this._server = createHttpServer().listen(this._workerPort)
        this._server.unref()
        this._wss = createWss(this._server)

        log.debug(`Starting WebdriverIO worker ${this.cid} on port ${this._workerPort}`)
        log.debug(`Worker path: ${WORKER_PATH}`)
        log.debug(`Worker cwd: ${this.cwd}`)
        return `ws://localhost:${this._workerPort}`
    }

    /**
     * Start the worker process
     */
    public async start(): Promise<void> {
        if (this._workerProcess) {
            log.debug('Worker already running')
            return
        }
        try {
            const nodeExecutable = await resolveNodePath(this.configManager)
            // Find available port for WebSocket communication
            // Store server instances for proper cleanup
            const wsUrl = await this.getServer()

            const env = {
                ...process.env,
                WDIO_EXTENSION_WORKER_CID: this.cid,
                WDIO_EXTENSION_WORKER_WS_URL: wsUrl,
                FORCE_COLOR: '1',
                ELECTRON_RUN_AS_NODE: undefined,
            }

            // Start worker process
            this._workerProcess = spawn(nodeExecutable, [WORKER_PATH], {
                cwd: this.cwd,
                env,
                stdio: 'pipe',
            })

            this.setListeners(this._workerProcess)
        } catch (error) {
            log.debug(`Failed to start worker: ${error instanceof Error ? error.message : String(error)}`)
            this.stop()
            throw error
        }
    }

    private setListeners(wp: ChildProcess) {
        // Handle process output
        wp.stdout?.on('data', (data) => this.workerOutHandler('stdout', data))

        wp.stderr?.on('data', (data) => this.workerOutHandler('stderr', data))

        // Handle process exit
        wp.on('exit', (code) => {
            log.debug(`Worker${this.cid} process exited with code ${code}`)
            this._workerProcess = null
            this._workerRpc = null
            this._workerConnected = false

            // Stop idle monitoring when worker process exits
            this.idleMonitor.stop()
        })
    }

    private workerOutHandler(event: 'stdout' | 'stderr', data: any) {
        const payload = data.toString().trim()
        // eslint-disable-next-line no-control-regex
        log.debug(`[Worker${this.cid} ${event}] ${payload.replace(/\x1b\[[0-9;]*m/g, '')}`)
        this.emit(event, payload)
    }

    /**
     * Connect to worker via WebSocket
     */
    public async waitForStart(): Promise<void> {
        if (!this._workerPort) {
            throw new Error('Worker port not set')
        }

        return new Promise<void>((resolve, reject) => {
            if (!this._wss) {
                reject(new Error('Server is not started. Call the `start()` first.'))
                return
            }

            // Add timeout to prevent connection hanging indefinitely
            const timeout = setTimeout(() => {
                reject(new Error('Worker connection timeout'))
            }, 10000) // 10 seconds timeout)

            this._wss.once('connection', (ws) => {
                clearTimeout(timeout)
                const server = createRpcServer()
                this._workerRpc = createBirpc<WorkerApi, ExtensionApi>(server, {
                    post: (data) => ws.send(data),
                    on: (fn) => ws.on('message', fn),
                    serialize: v8.serialize,
                    deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
                })
                this._workerConnected = true

                ws.on('error', async (error) => {
                    const errorMessage = `WebSocket error: ${error.message}`
                    log.error(errorMessage)
                    await this.stop()
                })

                ws.on('close', () => {
                    if (this._workerConnected) {
                        log.debug('Worker connection closed')
                        this._workerConnected = false
                        this._workerRpc = null

                        // Stop idle monitoring when connection is closed
                        this.idleMonitor.stop()
                    }
                })

                this.disposables.push({
                    dispose: () => {
                        ws.close()
                    },
                })

                resolve()
            })
        }).then(() => {
            // Start idle monitoring after successful connection
            this.idleMonitor.start()
            this.startHealthCheck()
            log.debug('Worker process started successfully')
        })
    }

    /**
     * Stop the worker process
     */
    public async stop(): Promise<void> {
        // Stop idle monitoring first
        this.idleMonitor.stop()

        let shutdownSucceeded = false

        // Set a timeout for graceful shutdown
        const shutdownTimeout = 3000 // 3 seconds

        // 1. First try graceful shutdown via RPC
        if (this._workerRpc && this._workerConnected) {
            try {
                const timeoutPromise = new Promise<void>((_, reject) => {
                    setTimeout(() => reject(new Error('Shutdown timeout')), shutdownTimeout)
                })

                await Promise.race([this._workerRpc.shutdown(), timeoutPromise])

                shutdownSucceeded = true
                log.debug(`Worker${this.cid} process shutdown gracefully`)
            } catch (error) {
                log.debug(
                    `Error during worker${this.cid}  shutdown: ${error instanceof Error ? error.message : String(error)}`
                )
            }
        }

        // 2. Forcefully terminate if necessary
        if (!shutdownSucceeded && this._workerProcess) {
            try {
                // Send SIGTERM first to allow graceful termination
                this._workerProcess.kill('SIGTERM')

                // Wait a short time before checking if process is still alive
                if (!process.env.WDIO_UNIT_TESTING) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 1000))
                }
                // If process is still running, force kill with SIGKILL
                if (this._workerProcess.exitCode === null && !this._workerProcess.killed) {
                    log.debug('Forcing worker process termination with SIGKILL')
                    this._workerProcess.kill('SIGKILL')
                }
            } catch (error) {
                log.error(`Failed to kill worker process: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        this._workerProcess = null
        this._workerRpc = null
        this._workerConnected = false

        // Dispose all resources
        for (const disposable of this.disposables) {
            disposable.dispose()
        }
        this.disposables = []

        if (this._wss) {
            this._wss.close((err) => {
                if (err) {
                    log.debug(`Error closing WebSocket server: ${err.message}`)
                }
            })
            this._wss = null
        }

        if (this._server) {
            this._server.close((err) => {
                if (err) {
                    log.debug(`Error closing HTTP server: ${err.message}`)
                }
            })
            this._server = null
        }
        this.emit('shutdown', undefined)
        log.debug(`Extension worker${this.cid} stopped completely`)
    }

    /**
     * Get worker RPC interface
     * This getter resets the idle timer when accessed
     */
    public get rpc(): WorkerApi {
        if (!this._workerRpc || !this._workerConnected) {
            throw new Error('Worker not connected')
        }

        // Reset idle timer when RPC is accessed
        this.idleMonitor.resetTimer()

        return new Proxy(this._workerRpc, {
            get: <K extends keyof WorkerApi>(target: WorkerApi, prop: K): any => {
                const originalMethod = target[prop]
                if (typeof originalMethod === 'function') {
                    return (async (...args: any[]) => {
                        this.idleMonitor.pauseTimer()
                        try {
                            return await (originalMethod as Function).apply(target, args)
                        } finally {
                            this.idleMonitor.resumeTimer()
                        }
                    }) as WorkerApi[K]
                }
                return originalMethod
            },
        })
    }

    /**
     * Check if worker is connected
     */
    public isConnected(): boolean {
        return this._workerConnected
    }

    /**
     * Restart worker if it's not connected
     */
    public async ensureConnected(): Promise<void> {
        if (!this.isConnected()) {
            await this.stop()
            await this.start()
        }
    }

    /**
     * Update idle timeout configuration
     * @param timeout Idle timeout in milliseconds
     */
    public updateIdleTimeout(timeout: number): void {
        this.idleMonitor.updateTimeout(timeout)
    }

    private startHealthCheck() {
        const interval = setInterval(async () => {
            if (!this.isConnected()) {
                log.debug('Health check: Worker not connected')
                return
            }

            try {
                const response = await this._workerRpc?.ping()
                if (response !== 'pong') {
                    log.warn('Worker health check failed: unexpected response')
                    await this.ensureConnected()
                } else {
                    log.trace(`[${this.cid}] Worker health check success!`)
                }
            } catch (error) {
                log.warn(`Worker health check failed: ${error instanceof Error ? error.message : String(error)}`)
                await this.ensureConnected()
            }
        }, 60000) // Check every minute

        this.disposables.push({
            dispose: () => clearInterval(interval),
        })
    }
}

function createRpcServer(): ExtensionApi {
    return {
        log: loggingFn,
    }
}
