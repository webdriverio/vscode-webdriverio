import { dirname, join, normalize } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ServerManager } from '../src/manager.js'
import { WdioExtensionWorker } from '../src/worker.js'
import type { ExtensionConfigManagerInterface } from '@vscode-wdio/types/config'

vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))

// Mock the worker.js module
vi.mock('../src/worker.js', () => {
    const WdioExtensionWorker = vi.fn(function (_configManager, cid, configPath) {
        // @ts-ignore
        this.cid = cid
        // @ts-ignore
        this.configPath = configPath
    })
    WdioExtensionWorker.prototype.start = vi.fn().mockResolvedValue(undefined)
    WdioExtensionWorker.prototype.waitForStart = vi.fn().mockResolvedValue(undefined)
    WdioExtensionWorker.prototype.stop = vi.fn().mockResolvedValue(undefined)
    return { WdioExtensionWorker }
})

// Mock the logger module
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('../src/utils.js', async (importActual) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importActual<typeof import('../src/utils.js')>()
    return {
        ...actual,
        resolveNodePath: vi.fn(),
    }
})

const mockConfigManager = {
    on: vi.fn(),
} as unknown as ExtensionConfigManagerInterface

describe('ServerManager', () => {
    let serverManager: ServerManager

    // Create a fresh instance of ServerManager before each test
    beforeEach(() => {
        vi.resetAllMocks()
        serverManager = new ServerManager(mockConfigManager)
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
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#0', normalize('/path/to'))
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#1', normalize('/another/path'))

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
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#1', wdioDirName)
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
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#1', '/path/to')
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#2', '/another/path')
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

    describe('reorganize', () => {
        it('should stop unnecessary workers and start new ones', async () => {
            // Setup - create initial workers
            await serverManager.start(['/path/to/wdio.config.js', '/another/path/wdio.config.js'])

            vi.clearAllMocks()

            // Execute - reorganize with different paths
            await serverManager.reorganize(['/path/to/wdio.config.js', '/new/path/wdio.config.js'])

            // Assert
            // Should stop one worker
            expect(WdioExtensionWorker.prototype.stop).toHaveBeenCalledTimes(1)

            // Should create one new worker
            expect(WdioExtensionWorker).toHaveBeenCalledTimes(1)
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#2', normalize('/new/path'))
        })
    })

    describe('operation queueing', () => {
        it('should queue operations and execute them sequentially', async () => {
            // Setup
            const operations = [] as string[]

            // Create a delayed function to simulate async operations
            const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

            // Mock createWorker to add delay and tracking
            const originalCreateWorker = (serverManager as any).createWorker.bind(serverManager)
            vi.spyOn(serverManager as any, 'createWorker').mockImplementation((async (
                id: number,
                configPath: string
            ) => {
                operations.push(`start:${configPath}`)
                await delay(10) // Small delay to ensure timing
                return originalCreateWorker(id, configPath)
            }) as any)

            // Execute multiple operations concurrently
            const promise1 = serverManager.getConnection('/path/1/wdio.config.js')
            const promise2 = serverManager.getConnection('/path/2/wdio.config.js')
            const promise3 = serverManager.getConnection('/path/3/wdio.config.js')

            // Wait for all operations to complete
            await Promise.all([promise1, promise2, promise3])

            // Assert operations were queued and processed in order
            expect(operations.length).toBe(3)
            expect(operations[0]).toBe('start:/path/1')
            expect(operations[1]).toBe('start:/path/2')
            expect(operations[2]).toBe('start:/path/3')
        })

        it('should avoid duplicate operations for the same path', async () => {
            // Setup
            const startCount = { count: 0 }

            // Mock createWorker to track calls
            const originalCreateWorker = (serverManager as any).createWorker.bind(serverManager)
            vi.spyOn(serverManager as any, 'createWorker').mockImplementation((async (
                id: number,
                configPath: string
            ) => {
                startCount.count++
                await new Promise((resolve) => setTimeout(resolve, 50)) // Delay to ensure overlap
                return originalCreateWorker(id, configPath)
            }) as any)

            // Execute multiple operations for the same path concurrently
            const promises = Array(5)
                .fill(null)
                .map(() => serverManager.getConnection('/same/path/wdio.config.js'))

            // Wait for all operations to complete
            const results = await Promise.all(promises)

            // Assert
            expect(startCount.count).toBe(1) // Only one actual worker creation

            // All results should reference the same worker
            const firstCid = results[0].cid
            results.forEach((result) => {
                expect(result.cid).toBe(firstCid)
            })
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
            expect(WdioExtensionWorker).toHaveBeenCalledWith(mockConfigManager, '#42', configPath)
            expect(result).toBeDefined()
            expect(result.start).toHaveBeenCalledTimes(1)
            expect(result.waitForStart).toHaveBeenCalledTimes(1)
        })

        it('should return the same promise for concurrent calls with the same path', async () => {
            // Setup
            const id1 = 0.1,
                id2 = 2
            const configPath = '/path/to/wdio.config.js'

            // Access private method using any cast
            const startWorker = (serverManager as any).startWorker.bind(serverManager)

            // Add tracking to see if createWorker is called multiple times
            let createWorkerCalls = 0
            vi.spyOn(serverManager as any, 'createWorker').mockImplementation((async (id: number, path: string) => {
                createWorkerCalls++
                // Mock delay to ensure operations overlap
                await new Promise((resolve) => setTimeout(resolve, 50))
                return new WdioExtensionWorker(mockConfigManager, `#${id}`, path)
            }) as any)

            // Execute two concurrent calls with same path
            const promise1 = startWorker(id1, configPath)
            const promise2 = startWorker(id2, configPath)

            // Wait for both to complete
            const [result1, result2] = await Promise.all([promise1, promise2])

            // Assert
            expect(createWorkerCalls).toBe(1) // Only one actual worker creation
            expect(result1).toBe(result2) // Should be the same worker instance
        })
    })

    describe('stopWorker', () => {
        it('should stop a worker and remove it from the server pool', async () => {
            // Setup - create a worker first
            await serverManager.getConnection('/path/to/wdio.config.js')

            // Access private methods using any cast
            const stopWorker = (serverManager as any).stopWorker.bind(serverManager)

            // Get the worker from the server pool
            const worker = (serverManager as any)._serverPool.get('/path/to')

            // Execute
            await stopWorker('/path/to', worker)

            // Assert
            expect(worker.stop).toHaveBeenCalledTimes(1)
            expect((serverManager as any)._serverPool.has('/path/to')).toBe(false)
        })

        it('should return the same promise for concurrent stop calls', async () => {
            // Setup - create a worker first
            await serverManager.getConnection('/path/to/wdio.config.js')

            // Access private methods using any cast
            const stopWorker = (serverManager as any).stopWorker.bind(serverManager)

            // Get the worker from the server pool
            const worker = (serverManager as any)._serverPool.get('/path/to')

            // Add tracking
            let executeStopWorkerCalls = 0
            vi.spyOn(serverManager as any, 'executeStopWorker').mockImplementation(async () => {
                executeStopWorkerCalls++
                // Mock delay to ensure operations overlap
                await new Promise((resolve) => setTimeout(resolve, 50))
            })

            // Execute two concurrent stop calls
            const promise1 = stopWorker('/path/to', worker)
            const promise2 = stopWorker('/path/to', worker)

            // Wait for both to complete
            await Promise.all([promise1, promise2])

            // Assert
            expect(executeStopWorkerCalls).toBe(1) // Only one actual stop execution
        })
    })
})
