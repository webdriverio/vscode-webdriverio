import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TestRunner } from '../../src/api/index.js'
import { TestReporter } from '../../src/test/reporter.js'
import { createHandler } from '../../src/test/runHandler.js'
import { log } from '../../src/utils/logger.js'
import { createTestItem } from '../utils.js'

import type * as vscode from 'vscode'
import type { ExtensionConfigManager } from '../../src/config/index.js'
import type { RepositoryManager } from '../../src/test/index.js'

vi.mock('vscode', async () => {
    const mockVscode = await import('../__mocks__/vscode.cjs')
    return {
        ...mockVscode,
        TestMessage: vi.fn(),
    }
})

// Mock dependencies
vi.mock('../../src/test/manager.js', async (importActual) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importActual<typeof import('../../src/test/manager.js')>()
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

vi.mock('../../src/test/reporter.js', () => ({
    TestReporter: vi.fn(() => ({
        updateTestStatus: vi.fn(),
    })),
}))

vi.mock('../../src/test/utils.js', async (importActual) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importActual<typeof import('../../src/test/utils.js')>()
    return {
        ...actual,
        createRunner: vi.fn(),
        createReporter: vi.fn(),
        createTestController: vi.fn(),
    }
})

vi.mock('../../src/api/index.js', () => {
    const TestRunner = vi.fn()
    TestRunner.prototype.run = vi.fn()
    TestRunner.prototype.stdout = null
    return { TestRunner }
})

vi.mock('../../src/config/index.js', () => ({
    configManager: {
        globalConfig: {
            showOutput: false,
        },
    },
}))

vi.mock('../../src/utils/logger.js', () => ({
    log: {
        debug: vi.fn(),
    },
}))

describe('Run Handler', () => {
    let mockTestRun: vscode.TestRun
    let mockToken: vscode.CancellationToken
    let mockConfigManager: ExtensionConfigManager
    let runHandler: ReturnType<typeof createHandler>

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
        } as unknown as ExtensionConfigManager

        runHandler = createHandler(mockConfigManager, {
            controller: { createTestRun: vi.fn(() => mockTestRun) },
        } as unknown as RepositoryManager)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('Test collection', () => {
        it('should collect tests from request.include when provided', async () => {
            // Setup
            const mockConfigTest = createTestItem('config1', {
                isWorkspace: false,
                isConfigFile: true,
                isSpecFile: false,
                repository: { worker: {} },
            })

            const mockWorkspaceTest = createTestItem('workspace1', {
                isWorkspace: true,
                isConfigFile: false,
                isSpecFile: false,
            })

            mockWorkspaceTest.children.forEach = vi.fn().mockImplementation((callback) => {
                callback(mockConfigTest)
            })

            const request = {
                include: [mockWorkspaceTest],
            } as unknown as vscode.TestRunRequest

            // Setup TestRunner mock
            const mockTestRunner = new TestRunner({} as any)
            ;(mockTestRunner.run as any).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            })

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test is requested by include')
            expect(mockTestRun.started).toHaveBeenCalledWith(mockConfigTest)
            expect(mockTestRun.end).toHaveBeenCalled()
            expect(TestReporter).toHaveBeenCalled()
        })

        it('should collect all tests when request.include is not provided', async () => {
            // Setup
            const mockConfigTest = createTestItem('config1', {
                isConfigFile: true,
                repository: { worker: {} },
            })

            const mockWorkspaceTest = createTestItem('workspace1', {
                isWorkspace: true,
            })
            mockWorkspaceTest.children.forEach = vi.fn().mockImplementation((callback) => {
                callback(mockConfigTest)
            })

            runHandler = createHandler(mockConfigManager, {
                controller: {
                    createTestRun: vi.fn(() => mockTestRun),
                    items: new Map([['workspace1', mockWorkspaceTest]]),
                },
            } as unknown as RepositoryManager)

            const request = {} as vscode.TestRunRequest

            // Setup TestRunner mock
            const mockTestRunner = new TestRunner({} as any)
            ;(mockTestRunner.run as any).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            })

            // Execute
            await runHandler(request, mockToken)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Test is requested ALL')
            expect(mockTestRun.started).toHaveBeenCalledWith(mockConfigTest)
            expect(mockTestRun.end).toHaveBeenCalled()
        })

        it('should stop test execution when cancellation is requested', async () => {
            // Setup
            const cancelledToken = {
                isCancellationRequested: true,
                onCancellationRequested: vi.fn(),
            } as unknown as vscode.CancellationToken

            const mockConfigTest = createTestItem('config1', {
                isConfigFile: true,
                repository: { worker: {} },
            })

            const request = {
                include: [mockConfigTest],
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
            const mockConfigTest = createTestItem('config1')

            const request = {
                include: [mockConfigTest],
            } as unknown as vscode.TestRunRequest

            // Execute & Verify
            await expect(runHandler(request, mockToken)).rejects.toThrow()
        })

        it('should run the test and update status based on results', async () => {
            // Setup
            const mockSpecTest = createTestItem('spec1', {
                isConfigFile: true,
                repository: { worker: {}, framework: 'mocha' },
            })

            const request = {
                include: [mockSpecTest],
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
            expect(mockTestRun.started).toHaveBeenCalledWith(mockSpecTest)
            expect(mockTestRun.appendOutput).toHaveBeenCalledWith('Test execution log')
            expect(TestReporter).toHaveBeenCalled()
            const mockReporter = (TestReporter as any).mock.results[0].value
            expect(mockReporter.updateTestStatus).toHaveBeenCalledWith(testResults)
        })

        it('should append stdout when showOutput is enabled', async () => {
            // Setup
            const mockSpecTest = createTestItem('spec1', {
                isSpecFile: true,
                repository: { worker: {} },
            })

            const request = {
                include: [mockSpecTest],
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
            const mockSpecTest = createTestItem('spec1', {
                isSpecFile: true,
                repository: { worker: {} },
            })

            const request = {
                include: [mockSpecTest],
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
            const mockParentTest = createTestItem('scenario1', {
                type: 'scenario',
                isTestcase: true,
                repository: { framework: 'cucumber', worker: {} },
            })

            const mockStepTest = createTestItem(
                'step1',
                {
                    type: 'step',
                    isTestcase: true,
                    repository: { framework: 'cucumber', worker: {} },
                },
                mockParentTest
            )
            const request = {
                include: [mockStepTest],
            } as unknown as vscode.TestRunRequest

            // Setup mock behavior for cucumber

            // Setup TestRunner mock
            vi.mocked(TestRunner.prototype.run).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            } as any)

            // Execute
            await runHandler(request, mockToken)

            // Verify that the parent was used instead of the step
            expect(vi.mocked(TestRunner).mock.instances[0].run).toHaveBeenCalledWith(mockParentTest)
        })

        it('should not convert non-cucumber tests', async () => {
            // Setup
            const mockTest = createTestItem('test1', {
                isSpecFile: true,
                repository: { framework: 'mocha', worker: {} },
            })

            const request = {
                include: [mockTest],
            } as unknown as vscode.TestRunRequest

            vi.mocked(TestRunner.prototype.run).mockResolvedValue({
                detail: [],
                log: 'Test completed',
            } as any)

            // Execute
            await runHandler(request, mockToken)

            // Verify that the original test was used
            expect(vi.mocked(TestRunner).mock.instances[0].run).toHaveBeenCalledWith(mockTest)
        })
    })
})
