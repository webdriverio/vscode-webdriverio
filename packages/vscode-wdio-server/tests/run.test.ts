import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createTestItem } from '../../../tests/utils.js'
import { TestRunner } from '../src/run.js'
import type { IWdioExtensionWorker } from '@vscode-wdio/types'
import type { ResultSet } from '@vscode-wdio/types/reporter'

// Mock dependencies
vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('../src/debug.js', () => ({}))

describe('TestRunner', () => {
    let testRunner: TestRunner
    let mockWorker: IWdioExtensionWorker
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
            idleMonitor: {
                pauseTimer: vi.fn(),
                resumeTimer: vi.fn(),
            },
        } as unknown as IWdioExtensionWorker

        // Create test runner instance
        testRunner = new TestRunner(mockWorker)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('run', () => {
        it('should successfully run a TestCase test item', async () => {
            // Create a test case test item
            const testData = createTestItem(['workspace', 'config', 'spec.js', 'MyTest'].join(TEST_ID_SEPARATOR), {
                isTestcase: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testData.testItem, testData.metadata)

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
                range: testData.testItem.range,
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
            const testData = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isSpecFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testData.testItem, testData.metadata)

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
            const testData = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testData.testItem, testData.metadata)

            // Verify RPC call was made with correct options
            expect(mockRpc.runTest).toHaveBeenCalledWith({
                configPath: '/test/path/wdio.conf.js',
                specs: [],
                grep: undefined,
                range: undefined,
            })

            // Verify result
            expect(result.success).toBe(true)
        })

        it('should handle cucumber framework for Scenario test item', async () => {
            // Create a cucumber scenario test item
            const testData = createTestItem(['workspace', 'config', 'spec.feater'].join(TEST_ID_SEPARATOR), {
                type: 'scenario',
                repository: { framework: 'cucumber', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Run the test
            const result = await testRunner.run(testData.testItem, testData.metadata)

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

            const scenarioChildData = createTestItem(
                ['workspace', 'config', 'spec.feater', 'rule', 'scenario'].join(TEST_ID_SEPARATOR),
                {
                    type: 'scenario',
                    isTestcase: true,
                    repository: { framework: 'cucumber', wdioConfigPath: '/test/path/wdio.conf.js' },
                }
            )
            const ruleItemData = createTestItem(
                ['workspace', 'config', 'spec.feater', 'rule'].join(TEST_ID_SEPARATOR),
                {
                    type: 'rule',
                    isTestcase: true,
                    repository: {
                        framework: 'cucumber',
                        getMetadata: vi.fn().mockReturnValue(scenarioChildData.metadata),
                        wdioConfigPath: '/test/path/wdio.conf.js',
                    },
                }
            )
            ;(ruleItemData.testItem.children as any) = new Map().set(0, scenarioChildData.testItem)

            // Run the test
            const result = await testRunner.run(ruleItemData.testItem, ruleItemData.metadata)

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

        it('should handle error during test execution', async () => {
            // Create a test item
            const testData = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Mock RPC to throw an error
            mockRpc.runTest.mockRejectedValue(new Error('Test execution failed'))

            // Run the test
            const result = await testRunner.run(testData.testItem, testData.metadata)

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
            const testData = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Prepare for test execution
            await testRunner.run(testData.testItem, testData.metadata)

            // Simulate stdout event by calling the handler
            const stdoutCb = vi.mocked(mockWorker.on).mock.calls[0][1]
            stdoutCb('Test output line 1')

            // Verify stdout was captured
            expect(testRunner.stdout).toBe('Test output line 1\n')
        })

        it('should capture stderr data', async () => {
            // Create a test item
            const testData = createTestItem(['workspace', 'config', 'spec.js'].join(TEST_ID_SEPARATOR), {
                isConfigFile: true,
                repository: { framework: 'mocha', wdioConfigPath: '/test/path/wdio.conf.js' },
            })

            // Prepare for test execution
            await testRunner.run(testData.testItem, testData.metadata)

            // Simulate stderr event by calling the handler
            const stderrCb = vi.mocked(mockWorker.on).mock.calls[1][1]
            stderrCb('Error output line 1')

            expect(testRunner.stderr).toBe('Error output line 1\n')
        })
    })
})
