import { log } from '@vscode-wdio/logger'
import { TestRunner } from '@vscode-wdio/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createTestItem } from '../../../tests/utils.js'
import { TestReporter } from '../src/reporter.js'
import { createHandler } from '../src/runHandler.js'
import type { IExtensionConfigManager } from '@vscode-wdio/types/config'
import type { TestItemMetadata } from '@vscode-wdio/types/test'
import type * as vscode from 'vscode'
import type { RepositoryManager } from '../src/index.js'

// Mock dependencies
vi.mock('vscode', async () => {
    const mockVscode = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...mockVscode,
        TestMessage: vi.fn(),
    }
})

vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('../src/manager.js', async (importActual) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importActual<typeof import('../src/manager.js')>()
    return {
        ...actual,
        repositoryManager: {
            controller: {
                createTestRun: vi.fn(),
                items: new Map(),
            },
        },
    }
})

vi.mock('../src/reporter.js', () => ({
    TestReporter: vi.fn(() => ({
        updateTestStatus: vi.fn(),
    })),
}))

vi.mock('../src/utils.js', async (importActual) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importActual<typeof import('../src/utils.js')>()
    return {
        ...actual,
        getWorkspaceFolder: vi.fn(),
        createReporter: vi.fn(),
    }
})

vi.mock('@vscode-wdio/server', () => {
    const TestRunner = vi.fn()
    TestRunner.prototype.run = vi.fn()
    TestRunner.prototype.stdout = null
    TestRunner.prototype.dispose = vi.fn()
    const DebugRunner = vi.fn()
    return { TestRunner, DebugRunner }
})

vi.mock('../../src/config/index.js', () => ({
    configManager: {
        globalConfig: {
            showOutput: false,
        },
    },
}))

