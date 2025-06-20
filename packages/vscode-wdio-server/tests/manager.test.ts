import { dirname, join, normalize } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { WdioWorkerManager } from '../src/manager.js'
import type { IExtensionConfigManager, IWdioExtensionWorker, IWdioExtensionWorkerFactory } from '@vscode-wdio/types'

vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))

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

// Mock the worker.js module
class MockWorkerFactory implements IWdioExtensionWorkerFactory {
    WdioExtensionWorker
    generatedWorkers: IWdioExtensionWorker[] = []

    constructor(private configManager: IExtensionConfigManager) {
        this.WdioExtensionWorker = vi.fn(function (_configManager, cid, configPath) {
            // @ts-ignore
            this.cid = cid
            // @ts-ignore
            this.configPath = configPath
        })
        this.WdioExtensionWorker.prototype.start = vi.fn().mockResolvedValue(undefined)
        this.WdioExtensionWorker.prototype.waitForStart = vi.fn().mockResolvedValue(undefined)
        this.WdioExtensionWorker.prototype.stop = vi.fn().mockResolvedValue(undefined)
        this.WdioExtensionWorker.prototype.on = vi.fn()
        this.WdioExtensionWorker.prototype.isConnected = vi.fn().mockReturnValue(true)
        this.WdioExtensionWorker.prototype.updateIdleTimeout = vi.fn()
    }
    generate(id: string, cwd: string): IWdioExtensionWorker {
        const worker = new this.WdioExtensionWorker(this.configManager, id, cwd) as unknown as IWdioExtensionWorker
        this.generatedWorkers.push(worker)
        return worker
    }
}

