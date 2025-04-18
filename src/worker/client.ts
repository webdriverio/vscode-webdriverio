import v8 from 'node:v8'
import { WebSocket } from 'ws'
import { createBirpc } from 'birpc'
import { createHandler } from './handler.js'
import { getLogger } from './logger.js'

import type { NumericLogLevel } from '../types.js'
import type { ExtensionApi, TestProgress, WorkerApi } from '../api/types.js'

export function createRpcClient(url: string) {
    const ws = new WebSocket(url)
    let rpc: ExtensionApi | null = null
    const pendingCalls: Array<() => void> = []
    let isConnected = false
    let shutdownRequested = false

    // Api caller for the extension side
    const client: ExtensionApi = {
        log(logLevel: NumericLogLevel, message: string): Promise<void> {
            return callServerMethod(async (r) => r.log(logLevel, `[WORKER] ${message}`))
        },
        reportProgress: function (_progress: TestProgress): Promise<void> {
            throw new Error('Function not implemented.')
        },
    }

    function callServerMethod<T>(method: (rpc: ExtensionApi) => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (isConnected && rpc) {
                method(rpc).then(resolve).catch(reject)
            } else {
                pendingCalls.push(() => {
                    if (rpc) {
                        method(rpc).then(resolve).catch(reject)
                    } else {
                        reject(new Error('RPC not initialized'))
                    }
                })
            }
        })
    }

    const logger = getLogger(client)
    logger.debug(`Starting WebDriverIO worker (PID: ${process.pid})`)
    logger.debug(`Connecting the extension server: ${url}`)

    // Execute when ws was connected
    ws.on('open', () => {
        isConnected = true

        // Initialize the RPC
        rpc = createBirpc<ExtensionApi, WorkerApi>(
            {
                ...createHandler(logger),
                shutdown: async function (): Promise<void> {
                    logger.info('Shutting down worker process')
                    shutdownRequested = true
                    logger.info('Worker received shutdown request')

                    // Implement safe shutdown procedure
                    try {
                        // Give pending tasks a chance to complete
                        if (pendingCalls.length > 0) {
                            await new Promise((resolve) => setTimeout(resolve, 500))
                        }

                        // Close WebSocket connection
                        ws.close()

                        // Set safety timeout in case WebSocket doesn't close
                        setTimeout(() => {
                            process.exit(0)
                        }, 2000)
                    } catch (error) {
                        console.error('Error during shutdown:', error)
                        process.exit(1)
                    }
                },
            },
            {
                post: (data) => ws.send(data),
                on: (data) => ws.on('message', data),
                serialize: v8.serialize,
                deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
            }
        )

        // Execute pending calls
        while (pendingCalls.length > 0) {
            const call = pendingCalls.shift()
            call?.()
        }
    })

    ws.on('close', () => {
        if (shutdownRequested) {
            // Normal exit after shutdown request
            process.exit(0)
        }
    })

    return { ws, client, log: logger }
}