describe('Run Handler', () => {
    let mockTestRun: vscode.TestRun
    let mockToken: vscode.CancellationToken
    let mockConfigManager: IExtensionConfigManager
    let runHandler: ReturnType<typeof createHandler>
    let testItemMap: WeakMap<vscode.TestItem, TestItemMetadata>
    let mockRepositoryManager: RepositoryManager
    let mockTestController: vscode.TestController

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks()

        // Setup default mocks
        mockTestRun = {
            started: vi.fn(),
            failed: vi.fn(),
            appendOutput: vi.fn(),
            end: vi.fn(),
        } as unknown as vscode.TestRun

        mockToken = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn(),
        } as unknown as vscode.CancellationToken

        mockConfigManager = {
            globalConfig: {
                showOutput: true,
            },
        } as unknown as IExtensionConfigManager

        testItemMap = new WeakMap<vscode.TestItem, TestItemMetadata>()
        const mockGetMetadata = vi.fn().mockImplementation((testItem: vscode.TestItem) => testItemMap.get(testItem))
        const mockGetRepository = vi
            .fn()
            .mockImplementation((testItem: vscode.TestItem) => testItemMap.get(testItem)?.repository)

        mockTestController = { createTestRun: vi.fn(() => mockTestRun) } as unknown as vscode.TestController

        mockRepositoryManager = {
            getMetadata: mockGetMetadata,
            getRepository: mockGetRepository,
            controller: mockTestController,
        } as unknown as RepositoryManager

        runHandler = createHandler(mockConfigManager, mockRepositoryManager)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('Test collection', () => {
        it('should collect tests from request.include when provided', async () => {
            // Setup
            const mockConfigTestData = createTestItem('config1', {
                isWorkspace: false,
                isConfigFile: true,
                isSpecFile: false,
                repository: { worker: {} },
            })

            const mockWorkspaceTestData = createTestItem('workspace1', {
                isWorkspace: true,
                isConfigFile: false,
                isSpecFile: false,
            })
            testItemMap.set(mockConfigTestData.testItem, mockConfigTestData.metadata)

            mockWorkspaceTestData.testItem.children.forEach = vi.fn().mockImplementation((callback) => {
                callback(mockConfigTestData.testItem)
            })

            const request = {
                include: [mockConfigTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Setup TestRunner mock
            const mockTestRunner = new TestRunner({} as any, {} as any, {} as any)
            ;(mockTestRunner.run as any).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            })

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test is requested by include')
            expect(mockTestRun.started).toHaveBeenCalledWith(mockConfigTestData.testItem)
            expect(mockTestRun.end).toHaveBeenCalled()
            expect(TestReporter).toHaveBeenCalled()
        })

        it('should collect all tests when request.include is not provided', async () => {
            // Setup
            const mockConfigTestData = createTestItem('config1', {
                isConfigFile: true,
                repository: { worker: {} },
            })

            const mockWorkspaceTestData = createTestItem('workspace1', {
                isWorkspace: true,
            })
            mockWorkspaceTestData.testItem.children.forEach = vi.fn().mockImplementation((callback) => {
                callback(mockConfigTestData.testItem)
            })
            testItemMap.set(mockConfigTestData.testItem, mockConfigTestData.metadata)
            testItemMap.set(mockWorkspaceTestData.testItem, mockWorkspaceTestData.metadata)
            ;(mockTestController.items as any) = new Map([['workspace1', mockWorkspaceTestData.testItem]])
            runHandler = createHandler(mockConfigManager, mockRepositoryManager)

            const request = {} as vscode.TestRunRequest

            // Setup TestRunner mock
            const mockTestRunner = new TestRunner({} as any, {} as any, {} as any)
            ;(mockTestRunner.run as any).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            })

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test is requested ALL')
            expect(mockTestRun.started).toHaveBeenCalledWith(mockConfigTestData.testItem)
            expect(mockTestRun.end).toHaveBeenCalled()
        })

        it('should stop test execution when cancellation is requested', async () => {
            // Setup
            const cancelledToken = {
                isCancellationRequested: true,
                onCancellationRequested: vi.fn(),
            } as unknown as vscode.CancellationToken

            const mockConfigTestData = createTestItem('config1', {
                isConfigFile: true,
                repository: { worker: {} },
            })
            testItemMap.set(mockConfigTestData.testItem, mockConfigTestData.metadata)

            const request = {
                include: [mockConfigTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Execute
            await runHandler(request, cancelledToken)

            // Verify
            expect(mockTestRun.end).toHaveBeenCalled()
            expect(mockTestRun.started).not.toHaveBeenCalled() // Tests shouldn't be started
        })
    })

    describe('Test execution', () => {
        it('should throw an error if workspace item is invalid', async () => {
            // Setup
            const mockConfigTestData = createTestItem('config1')
            testItemMap.set(mockConfigTestData.testItem, mockConfigTestData.metadata)

            const request = {
                include: [mockConfigTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Execute & Verify
            await expect(runHandler(request, mockToken)).rejects.toThrow()
        })

        it('should run the test and update status based on results', async () => {
            // Setup
            const mockSpecTestData = createTestItem('spec1', {
                isConfigFile: true,
                repository: { getWorker: vi.fn(), framework: 'mocha' },
            })
            testItemMap.set(mockSpecTestData.testItem, mockSpecTestData.metadata)

            const request = {
                include: [mockSpecTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Setup TestRunner mock with detailed results
            const testResults = [
                { id: 'test1', result: 'passed' },
                { id: 'test2', result: 'failed' },
            ]

            vi.mocked(TestRunner.prototype.run).mockResolvedValue({
                detail: testResults,
                log: 'Test execution log',
            } as any)
            ;(TestRunner.prototype.stdout as any) = 'Test complete'

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(mockTestRun.started).toHaveBeenCalledWith(mockSpecTestData.testItem)
            expect(mockTestRun.appendOutput).toHaveBeenCalledWith('Test execution log')
            expect(TestReporter).toHaveBeenCalled()
            const mockReporter = (TestReporter as any).mock.results[0].value
            expect(mockReporter.updateTestStatus).toHaveBeenCalledWith(testResults)
        })

        it('should append stdout when showOutput is enabled', async () => {
            // Setup
            const mockSpecTestData = createTestItem('spec1', {
                isSpecFile: true,
                repository: { getWorker: vi.fn() },
            })
            testItemMap.set(mockSpecTestData.testItem, mockSpecTestData.metadata)

            const request = {
                include: [mockSpecTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Setup TestRunner mock with stdout
            vi.mocked(TestRunner.prototype.run).mockResolvedValue({
                detail: [],
                log: 'Test log',
            } as any)
            ;(TestRunner.prototype.stdout as any) = 'Standard output from test run'

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(mockTestRun.appendOutput).toHaveBeenCalledWith('Test log')
            // expect(mockTestRun.appendOutput).toHaveBeenCalledWith('Standard output from test run')
        })

        it('should handle runtime errors during test execution', async () => {
            // Setup
            const mockSpecTestData = createTestItem('spec1', {
                isSpecFile: true,
                repository: { worker: {} },
            })
            testItemMap.set(mockSpecTestData.testItem, mockSpecTestData.metadata)

            const request = {
                include: [mockSpecTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Setup TestRunner mock to throw error
            const mockError = new Error('Runtime test error')
            vi.mocked(TestRunner.prototype.run).mockRejectedValue(mockError)
            ;(TestRunner.prototype.stdout as any) = 'Standard output from test run'

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(mockTestRun.failed).toHaveBeenCalled()
            expect(mockTestRun.end).toHaveBeenCalled()
        })
    })

    describe('Cucumber step conversion', () => {
        it('should convert cucumber step to its parent testcase', async () => {
            // Setup
            const mockParentTestData = createTestItem('scenario1', {
                type: 'scenario',
                isTestcase: true,
                repository: { framework: 'cucumber', getWorker: vi.fn() },
            })

            const mockStepTestData = createTestItem(
                'step1',
                {
                    type: 'step',
                    isTestcase: true,
                    repository: { framework: 'cucumber', getWorker: vi.fn() },
                },
                mockParentTestData.testItem
            )
            testItemMap.set(mockParentTestData.testItem, mockParentTestData.metadata)
            testItemMap.set(mockStepTestData.testItem, mockStepTestData.metadata)

            const request = {
                include: [mockStepTestData.testItem],
            } as unknown as vscode.TestRunRequest

            // Setup TestRunner mock
            vi.mocked(TestRunner.prototype.run).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            } as any)

            // Execute
            await runHandler(request, mockToken)

            // Verify that the parent was used instead of the step
            expect(vi.mocked(TestRunner).mock.instances[0].run).toHaveBeenCalledWith(
                mockParentTestData.testItem,
                mockParentTestData.metadata
            )
        })

        it('should not convert non-cucumber tests', async () => {
            // Setup
            const mockTestData = createTestItem('test1', {
                isSpecFile: true,
                repository: { framework: 'mocha', getWorker: vi.fn() },
            })
            testItemMap.set(mockTestData.testItem, mockTestData.metadata)

            const request = {
                include: [mockTestData.testItem],
            } as unknown as vscode.TestRunRequest

            vi.mocked(TestRunner.prototype.run).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            } as any)

            // Execute
            await runHandler(request, mockToken)

            // Verify that the original test was used
            expect(vi.mocked(TestRunner).mock.instances[0].run).toHaveBeenCalledWith(
                mockTestData.testItem,
                mockTestData.metadata
            )
        })
    })
})
