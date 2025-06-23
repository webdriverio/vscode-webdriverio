import { dirname, normalize } from 'node:path'

import { log } from '@vscode-wdio/logger'

import { WdioExtensionWorkerFactory } from './worker.js'
import type { IExtensionConfigManager } from '@vscode-wdio/types/config'
import type { IWorkerManager, IWdioExtensionWorker, IWdioExtensionWorkerFactory } from '@vscode-wdio/types/server'

export class WdioWorkerManager implements IWorkerManager {
    private _workerPool = new Map<string, IWdioExtensionWorker>()
    private _pendingOperations = new Map<string, Promise<IWdioExtensionWorker | void>>()
    private latestId = 0
    // Semaphore to track the overall operation (for complete sequential execution)
    private _operationLock = false
    private _operationQueue: (() => Promise<void>)[] = []

    constructor(
        configManager: IExtensionConfigManager,
        private workerFactory: IWdioExtensionWorkerFactory = new WdioExtensionWorkerFactory(configManager)
    ) {
        configManager.on('update:nodeExecutable', async (nodeExecutable: string | undefined) => {
            log.debug(`Stop all worker using webdriverio.nodeExecutable: ${nodeExecutable}`)
            const cwds = Array.from(this._workerPool.keys())
            await Promise.all(
                cwds.map(async (cwd) => {
                    const worker = this._workerPool.get(cwd)
                    if (worker) {
                        await this.stopWorker(cwd, worker)
                    }
                })
            )
        })

        // Listen for worker idle timeout configuration changes
        configManager.on('update:workerIdleTimeout', async (workerIdleTimeout: number) => {
            log.debug(`Update worker idle timeout: ${workerIdleTimeout}s`)
            await this.updateWorkersIdleTimeout(workerIdleTimeout)
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
            const server = this._workerPool.get(wdioDirName)
            if (server) {
                return server
            }
            this.latestId++
            return this.startWorker(this.latestId, dirname(normalizedConfigPath))
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
            for (const [cwd, worker] of this._workerPool.entries()) {
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
            const startingPromises: Promise<IWdioExtensionWorker>[] = []
            const workerCwds = Array.from(newConfigDirs)
            for (const cwd of workerCwds) {
                if (!this._workerPool.has(cwd)) {
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

    /**
     * Update idle timeout configuration for all active workers
     * @param idleTimeout Idle timeout in milliseconds
     */
    private async updateWorkersIdleTimeout(idleTimeout: number): Promise<void> {
        const updatePromises: Promise<void>[] = []

        for (const [cwd, worker] of this._workerPool.entries()) {
            if (worker.isConnected()) {
                log.debug(`[server manager] updating idle timeout for worker: ${cwd}`)
                const updatePromise = this.updateWorkerIdleTimeout(worker, idleTimeout)
                updatePromises.push(updatePromise)
            }
        }

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises)
        }
    }

    /**
     * Update idle timeout configuration for a specific worker
     * @param worker Worker to update
     * @param idleTimeout Idle timeout in milliseconds
     */
    private async updateWorkerIdleTimeout(worker: IWdioExtensionWorker, idleTimeout: number): Promise<void> {
        try {
            worker.updateIdleTimeout(idleTimeout)
            log.debug(`[server manager] successfully updated idle timeout for worker ${worker.cid}`)
        } catch (error) {
            const errorMessage = `Failed to update idle timeout for worker ${worker.cid}: ${error instanceof Error ? error.message : String(error)}`
            log.error(errorMessage)
        }
    }

    /**
     * Handle worker idle timeout notification
     * This method is called when a worker sends an idle timeout notification
     * @param workerCwd Worker's current working directory
     */
    public async handleWorkerIdleTimeout(workerCwd: string): Promise<void> {
        const normalizedConfigPath = normalize(workerCwd)
        log.debug(`[server manager] received idle timeout notification for worker: ${normalizedConfigPath}`)

        const worker = this._workerPool.get(normalizedConfigPath)
        if (worker) {
            await this.stopWorker(normalizedConfigPath, worker)
            log.debug(`[server manager] worker stopped due to idle timeout: ${normalizedConfigPath}`)
        } else {
            log.warn(`[server manager] received idle timeout for unknown worker: ${normalizedConfigPath}`)
        }
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

    private async startWorker(id: number, workerCwd: string): Promise<IWdioExtensionWorker> {
        // Return existing server if already created
        const existingServer = this._workerPool.get(workerCwd)
        if (existingServer) {
            return existingServer
        }

        // Return pending operation if one is in progress
        const pendingOperation = this._pendingOperations.get(`start:${workerCwd}`)
        if (pendingOperation) {
            return pendingOperation as Promise<IWdioExtensionWorker>
        }

        // Start a new process and track it
        const serverPromise = this.createWorker(id, workerCwd)
        this._pendingOperations.set(`start:${workerCwd}`, serverPromise)

        try {
            const server = await serverPromise
            return server
        } finally {
            // Remove from pending list when completed
            this._pendingOperations.delete(`start:${workerCwd}`)
        }
    }

    private async createWorker(id: number, configPaths: string): Promise<IWdioExtensionWorker> {
        const strId = `#${String(id)}`
        const worker = this.workerFactory.generate(strId, configPaths)

        // Set up idle timeout notification handler
        worker.on('idleTimeout', () => {
            this.handleWorkerIdleTimeout(configPaths)
        })

        await worker.start()
        await worker.waitForStart()

        log.debug(`[server manager] server was registered: ${configPaths}`)
        this._workerPool.set(configPaths, worker)
        return worker
    }

    private async stopWorker(configPath: string, worker: IWdioExtensionWorker): Promise<void> {
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

    private async executeStopWorker(configPath: string, worker: IWdioExtensionWorker): Promise<void> {
        log.trace(`shutdown the worker ${worker.cid} for ${configPath}`)
        await worker.stop()
        this._workerPool.delete(configPath)
    }

    public async dispose() {
        return this.queueOperation(async () => {
            const stopPromises: Promise<void>[] = []
            for (const [cwd, worker] of this._workerPool.entries()) {
                log.trace(`shutdown the worker ${worker.cid} for ${cwd}`)
                stopPromises.push(this.stopWorker(cwd, worker))
            }

            if (stopPromises.length > 0) {
                await Promise.all(stopPromises)
            }
        })
    }
}
