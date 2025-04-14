import type * as vscode from 'vscode'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'
import getPort from 'get-port'
import { createBirpc } from 'birpc'
import { WebSocketServer } from 'ws'
import type { ExtensionApi, WorkerApi } from './api/types.js'
import { log } from './utils/logger.js'
import { workerPath } from './constants.js'
import { configManager } from './config/config.js'
import v8 from 'node:v8'

/**
 * Manages the WebDriverIO worker process
 */
export class WorkerManager {
    private workerProcess: ChildProcess | null = null
    private workerRpc: WorkerApi | null = null
    private workerPort: number | null = null
    private workerConnected = false
    private extensionApi: ExtensionApi
    private disposables: vscode.Disposable[] = []

    constructor() {
        // Define extension API implementation
        this.extensionApi = {
            log: async (message: string) => {
                log.debug(message)
            },
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
        if (this.workerProcess) {
            log.debug('Worker already running')
            return
        }
        const workspaceFolders = configManager.getWorkspaceFolderPath()

        try {
            // Find available port for WebSocket communication
            this.workerPort = await getPort()
            const server = createServer().listen(this.workerPort).unref()
            const wss = new WebSocketServer({ server })
            const wsUrl = `ws://localhost:${this.workerPort}`
            log.debug(`Starting WebDriverIO worker on port ${this.workerPort}`)

            // Get path to worker script

            log.debug(`Worker path: ${workerPath}`)

            const env = { ...process.env, WDIO_WORKER_WS_URL: wsUrl, FORCE_COLOR: '0' }
            // @ts-expect-error
            delete env.ELECTRON_RUN_AS_NODE

            // Start worker process
            this.workerProcess = spawn('node', [workerPath], {
                cwd: workspaceFolders[0],
                env,
                stdio: 'pipe',
            })

            // Handle process output
            this.workerProcess.stdout?.on('data', (data) => {
                log.debug(`[Worker stdout] ${data.toString().trim()}`)
            })

            this.workerProcess.stderr?.on('data', (data) => {
                log.debug(`[Worker stderr] ${data.toString().trim()}`)
            })

            // Handle process exit
            this.workerProcess.on('exit', (code) => {
                log.debug(`Worker process exited with code ${code}`)
                this.workerProcess = null
                this.workerRpc = null
                this.workerConnected = false
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
        if (!this.workerPort) {
            throw new Error('Worker port not set')
        }
        new Promise<void>((resolve, reject) => {
            wss.once('connection', (ws) => {
                this.workerRpc = createBirpc<WorkerApi, ExtensionApi>(this.extensionApi, {
                    post: (data) => ws.send(data),
                    on: (fn) => ws.on('message', fn),
                    serialize: v8.serialize,
                    deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
                })
                this.workerConnected = true

                ws.on('error', (error) => {
                    reject(error)
                })

                ws.on('close', () => {
                    if (this.workerConnected) {
                        log.debug('Worker connection closed')
                        this.workerConnected = false
                        this.workerRpc = null
                    }
                })

                this.disposables.push({
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
        if (this.workerRpc && this.workerConnected) {
            try {
                // Try graceful shutdown
                await this.workerRpc.shutdown()
            } catch (error) {
                log.debug(`Error during worker shutdown: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        if (this.workerProcess) {
            // Force kill if still running
            this.workerProcess.kill()
            this.workerProcess = null
        }

        this.workerRpc = null
        this.workerConnected = false

        // Dispose all resources
        for (const disposable of this.disposables) {
            disposable.dispose()
        }
        this.disposables = []
    }

    /**
     * Get worker RPC interface
     */
    getWorkerRpc(): WorkerApi {
        if (!this.workerRpc || !this.workerConnected) {
            throw new Error('Worker not connected')
        }
        return this.workerRpc
    }

    /**
     * Check if worker is connected
     */
    isConnected(): boolean {
        return this.workerConnected
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
