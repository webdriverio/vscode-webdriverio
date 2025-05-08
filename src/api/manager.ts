import { dirname, normalize } from 'node:path'

import { WdioExtensionWorker } from './worker.js'
import { log } from '../utils/logger.js'
import type * as vscode from 'vscode'

export class ServerManager implements vscode.Disposable {
    private _serverPool = new Map<string, WdioExtensionWorker>()
    private _pendingOperations = new Map<string, Promise<WdioExtensionWorker | void>>()
    private latestId = 0
    // Semaphore to track the overall operation (for complete sequential execution)
    private _operationLock = false
    private _operationQueue: (() => Promise<void>)[] = []

    /**
     * Start worker process directory by directory which is located the wdio config file.
     * @param configPaths path to the configuration file for wdio (e.g. /path/to/wdio.config.js)
     */
    public async start(configPaths: string[]) {
        // Add to queue and then execute the process
        return this.queueOperation(async () => {
            const duplicatedWorkerCwds = new Set<string>()
            configPaths.forEach((configPath) => {
                const normalizedConfigPath = normalize(configPath)
                const wdioDirName = dirname(normalizedConfigPath)
                duplicatedWorkerCwds.add(wdioDirName)
            })

            const workerCwds = Array.from(duplicatedWorkerCwds)
            const ids = Array.from({ length: workerCwds.length }, (_, i) => i)
            this.latestId = ids[ids.length - 1]

            await Promise.all(
                workerCwds.map(async (workerCwd, index) => {
                    await this.startWorker(ids[index], workerCwd)
                })
            )
        })
    }

    /**
     *
     * @param configPaths path to the configuration file for wdio (e.g. /path/to/wdio.config.js)
     * @returns proper the connection server and worker
     */
    public async getConnection(configPaths: string) {
        return this.queueOperation(async () => {
            const normalizedConfigPath = normalize(configPaths)
            const wdioDirName = dirname(normalizedConfigPath)
            log.debug(`[server manager] detecting server: ${wdioDirName}`)
            const server = this._serverPool.get(wdioDirName)
            if (server) {
                return server
            }
            this.latestId++
            return this.startWorker(this.latestId, dirname(configPaths))
        })
    }

    /**
     * Reorganize workers by stopping unnecessary ones and starting new ones
     * @param configPaths new configuration paths to maintain
     */
    public async reorganize(configPaths: string[]) {
        return this.queueOperation(async () => {
            // Create a set of new configuration paths
            const newConfigDirs = new Set<string>()
            configPaths.forEach((configPath) => {
                const normalizedConfigPath = normalize(configPath)
                const wdioDirName = dirname(normalizedConfigPath)
                newConfigDirs.add(wdioDirName)
            })

            // Find workers that need to be stopped
            const stoppingPromises: Promise<void>[] = []
            for (const [cwd, worker] of this._serverPool.entries()) {
                if (!newConfigDirs.has(cwd)) {
                    log.debug(`[server manager] stopping unnecessary worker: ${cwd}`)
                    stoppingPromises.push(this.stopWorker(cwd, worker))
                }
            }

            // Stop unnecessary workers
            if (stoppingPromises.length > 0) {
                await Promise.all(stoppingPromises)
            }

            // Start new workers
            const startingPromises: Promise<WdioExtensionWorker>[] = []
            const workerCwds = Array.from(newConfigDirs)
            for (const cwd of workerCwds) {
                if (!this._serverPool.has(cwd)) {
                    this.latestId++
                    startingPromises.push(this.startWorker(this.latestId, cwd))
                }
            }

            // Wait for new workers to start
            if (startingPromises.length > 0) {
                await Promise.all(startingPromises)
            }
        })
    }

    private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
        // Execute immediately if no operation is in progress
        if (!this._operationLock) {
            this._operationLock = true
            try {
                return await operation()
            } finally {
                this._operationLock = false
                this.processQueue()
            }
        }

        // Add operation to the queue
        return new Promise<T>((resolve, reject) => {
            this._operationQueue.push(async () => {
                try {
                    resolve(await operation())
                } catch (error) {
                    reject(error)
                }
            })
        })
    }

    private async processQueue() {
        // Do nothing if an operation is in progress or the queue is empty
        if (this._operationLock || this._operationQueue.length === 0) {
            return
        }

        // Get and execute the next operation from the queue
        this._operationLock = true
        const nextOperation = this._operationQueue.shift()!

        try {
            await nextOperation()
        } finally {
            this._operationLock = false
            // Process the next operation (recursive call)
            this.processQueue()
        }
    }

    private async startWorker(id: number, configPaths: string): Promise<WdioExtensionWorker> {
        // Return existing server if already created
        const existingServer = this._serverPool.get(configPaths)
        if (existingServer) {
            return existingServer
        }

        // Return pending operation if one is in progress
        const pendingOperation = this._pendingOperations.get(`start:${configPaths}`)
        if (pendingOperation) {
            return pendingOperation as Promise<WdioExtensionWorker>
        }

        // Start a new process and track it
        const serverPromise = this.createWorker(id, configPaths)
        this._pendingOperations.set(`start:${configPaths}`, serverPromise)

        try {
            const server = await serverPromise
            return server
        } finally {
            // Remove from pending list when completed
            this._pendingOperations.delete(`start:${configPaths}`)
        }
    }

    private async createWorker(id: number, configPaths: string): Promise<WdioExtensionWorker> {
        const strId = `#${String(id)}`
        const server = new WdioExtensionWorker(strId, configPaths)
        await server.start()
        await server.waitForStart()
        log.debug(`[server manager] server was registered: ${configPaths}`)
        this._serverPool.set(configPaths, server)
        return server
    }

    private async stopWorker(configPath: string, worker: WdioExtensionWorker): Promise<void> {
        // Return pending stop operation if one is in progress
        const pendingOperation = this._pendingOperations.get(`stop:${configPath}`)
        if (pendingOperation) {
            return pendingOperation as Promise<void>
        }

        // Start a new stop process and track it
        const stopPromise = this.executeStopWorker(configPath, worker)
        this._pendingOperations.set(`stop:${configPath}`, stopPromise)

        try {
            await stopPromise
        } finally {
            // Remove from pending list when completed
            this._pendingOperations.delete(`stop:${configPath}`)
        }
    }

    private async executeStopWorker(configPath: string, worker: WdioExtensionWorker): Promise<void> {
        log.trace(`shutdown the worker ${worker.cid} for ${configPath}`)
        await worker.stop()
        this._serverPool.delete(configPath)
    }

    public async dispose() {
        return this.queueOperation(async () => {
            const stopPromises: Promise<void>[] = []
            for (const [cwd, worker] of this._serverPool.entries()) {
                log.trace(`shutdown the worker ${worker.cid} for ${cwd}`)
                stopPromises.push(this.stopWorker(cwd, worker))
            }

            if (stopPromises.length > 0) {
                await Promise.all(stopPromises)
            }
        })
    }
}
