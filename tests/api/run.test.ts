import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { TestRunner } from '../../src/api/run.js'
import { TEST_ID_SEPARATOR } from '../../src/constants.js'
import { createTestItem } from '../utils.js'

import type { WdioExtensionWorkerInterface } from '../../src/api/types.js'
import type { ResultSet } from '../../src/reporter/types.js'

// Mock dependencies
vi.mock('vscode', () => import('../__mocks__/vscode.cjs'))

vi.mock('../../src/utils/logger', () => ({
    log: {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))
vi.mock('../../src/api/debug.js', () => ({

}))

describe('TestRunner', () => {
    let testRunner: TestRunner
    let mockWorker: WdioExtensionWorkerInterface
    let mockRpc: any

    beforeEach(() => {
        vi.resetAllMocks()

        // Create mock worker
        mockRpc = {
            runTest: vi.fn().mockResolvedValue({
                success: true,
                json: [] as ResultSet[],
                stdout: 'Test execution output',
                error: undefined,
            }),
        }

        mockWorker = {
            on: vi.fn(),
            removeListener: vi.fn(),
            ensureConnected: vi.fn().mockResolvedValue(undefined),
            rpc: mockRpc,
        } as unknown as WdioExtensionWorkerInterface

        // Create test runner instance
        testRunner = new TestRunner(mockWorker)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('run', () => {
        it('should successfully run a TestCase test item', async () => {
            // Create a test case test item
            const testItem = createTestItem(['workspace', 'config', 'spec.js', 'MyTest'].join(TEST_ID_SEPARATOR), {
                isTestcase: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testItem)

            // Verify ensureConnected was called
            expect(mockWorker.ensureConnected).toHaveBeenCalled()

            // Verify event listeners were set up
            expect(mockWorker.on).toHaveBeenCalledTimes(2)
            expect(mockWorker.on).toHaveBeenCalledWith('stdout', expect.any(Function))
            expect(mockWorker.on).toHaveBeenCalledWith('stderr', expect.any(Function))

            // Verify RPC call was made with correct options
            expect(mockRpc.runTest).toHaveBeenCalledWith({
                configPath: '/test/path/wdio.conf.js',
                specs: ['/path/to/test.js'],
                grep: 'MyTest',
                range: testItem.range,
            })

            // Verify listeners were removed
            expect(mockWorker.removeListener).toHaveBeenCalledTimes(2)

            // Verify result
            expect(result).toEqual({
                success: true,
                duration: 0,
                detail: [],
                log: 'Test execution output',
                errorMessage: undefined,
            })
        })

        it('should successfully run a Spec test item', async () => {
            // Create a spec test item
            const testItem = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isSpecFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testItem)

            // Verify RPC call was made with correct options
            expect(mockRpc.runTest).toHaveBeenCalledWith({
                configPath: '/test/path/wdio.conf.js',
                specs: ['/path/to/test.js'],
                grep: undefined,
                range: undefined,
            })

            // Verify result
            expect(result.success).toBe(true)
        })

        it('should successfully run a Config test item', async () => {
            // Create a config test item
            const testItem = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testItem)

            // Verify RPC call was made with correct options
            expect(mockRpc.runTest).toHaveBeenCalledWith({
                configPath: '/test/path/wdio.conf.js',
                specs: ['/path/to/test.js'],
                grep: undefined,
                range: undefined,
            })

            // Verify result
            expect(result.success).toBe(true)
        })

        it('should handle cucumber framework for Scenario test item', async () => {
            // Create a cucumber scenario test item
            const testItem = createTestItem(['workspace', 'config', 'spec.feater'].join(TEST_ID_SEPARATOR), {
                type: 'scenario',
                repository: { framework: 'cucumber', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testItem)

            // Verify RPC call was made with correct cucumber options
            expect(mockRpc.runTest).toHaveBeenCalledWith({
                configPath: '/test/path/wdio.conf.js',
                specs: ['/path/to/test.js:11:21'],
                grep: undefined,
                range: undefined,
            })

            // Verify result
            expect(result.success).toBe(true)
        })

        it('should handle cucumber framework for Rule test item with scenario children', async () => {
            // Create a cucumber rule test item with scenario children

            const scenarioChild = createTestItem(
                ['workspace', 'config', 'spec.feater', 'rule', 'scenario'].join(TEST_ID_SEPARATOR),
                {
                    type: 'scenario',
                    repository: { framework: 'cucumber', wdioConfigPath: '/test/path/wdio.conf.js' },
                }
            )
            const ruleItem = createTestItem(['workspace', 'config', 'spec.feater', 'rule'].join(TEST_ID_SEPARATOR), {
                type: 'rule',
                repository: { framework: 'cucumber', wdioConfigPath: '/test/path/wdio.conf.js' },
            })
            ;(ruleItem.children as any) = new Map().set(0, scenarioChild)

            // Run the test
            const result = await testRunner.run(ruleItem)

            // Verify RPC call was made with correct cucumber options
            expect(mockRpc.runTest).toHaveBeenCalledWith({
                configPath: '/test/path/wdio.conf.js',
                specs: ['/path/to/test.js:11:21'],
                grep: undefined,
                range: undefined,
            })

            // Verify result
            expect(result.success).toBe(true)
        })

        it('should throw error for invalid test item', async () => {
            // Create an invalid test item (non-WebdriverIO test item)
            const testItem = createTestItem('invalid:test')

            // Run the test and expect error
            await expect(testRunner.run(testItem)).rejects.toThrow(
                "The metadata for TestItem is not set. This is extension's bug."
            )
        })

        it('should handle error during test execution', async () => {
            // Create a test item
            const testItem = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Mock RPC to throw an error
            mockRpc.runTest.mockRejectedValue(new Error('Test execution failed'))

            // Run the test
            const result = await testRunner.run(testItem)

            // Verify error handling
            expect(result).toEqual({
                success: false,
                errorMessage: 'Test execution failed',
                detail: [],
            })
        })
    })

    describe('stdout and stderr handling', () => {
        it('should capture stdout data', async () => {
            // Create a test item
            const testItem = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Prepare for test execution
            await testRunner.run(testItem)

            // Simulate stdout event by calling the handler
            const stdoutCb = vi.mocked(mockWorker.on).mock.calls[0][1]
            stdoutCb('Test output line 1')

            // Verify stdout was captured
            expect(testRunner.stdout).toBe('Test output line 1\n')
        })

        it('should capture stderr data', async () => {
            // Create a test item
            const testItem = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Prepare for test execution
            await testRunner.run(testItem)

            // Simulate stderr event by calling the handler
            const stderrCb = vi.mocked(mockWorker.on).mock.calls[1][1]
            stderrCb('Error output line 1')

            expect(testRunner.stderr).toBe('Error output line 1\n')
        })
    })
})
