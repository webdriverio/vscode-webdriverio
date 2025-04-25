import { dirname, normalize } from 'node:path'

import { WdioExtensionWorker } from './worker.js'
import { log } from '../utils/logger.js'

import type * as vscode from 'vscode'

export class ServerManager implements vscode.Disposable {
    private _serverPool = new Map<string, WdioExtensionWorker>()
    private latestId = 0

    /**
     * Start worker process directory by directory which is located the wdio config file.
     * @param configPaths path to the configuration file for wdio (e.g. /path/to/wdio.config.js)
     */
    public async start(configPaths: string[]) {
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
    }

    /**
     *
     * @param configPaths path to the configuration file for wdio (e.g. /path/to/wdio.config.js)
     * @returns proper the connection server and worker
     */
    public async getConnection(configPaths: string) {
        const normalizedConfigPath = normalize(configPaths)
        const wdioDirName = dirname(normalizedConfigPath)
        log.debug(`[server manager] detecting server: ${wdioDirName}`)
        const server = this._serverPool.get(wdioDirName)
        if (server) {
            return server
        }
        this.latestId++
        return this.startWorker(this.latestId, dirname(configPaths))
    }

    private async startWorker(id: number, configPaths: string) {
        const strId = `#${String(id)}`
        const server = new WdioExtensionWorker(strId, configPaths)
        await server.start()
        await server.waitForStart()
        log.debug(`[server manager] server was resisted: ${configPaths}`)
        this._serverPool.set(configPaths, server)
        return server
    }

    public async dispose() {
        for (const [cwd, worker] of this._serverPool.entries()) {
            log.trace(`shutdown the worker ${worker.cid} for ${cwd}`)
            await worker.stop()
        }
    }
}
