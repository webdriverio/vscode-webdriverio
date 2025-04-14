import { WebSocket } from 'ws'
import type { ExtensionApi, TestProgress, WorkerApi } from '../api/types.js'
import { createBirpc } from 'birpc'
import v8 from 'node:v8'
import { createHandler } from './handler.js'

export function createRpcClient(url: string) {
    const ws = new WebSocket(url)
    let rpc: ExtensionApi | null = null
    const pendingCalls: Array<() => void> = []
    let isConnected = false

    // 関数オブジェクト
    const client: ExtensionApi = {
        log(message: string): Promise<void> {
            return callServerMethod(async (r) => r.log(`[WORKER] ${message}`))
        },
        reportProgress: function (_progress: TestProgress): Promise<void> {
            throw new Error('Function not implemented.')
        },
    }
    // プライベート関数
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

    // 接続時の処理
    ws.on('open', () => {
        isConnected = true

        // RPCの初期化
        rpc = createBirpc<ExtensionApi, WorkerApi>(createHandler(client), {
            post: (data) => ws.send(data),
            on: (data) => ws.on('message', data),
            serialize: v8.serialize,
            deserialize: (v) => v8.deserialize(Buffer.from(v) as any),
        })

        // 保留中の呼び出しを実行
        while (pendingCalls.length > 0) {
            const call = pendingCalls.shift()
            call?.()
        }
    })

    return { ws, client }
}
