import { spawn, type ChildProcess } from 'node:child_process'
import EventEmitter from 'node:events'
import { createServer as createHttpServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import * as v8 from 'node:v8'

import { createBirpc } from 'birpc'
import getPort from 'get-port'
import { WebSocketServer } from 'ws'

import { LOG_LEVEL } from '../constants.js'
import { log } from '../utils/logger.js'

import type * as vscode from 'vscode'
import type { ExtensionApi, WdioExtensionWorkerInterface, WorkerApi } from './types.js'
import type { NumericLogLevel } from '../types.js'

const WORKER_PATH = resolve(__dirname, 'worker/index.cjs')
export class WdioExtensionWorker extends EventEmitter implements WdioExtensionWorkerInterface {
    public cid: string
    private _workerProcess: ChildProcess | null = null
    private _workerRpc: WorkerApi | null = null
    private _workerPort: number | null = null
    private _workerConnected = false
    private _disposables: vscode.Disposable[] = []
    private _server: Server | null = null
    private _wss: WebSocketServer | null = null
    private _cwd: string

    constructor(cid: string = '#0', cwd: string) {
        super()
        this.cid = cid
        this._cwd = cwd

        process.on('exit', () => {
            if (this._workerProcess && !this._workerProcess.killed) {
                log.debug('Extension host exiting - ensuring worker process is terminated')
                try {
                    this._workerProcess.kill('SIGKILL')
                } catch (e) {
                    console.log(e)
                }
            }
        })
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
            // Find available port for WebSocket communication
            // Store server instances for proper cleanup
            this._workerPort = await getPort()
            this._server = createHttpServer().listen(this._workerPort)
            this._server.unref()
            this._wss = new WebSocketServer({ server: this._server })

            log.debug(`Starting WebdriverIO worker on port ${this._workerPort}`)
            log.debug(`Worker path: ${WORKER_PATH}`)

            const wsUrl = `ws://localhost:${this._workerPort}`

            const env = {
                ...process.env,
                WDIO_EXTENSION_WORKER_CID: this.cid,
                WDIO_EXTENSION_WORKER_WS_URL: wsUrl,
                FORCE_COLOR: '0',
            }
            // @ts-expect-error
            delete env.ELECTRON_RUN_AS_NODE

            // Start worker process
            this._workerProcess = spawn('node', [WORKER_PATH], {
                cwd: this._cwd,
                env,
                stdio: 'pipe',
            })

            this.setListeners(this._workerProcess)

            // Connect to worker via WebSocket
            await this.connectToWorker(this._wss)

            this.startHealthCheck()
            log.debug('Worker process started successfully')
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
            log.debug(`Worker process exited with code ${code}`)
            this._workerProcess = null
            this._workerRpc = null
            this._workerConnected = false
        })
    }

    private workerOutHandler(event: 'stdout' | 'stderr', data: any) {
        const payload = data.toString().trim()
        log.debug(`[Worker${this.cid} ${event}] ${payload}`)
        this.emit(event, payload)
    }

    /**
     * Connect to worker via WebSocket
     */
    private async connectToWorker(wss: WebSocketServer): Promise<void> {
        if (!this._workerPort) {
            throw new Error('Worker port not set')
        }

        return await new Promise<void>((resolve, reject) => {
            // Add timeout to prevent connection hanging indefinitely
            const timeout = setTimeout(() => {
                reject(new Error('Worker connection timeout'))
            }, 10000) // 10 seconds timeout

            wss.once('connection', (ws) => {
                clearTimeout(timeout)
                const server = createRpcServer()
                this._workerRpc = createBirpc<WorkerApi, ExtensionApi>(server, {
                    post: (data) => ws.send(data),
                    on: (fn) => ws.on('message', fn),
                    serialize: v8.serialize,
                    deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
                })
                this._workerConnected = true

                ws.on('error', (error) => {
                    log.error(`WebSocket error: ${error.message}`)
                    reject(error)
                })

                ws.on('close', () => {
                    if (this._workerConnected) {
                        log.debug('Worker connection closed')
                        this._workerConnected = false
                        this._workerRpc = null
                    }
                })

                this._disposables.push({
                    dispose: () => {
                        ws.close()
                    },
                })

                resolve()
            })
        })
    }
    /**
     * Stop the worker process
     */
    public async stop(): Promise<void> {
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
                log.debug('Worker process shutdown gracefully')
            } catch (error) {
                log.debug(`Error during worker shutdown: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        // 2. Forcefully terminate if necessary
        if (!shutdownSucceeded && this._workerProcess) {
            try {
                // Send SIGTERM first to allow graceful termination
                this._workerProcess.kill('SIGTERM')

                // Wait a short time before checking if process is still alive
                await new Promise<void>((resolve) => setTimeout(resolve, 1000))

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
        for (const disposable of this._disposables) {
            disposable.dispose()
        }
        this._disposables = []

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
        log.debug('Worker manager stopped completely')
    }

    /**
     * Get worker RPC interface
     */
    public get rpc(): WorkerApi {
        if (!this._workerRpc || !this._workerConnected) {
            throw new Error('Worker not connected')
        }
        return this._workerRpc
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

        this._disposables.push({
            dispose: () => clearInterval(interval),
        })
    }

    // emit<K extends keyof WdioExtensionWorkerEvents>(event: K, data: WdioExtensionWorkerEvents[K]): boolean {
    //     return super.emit(event, data)
    // }

    // on<K extends keyof WdioExtensionWorkerEvents>(
    //     event: K,
    //     listener: (data: WdioExtensionWorkerEvents[K]) => void
    // ): this {
    //     return super.on(event, listener)
    // }
}

function createRpcServer(): ExtensionApi {
    return {
        log: loggingFn,
    }
}

async function loggingFn(_logLevel: NumericLogLevel, message: string) {
    switch (_logLevel) {
        case LOG_LEVEL.TRACE:
            log.trace(message)
            break
        case LOG_LEVEL.DEBUG:
            log.debug(message)
            break
        case LOG_LEVEL.ERROR:
            log.error(message)
            break
        case LOG_LEVEL.WARN:
            log.warn(message)
            break
        case LOG_LEVEL.INFO:
            log.info(message)
            break
        default:
            log.debug(message)
            break
    }
}
