import { createRpcClient } from './client.js'

// Start WebSocket server when this file is run as a separate process
export function startWorker() {
    const cid = process.env.WDIO_EXTENSION_WORKER_CID || ''
    const wsUrl = process.env.WDIO_EXTENSION_WORKER_WS_URL || ''

    if (!wsUrl) {
        console.error('Server URL is not specified. Use WDIO_EXTENSION_WORKER_WS_URL environment variable.')
        process.exit(1)
        return // only for unit test
    }

    const { ws, log } = createRpcClient(cid, wsUrl)

    // Handle process signals
    process.on('SIGINT', () => {
        log.info('Worker received SIGINT, shutting down')
        ws.close()
        process.exit(0)
    })

    process.on('SIGTERM', () => {
        log.info('Worker received SIGTERM, shutting down')
        ws.close()
        process.exit(0)
    })
}

// Start worker when this file is executed directly
if (require.main === module) {
    startWorker()
}
