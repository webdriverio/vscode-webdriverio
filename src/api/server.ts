import * as v8 from 'node:v8'
import { resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'

import getPort from 'get-port'
import { createBirpc } from 'birpc'
import { WebSocketServer } from 'ws'

import { log } from '../utils/logger.js'
import { LOG_LEVEL } from '../constants.js'
import { configManager } from '../config/index.js'

import type * as vscode from 'vscode'
import type { ExtensionApi, WorkerApi } from './types.js'
import type { NumericLogLevel } from '../types.js'

const WORKER_PATH = resolve(__dirname, 'worker/index.cjs')
/**
 * Manages the WebDriverIO worker process
 */
export class WorkerManager {
    private _workerProcess: ChildProcess | null = null
    private _workerRpc: WorkerApi | null = null
    private _workerPort: number | null = null
    private _workerConnected = false
    private _extensionApi: ExtensionApi
    private _disposables: vscode.Disposable[] = []

    constructor() {
        // Define extension API implementation
        this._extensionApi = {
            log: loggingFn,
            reportProgress: async (progress) => {
                // Progress reporting is handled by the caller
                // This is for direct worker-to-extension progress updates
                log.debug(`Progress: ${progress.message}`)
            },
        }
    }

    /**
     * Start the worker process
     */
    async start(): Promise<void> {
        if (this._workerProcess) {
            log.debug('Worker already running')
            return
        }
        const workspaceFolders = configManager.getWorkspaceFolderPath()

        try {
            // Find available port for WebSocket communication
            this._workerPort = await getPort()
            const server = createServer().listen(this._workerPort).unref()
            const wss = new WebSocketServer({ server })
            const wsUrl = `ws://localhost:${this._workerPort}`
            log.debug(`Starting WebDriverIO worker on port ${this._workerPort}`)

            // Get path to worker script

            log.debug(`Worker path: ${WORKER_PATH}`)

            const env = { ...process.env, WDIO_WORKER_WS_URL: wsUrl, FORCE_COLOR: '0' }
            // @ts-expect-error
            delete env.ELECTRON_RUN_AS_NODE

            // Start worker process
            this._workerProcess = spawn('node', [WORKER_PATH], {
                cwd: workspaceFolders[0],
                env,
                stdio: 'pipe',
            })

            // Handle process output
            this._workerProcess.stdout?.on('data', (data) => {
                log.debug(`[Worker stdout] ${data.toString().trim()}`)
            })

            this._workerProcess.stderr?.on('data', (data) => {
                log.debug(`[Worker stderr] ${data.toString().trim()}`)
            })

            // Handle process exit
            this._workerProcess.on('exit', (code) => {
                log.debug(`Worker process exited with code ${code}`)
                this._workerProcess = null
                this._workerRpc = null
                this._workerConnected = false
            })

            // Connect to worker via WebSocket
            await this.connectToWorker(wss)
        } catch (error) {
            log.debug(`Failed to start worker: ${error instanceof Error ? error.message : String(error)}`)
            this.stop()
            throw error
        }
    }

    /**
     * Connect to worker via WebSocket
     */
    private async connectToWorker(wss: WebSocketServer): Promise<void> {
        if (!this._workerPort) {
            throw new Error('Worker port not set')
        }
        new Promise<void>((resolve, reject) => {
            wss.once('connection', (ws) => {
                this._workerRpc = createBirpc<WorkerApi, ExtensionApi>(this._extensionApi, {
                    post: (data) => ws.send(data),
                    on: (fn) => ws.on('message', fn),
                    serialize: v8.serialize,
                    deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
                })
                this._workerConnected = true

                ws.on('error', (error) => {
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
    async stop(): Promise<void> {
        if (this._workerRpc && this._workerConnected) {
            try {
                // Try graceful shutdown
                await this._workerRpc.shutdown()
            } catch (error) {
                log.debug(`Error during worker shutdown: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        if (this._workerProcess) {
            // Force kill if still running
            this._workerProcess.kill()
            this._workerProcess = null
        }

        this._workerRpc = null
        this._workerConnected = false

        // Dispose all resources
        for (const disposable of this._disposables) {
            disposable.dispose()
        }
        this._disposables = []
    }

    /**
     * Get worker RPC interface
     */
    getWorkerRpc(): WorkerApi {
        if (!this._workerRpc || !this._workerConnected) {
            throw new Error('Worker not connected')
        }
        return this._workerRpc
    }

    /**
     * Check if worker is connected
     */
    isConnected(): boolean {
        return this._workerConnected
    }

    /**
     * Restart worker if it's not connected
     */
    async ensureConnected(): Promise<void> {
        if (!this.isConnected()) {
            await this.stop()
            await this.start()
        }
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