describe('ServerManager', () => {
    let workerManager: WdioWorkerManager
    let workerFactory: MockWorkerFactory
    let mockConfigManager: IExtensionConfigManager

    // Create a fresh instance of ServerManager before each test
    beforeEach(() => {
        vi.resetAllMocks()

        mockConfigManager = {
            globalConfig: {
                workerIdleTimeout: 600,
            },
            on: vi.fn(),
        } as unknown as IExtensionConfigManager

        workerFactory = new MockWorkerFactory(mockConfigManager)
        workerManager = new WdioWorkerManager(mockConfigManager, workerFactory)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('getConnection', () => {
        it('should return existing worker if it exists', async () => {
            // Setup
            const configPath = join(process.cwd(), 'path', 'to', '/wdio.config.js')

            // First call to create server
            const result = await workerManager.getConnection(configPath)
            const spyFactory = vi.spyOn(workerFactory, 'generate')

            // Execute - second call should use existing server
            const cachedResult = await workerManager.getConnection(configPath)

            // Assert - WdioExtensionWorker constructor should not be called again
            expect(spyFactory).not.toHaveBeenCalled()
            expect(cachedResult).toBeDefined()
            expect(result.cid).toBe(cachedResult.cid)
        })

        it('should create a new worker if it does not exist', async () => {
            // Setup
            const configPath = '/path/to/wdio.config.js'
            const wdioDirName = dirname(configPath)
            const spyFactory = vi.spyOn(workerFactory, 'generate')

            // Execute
            const result = await workerManager.getConnection(configPath)

            // Assert
            expect(spyFactory).toHaveBeenCalledTimes(1)
            expect(spyFactory).toHaveBeenCalledWith('#1', wdioDirName)
            expect(result).toBeDefined()
            expect(result.cid).toBe('#1')
        })

        it('should increment the id for each new worker', async () => {
            // Setup - create first worker
            const spyFactory = vi.spyOn(workerFactory, 'generate')
            await workerManager.getConnection('/path/to/wdio.config.js')

            // Execute - create second worker with different path
            await workerManager.getConnection('/another/path/wdio.config.js')

            // Assert
            expect(spyFactory).toHaveBeenCalledTimes(2)
            expect(spyFactory).toHaveBeenCalledWith('#1', '/path/to')
            expect(spyFactory).toHaveBeenCalledWith('#2', '/another/path')
        })
    })

    describe('dispose', () => {
        it('should stop all workers', async () => {
            // Setup - create worker
            const worker1 = await workerManager.getConnection('/path/to/wdio.config.js')
            const worker2 = await workerManager.getConnection('/another/path/wdio.config.js')
            const spyWorkerStop1 = vi.spyOn(worker1, 'stop')
            const spyWorkerStop2 = vi.spyOn(worker2, 'stop')
            // Execute
            await workerManager.dispose()

            // Assert - All worker was called `stop`
            expect(spyWorkerStop1).toHaveBeenCalledTimes(1)
            expect(spyWorkerStop2).toHaveBeenCalledTimes(1)
        })
    })

    describe('reorganize', () => {
        it('should stop unnecessary workers and start new ones', async () => {
            const oldWorker1 = await workerManager.getConnection('/path/to/wdio.config.js')
            const oldWorker2 = await workerManager.getConnection('/another/path/wdio.config.js')

            const spyWorkerStop1 = vi.spyOn(oldWorker1, 'stop')
            const spyWorkerStop2 = vi.spyOn(oldWorker2, 'stop')
            const spyFactory = vi.spyOn(workerFactory, 'generate')

            // Execute - reorganize with different paths
            await workerManager.reorganize(['/path/to/wdio.config.js', '/new/path/wdio.config.js'])

            // Assert
            // Should stop one worker
            expect(workerFactory.generatedWorkers.length).toBe(3)
            expect(spyWorkerStop1).not.toHaveBeenCalled()
            expect(spyWorkerStop2).toHaveBeenCalledTimes(1)

            // Should create one new worker
            expect(spyFactory).toHaveBeenCalledTimes(1)
            expect(spyFactory).toHaveBeenCalledWith('#3', normalize('/new/path'))
        })
    })

    describe('operation queueing', () => {
        it('should queue operations and execute them sequentially', async () => {
            // Setup
            const operations = [] as string[]

            // Create a delayed function to simulate async operations
            const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

            // Mock createWorker to add delay and tracking
            const originalCreateWorker = (workerManager as any).createWorker.bind(workerManager)
            vi.spyOn(workerManager as any, 'createWorker').mockImplementation((async (
                id: number,
                configPath: string
            ) => {
                operations.push(`start:${configPath}`)
                await delay(10) // Small delay to ensure timing
                return originalCreateWorker(id, configPath)
            }) as any)

            // Execute multiple operations concurrently
            const promise1 = workerManager.getConnection('/path/1/wdio.config.js')
            const promise2 = workerManager.getConnection('/path/2/wdio.config.js')
            const promise3 = workerManager.getConnection('/path/3/wdio.config.js')

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
            const originalCreateWorker = (workerManager as any).createWorker.bind(workerManager)
            vi.spyOn(workerManager as any, 'createWorker').mockImplementation((async (
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
                .map(() => workerManager.getConnection('/same/path/wdio.config.js'))

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
            const spyFactory = vi.spyOn(workerFactory, 'generate')

            // Access private method using any cast
            const startWorker = (workerManager as any).startWorker.bind(workerManager)

            // Execute
            const result = await startWorker(id, configPath)

            // Assert
            expect(spyFactory).toHaveBeenCalledTimes(1)
            expect(spyFactory).toHaveBeenCalledWith('#42', configPath)
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
            const startWorker = (workerManager as any).startWorker.bind(workerManager)

            // Execute two concurrent calls with same path
            const promise1 = startWorker(id1, configPath)
            const promise2 = startWorker(id2, configPath)

            // Wait for both to complete
            const [result1, result2] = await Promise.all([promise1, promise2])

            // Assert
            // expect(createWorkerCalls).toBe(1) // Only one actual worker creation
            expect(result1).toBe(result2) // Should be the same worker instance
        })
    })

    describe('stopWorker', () => {
        it('should stop a worker and remove it from the server pool', async () => {
            // Setup - create a worker first
            await workerManager.getConnection('/path/to/wdio.config.js')

            // Access private methods using any cast
            const stopWorker = (workerManager as any).stopWorker.bind(workerManager)

            // Get the worker from the server pool
            const worker = (workerManager as any)._workerPool.get('/path/to')

            // Execute
            await stopWorker('/path/to', worker)

            // Assert
            expect(worker.stop).toHaveBeenCalledTimes(1)
            expect((workerManager as any)._workerPool.has('/path/to')).toBe(false)
        })

        it('should return the same promise for concurrent stop calls', async () => {
            // Setup - create a worker first
            await workerManager.getConnection('/path/to/wdio.config.js')

            // Access private methods using any cast
            const stopWorker = (workerManager as any).stopWorker.bind(workerManager)

            // Get the worker from the server pool
            const worker = (workerManager as any)._workerPool.get('/path/to')

            // Add tracking
            let executeStopWorkerCalls = 0
            vi.spyOn(workerManager as any, 'executeStopWorker').mockImplementation(async () => {
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

    describe('Worker idle timeout', () => {
        it('should return the same promise for concurrent stop calls', async () => {
            // Setup - create worker
            const worker1 = await workerManager.getConnection('/path/to/wdio.config.js')
            const worker2 = await workerManager.getConnection('/another/path/wdio.config.js')

            const spyWorkerTimeout1 = vi.spyOn(worker1, 'updateIdleTimeout')
            const spyWorkerTimeout2 = vi.spyOn(worker2, 'updateIdleTimeout')

            const updateHandler = vi.mocked(mockConfigManager.on).mock.calls[1][1]

            // Execute
            updateHandler(987)
            // Assert - All worker was called `stop`
            expect(spyWorkerTimeout1).toHaveBeenCalledTimes(1)
            expect(spyWorkerTimeout1).toHaveBeenCalledWith(987)
            expect(spyWorkerTimeout2).toHaveBeenCalledTimes(1)
            expect(spyWorkerTimeout2).toHaveBeenCalledWith(987)
        })

        it('should stop worker when timeout occurred', async () => {
            // Setup - create worker
            const worker1 = await workerManager.getConnection('/path/to/wdio.config.js')
            const spyWorkerStop1 = vi.spyOn(worker1, 'stop')

            await workerManager.handleWorkerIdleTimeout('/path/to')

            expect(spyWorkerStop1).toHaveBeenCalledTimes(1)
        })
    })

    describe('Node path change', () => {
        it('should stop all worker when node path update', async () => {
            // Setup - create worker
            const worker1 = await workerManager.getConnection('/path/to/wdio.config.js')
            const worker2 = await workerManager.getConnection('/another/path/wdio.config.js')

            const spyWorkerStop1 = vi.spyOn(worker1, 'stop')
            const spyWorkerStop2 = vi.spyOn(worker2, 'stop')

            const updateHandler = vi.mocked(mockConfigManager.on).mock.calls[0][1]

            // Execute
            updateHandler('/path/to/node')

            // Assert - All worker was called `stop`
            expect(spyWorkerStop1).toHaveBeenCalledTimes(1)
            expect(spyWorkerStop2).toHaveBeenCalledTimes(1)
        })
    })
})
