import v8 from 'node:v8'

import { createBirpc } from 'birpc'
import { WebSocket } from 'ws'

import { createWorker } from './handler.js'
import { getLogger } from './logger.js'
import type { NumericLogLevel } from '@vscode-wdio/types'
import type { ExtensionApi, WorkerApi } from '@vscode-wdio/types/api'

export function createRpcClient(cid: string, url: string) {
    let rpc: ExtensionApi | null = null
    let isConnected = false

    const handlerContext = { shutdownRequested: false, ws: new WebSocket(url), pendingCalls: [] as Array<() => void> }

    function callServerMethod<T>(method: (rpc: ExtensionApi) => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (isConnected && rpc) {
                method(rpc).then(resolve).catch(reject)
            } else {
                handlerContext.pendingCalls.push(() => {
                    if (rpc) {
                        method(rpc).then(resolve).catch(reject)
                    } else {
                        reject(new Error('RPC not initialized'))
                    }
                })
            }
        })
    }

    // Api caller for the extension side
    const client: ExtensionApi = {
        log(logLevel: NumericLogLevel, message: string): Promise<void> {
            return callServerMethod(async (r) => r.log(logLevel, `[WORKER${!cid ? '' : ` ${cid}`}] ${message}`))
        },
    }

    const log = getLogger(client)
    log.debug(`Starting WebdriverIO worker (PID: ${process.pid})`)
    log.debug(`Connecting the extension server: ${url}`)

    // Execute when ws was connected
    handlerContext.ws.on('open', () => {
        const worker = createWorker({ log, ...handlerContext })

        // Initialize the RPC
        rpc = createBirpc<ExtensionApi, WorkerApi>(worker, {
            post: (data) => handlerContext.ws.send(data),
            on: (data) => handlerContext.ws.on('message', data),
            serialize: v8.serialize,
            deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
        })

        isConnected = true

        // Execute pending calls
        while (handlerContext.pendingCalls.length > 0) {
            const call = handlerContext.pendingCalls.shift()
            call?.()
        }
    })

    handlerContext.ws.on('close', () => {
        if (handlerContext.shutdownRequested) {
            // Normal exit after shutdown request
            process.exit(0)
        }
    })

    return { ws: handlerContext.ws, client, log: log }
}
