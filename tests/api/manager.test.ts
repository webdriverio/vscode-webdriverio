import { dirname, join, normalize } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ServerManager } from '../../src/api/manager'
import { WdioExtensionWorker } from '../../src/api/worker'

// Mock the worker.js module
vi.mock('../../src/api/worker.js', () => {
    const WdioExtensionWorker = vi.fn(function (cid, configPath) {
        this.cid = cid
        this.configPath = configPath
    })
    WdioExtensionWorker.prototype.start = vi.fn().mockResolvedValue(undefined)
    WdioExtensionWorker.prototype.waitForStart = vi.fn().mockResolvedValue(undefined)
    WdioExtensionWorker.prototype.stop = vi.fn().mockResolvedValue(undefined)
    return { WdioExtensionWorker }
})

// Mock the logger module
vi.mock('../../src/utils/logger.js', () => {
    return {
        log: {
            debug: vi.fn(),
            trace: vi.fn(),
        },
    }
})

describe('ServerManager', () => {
    let serverManager: ServerManager

    // Create a fresh instance of ServerManager before each test
    beforeEach(() => {
        vi.resetAllMocks()
        serverManager = new ServerManager()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('start', () => {
        it('should start workers for each unique directory', async () => {
            // Setup
            const configPaths = ['/path/to/wdio.config.js', '/path/to/wdio.config.ts', '/another/path/wdio.config.js']

            // Execute
            await serverManager.start(configPaths)

            // Assert
            expect(WdioExtensionWorker).toHaveBeenCalledTimes(2)
            expect(WdioExtensionWorker).toHaveBeenCalledWith('#0', normalize('/path/to'))
            expect(WdioExtensionWorker).toHaveBeenCalledWith('#1', normalize('/another/path'))

            // Check that start was called on each worker
            expect(vi.mocked(WdioExtensionWorker).mock.instances.length).toBe(2)
            expect(WdioExtensionWorker.prototype.start).toHaveBeenCalledTimes(2)
        })

        it('should handle empty config paths array', async () => {
            await serverManager.start([])

            expect(WdioExtensionWorker).not.toHaveBeenCalled()
        })
    })

    describe('getConnection', () => {
        it('should return existing worker if it exists', async () => {
            // Setup
            const configPath = join(process.cwd(), 'path', 'to', '/wdio.config.js')

            // First call to create server
            const result = await serverManager.getConnection(configPath)

            // Reset mocks before second call
            vi.clearAllMocks()

            // Execute - second call should use existing server
            const cachedResult = await serverManager.getConnection(configPath)

            // Assert - WdioExtensionWorker constructor should not be called again
            expect(WdioExtensionWorker).not.toHaveBeenCalled()
            expect(cachedResult).toBeDefined()
            expect(result.cid).toBe(cachedResult.cid)
        })

        it('should create a new worker if it does not exist', async () => {
            // Setup
            const configPath = '/path/to/wdio.config.js'
            const wdioDirName = dirname(configPath)

            // Execute
            const result = await serverManager.getConnection(configPath)

            // Assert
            expect(WdioExtensionWorker).toHaveBeenCalledTimes(1)
            expect(WdioExtensionWorker).toHaveBeenCalledWith('#1', wdioDirName)
            expect(result).toBeDefined()
            expect(result.cid).toBe('#1')
        })

        it('should increment the id for each new worker', async () => {
            // Setup - create first worker
            await serverManager.getConnection('/path/to/wdio.config.js')

            // Execute - create second worker with different path
            await serverManager.getConnection('/another/path/wdio.config.js')

            // Assert
            expect(WdioExtensionWorker).toHaveBeenCalledTimes(2)
            expect(WdioExtensionWorker).toHaveBeenCalledWith('#1', '/path/to')
            expect(WdioExtensionWorker).toHaveBeenCalledWith('#2', '/another/path')
        })
    })

    describe('dispose', () => {
        it('should stop all workers', async () => {
            // Setup - create multiple workers
            const configPaths = ['/path/to/wdio.config.js', '/another/path/wdio.config.js']

            await serverManager.start(configPaths)

            // Execute
            await serverManager.dispose()

            // Assert
            expect(vi.mocked(WdioExtensionWorker).mock.instances.length).toBe(2)
            expect(WdioExtensionWorker.prototype.stop).toHaveBeenCalledTimes(2)
        })

        it('should handle empty server pool', async () => {
            // Execute
            await serverManager.dispose()

            // Assert - should not throw an error
            expect(WdioExtensionWorker).not.toHaveBeenCalled()
        })
    })

    describe('startWorker', () => {
        it('should create and start a new worker', async () => {
            // Setup
            const id = 42
            const configPath = '/path/to/wdio.config.js'

            // Access private method using any cast
            const startWorker = (serverManager as any).startWorker.bind(serverManager)

            // Execute
            const result = await startWorker(id, configPath)

            // Assert
            expect(WdioExtensionWorker).toHaveBeenCalledTimes(1)
            expect(WdioExtensionWorker).toHaveBeenCalledWith('#42', configPath)
            expect(result).toBeDefined()
            expect(result.start).toHaveBeenCalledTimes(1)
            expect(result.waitForStart).toHaveBeenCalledTimes(1)
        })
    })
})
