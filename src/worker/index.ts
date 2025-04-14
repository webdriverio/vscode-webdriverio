import { createRpcClient } from './client.js'

// Start WebSocket server when this file is run as a separate process
function startWorker() {
    const wsUrl = process.env.WDIO_WORKER_WS_URL || ''

    if (!wsUrl) {
        console.error('Worker port not specified. Use WDIO_WORKER_PORT environment variable.')
        process.exit(1)
    }
    const { ws, client } = createRpcClient(wsUrl)

    // Handle process signals
    process.on('SIGINT', () => {
        client.log('Worker received SIGINT, shutting down')
        ws.close()
        process.exit(0)
    })

    process.on('SIGTERM', () => {
        client.log('Worker received SIGTERM, shutting down')
        ws.close()
        process.exit(0)
    })
}

// Start worker when this file is executed directly
if (require.main === module) {
    startWorker()
}
