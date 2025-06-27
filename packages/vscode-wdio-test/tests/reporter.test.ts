import { log } from '@vscode-wdio/logger'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { TestReporter } from '../src/reporter.js'
import type { ResultSet, TestSuite, Test } from '@vscode-wdio/types/reporter'
import type { TestRepository } from '../src/repository.js'

// Mock dependencies
vi.mock('vscode', async () => {
    const mockModule = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...mockModule,
        TestMessage: vi.fn(),
    }
})
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))
vi.mock('../src/repository', () => ({}))

describe('TestReporter', () => {
    let mockRegistry: TestRepository
    let mockTestRun: vscode.TestRun
    let testReporter: TestReporter

    // Helper function to create mock TestItems
    function createMockTestItem(id: string, label: string, children: vscode.TestItem[] = []): vscode.TestItem {
        return {
            id,
            label,
            children: {
                forEach: (callback: (item: vscode.TestItem) => void) => {
                    children.forEach(callback)
                },
            },
        } as unknown as vscode.TestItem
    }

    // Helper function to create a mock test result
    function createMockResultSet(
        specs: string[] = [],
        suites: TestSuite[] = [],
        state = { passed: 0, failed: 0, skipped: 0 }
    ): ResultSet {
        return {
            specs,
            suites,
            state,
        } as ResultSet
    }

    // Helper function to create a mock test suite
    function createMockTestSuite(name: string, tests: Test[] = [], suites: TestSuite[] = [], duration = 0): TestSuite {
        return {
            name,
            tests,
            suites,
            duration,
        } as TestSuite
    }

    // Helper function to create a mock test
    function createMockTest(
        name: string,
        state: 'passed' | 'failed' | 'skipped' | 'pending' = 'passed',
        duration = 0,
        error?: { message: string }
    ): Test {
        return {
            name,
            state,
            duration,
            error,
        } as Test
    }

    beforeEach(() => {
        vi.resetAllMocks()

        // Setup mock repository
        mockRegistry = {
            getSpecByFilePath: vi.fn(), // Changed from getSpecById to getSpecByFilePath
        } as unknown as TestRepository

        // Setup mock test run
        mockTestRun = {
            passed: vi.fn(),
            failed: vi.fn(),
            skipped: vi.fn(),
            enqueued: vi.fn(),
            started: vi.fn(),
        } as unknown as vscode.TestRun

        // Create test reporter instance
        testReporter = new TestReporter(mockRegistry, mockTestRun)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('updateTestStatus', () => {
        it('should return false when no results are provided', () => {
            // Execute
            const result = testReporter.updateTestStatus([])

            // Verify
            expect(result).toBe(false)
            expect(log.debug).toHaveBeenCalledWith('No test results to update')
        })

        it('should return false when results parameter is undefined', () => {
            // Execute
            const result = testReporter.updateTestStatus(undefined as unknown as ResultSet[])

            // Verify
            expect(result).toBe(false)
            expect(log.debug).toHaveBeenCalledWith('No test results to update')
        })

        it('should return true when all tests passed', () => {
            // Setup
            const specPath = '/path/to/spec.js'
            const specTestItem = createMockTestItem(specPath, 'spec.js') as vscode.TestItem
            const mockSuite = createMockTestSuite('Test Suite')
            const mockResult = createMockResultSet([specPath], [mockSuite], { passed: 2, failed: 0, skipped: 0 })

            vi.mocked(mockRegistry.getSpecByFilePath).mockReturnValue(specTestItem)

            // Execute
            const result = testReporter.updateTestStatus([mockResult])

            // Verify
            expect(result).toBe(true)
            expect(mockRegistry.getSpecByFilePath).toHaveBeenCalledWith(specPath)
            expect(mockTestRun.passed).toHaveBeenCalledWith(specTestItem)
        })

        it('should return false when any test failed', () => {
            // Setup
            const specPath = '/path/to/spec.js'
            const specTestItem = createMockTestItem(specPath, 'spec.js') as vscode.TestItem
            const mockSuite = createMockTestSuite('Test Suite')
            const mockResult = createMockResultSet([specPath], [mockSuite], { passed: 1, failed: 1, skipped: 0 })

            vi.mocked(mockRegistry.getSpecByFilePath).mockReturnValue(specTestItem) // Changed from getSpecById to getSpecByFilePath

            // Execute
            const result = testReporter.updateTestStatus([mockResult])

            // Verify
            expect(result).toBe(false)
            expect(mockRegistry.getSpecByFilePath).toHaveBeenCalledWith(specPath) // Changed from getSpecById to getSpecByFilePath
            expect(mockTestRun.failed).toHaveBeenCalledWith(specTestItem, expect.any(vscode.TestMessage))
        })

        it('should handle errors and return false', () => {
            // Setup
            const specPath = '/path/to/spec.js'
            const mockResult = createMockResultSet([specPath], [], { passed: 1, failed: 0, skipped: 0 })

            // Force an error
            vi.mocked(mockRegistry.getSpecByFilePath).mockImplementation(() => {
                // Changed from getSpecById to getSpecByFilePath
                throw new Error('Test error')
            })

            // Execute
            const result = testReporter.updateTestStatus([mockResult])

            // Verify
            expect(result).toBe(false)
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining('Test error'))
        })

        it('should skip spec files not found in repository', () => {
            // Setup
            const specPath = '/path/to/spec.js'
            const mockResult = createMockResultSet([specPath], [], { passed: 1, failed: 0, skipped: 0 })

            vi.mocked(mockRegistry.getSpecByFilePath).mockReturnValue(undefined) // Changed from getSpecById to getSpecByFilePath

            // Execute
            const result = testReporter.updateTestStatus([mockResult])

            // Verify
            expect(result).toBe(true)
            expect(log.error).toHaveBeenCalledWith(expect.stringContaining(specPath))
        })
    })

    describe('processHierarchicalSuite', () => {
        it('should process tests and nested suites correctly', () => {
            // Setup - create a private method spy
            const processHierarchicalSuiteSpy = vi.spyOn(testReporter as any, '_processHierarchicalSuite')
            const processTestSpy = vi.spyOn(testReporter as any, '_processTest')
            const _updateSuiteStatusSpy = vi.spyOn(testReporter as any, '_updateSuiteStatus')

            // Create test structure
            const nestedSuiteItem = createMockTestItem('nested', 'nested')
            const suiteItem = createMockTestItem('suite', 'suite', [nestedSuiteItem])
            const parentItem = createMockTestItem('parent', 'parent', [suiteItem])

            const mockTest = createMockTest('Test 1')
            const mockNestedTest = createMockTest('Nested Test')
            const mockNestedSuite = createMockTestSuite('nested', [mockNestedTest])
            const mockSuite = createMockTestSuite('suite', [mockTest], [mockNestedSuite])

            // Execute - call the private method
            ;(testReporter as any)._processHierarchicalSuite(mockSuite, parentItem)

            // Verify
            expect(processTestSpy).toHaveBeenCalledWith(mockTest, suiteItem)
            expect(processHierarchicalSuiteSpy).toHaveBeenCalledWith(mockNestedSuite, suiteItem)
            expect(_updateSuiteStatusSpy).toHaveBeenCalledWith(suiteItem, mockSuite)
        })

        it('should skip suite when not found in repository', () => {
            // Setup
            const parentItem = createMockTestItem('parent', 'Parent')
            const mockSuite = createMockTestSuite('Suite', [])

            // Execute
            ;(testReporter as any)._processHierarchicalSuite(mockSuite, parentItem)

            // Verify
            expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('Suite'))
        })
    })

    describe('processTest', () => {
        it('should mark test as passed when state is passed', () => {
            // Setup
            const suiteItem = createMockTestItem('suite', 'Suite')
            const testItem = createMockTestItem('test', 'Test 1')
            const mockTest = createMockTest('Test 1', 'passed', 100)

            // Mock the children.forEach to return the test item
            suiteItem.children.forEach = (callback, collection) => {
                callback(testItem, collection)
            }

            // Execute
            ;(testReporter as any)._processTest(mockTest, suiteItem)

            // Verify
            expect(mockTestRun.passed).toHaveBeenCalledWith(testItem, 100)
        })

        it('should mark test as failed when state is failed', () => {
            // Setup
            const suiteItem = createMockTestItem('suite', 'Suite')
            const testItem = createMockTestItem('test', 'Test 1')
            const mockTest = createMockTest('Test 1', 'failed', 100, { message: 'Failed assertion' })

            // Mock the children.forEach
            suiteItem.children.forEach = (callback, collection) => {
                callback(testItem, collection)
            }

            // Execute
            ;(testReporter as any)._processTest(mockTest, suiteItem)

            // Verify
            expect(mockTestRun.failed).toHaveBeenCalledWith(testItem, expect.any(vscode.TestMessage), 100)
        })

        it('should mark test as skipped when state is skipped', () => {
            // Setup
            const suiteItem = createMockTestItem('suite', 'Suite')
            const testItem = createMockTestItem('test', 'Test 1')
            const mockTest = createMockTest('Test 1', 'skipped')

            // Mock the children.forEach
            suiteItem.children.forEach = (callback, collection) => {
                callback(testItem, collection)
            }

            // Execute
            ;(testReporter as any)._processTest(mockTest, suiteItem)

            // Verify
            expect(mockTestRun.skipped).toHaveBeenCalledWith(testItem)
        })

        it('should mark test as skipped when state is pending', () => {
            // Setup
            const suiteItem = createMockTestItem('suite', 'Suite')
            const testItem = createMockTestItem('test', 'Test 1')
            const mockTest = createMockTest('Test 1', 'pending')

            // Mock the children.forEach
            suiteItem.children.forEach = (callback, collection) => {
                callback(testItem, collection)
            }

            // Execute
            ;(testReporter as any)._processTest(mockTest, suiteItem)

            // Verify
            expect(mockTestRun.skipped).toHaveBeenCalledWith(testItem)
        })

        it('should skip test when not found in suite children', () => {
            // Setup
            const suiteItem = createMockTestItem('suite', 'Suite')
            const mockTest = createMockTest('Test 1', 'passed')

            // Mock empty children list
            suiteItem.children.forEach = (_callback) => {
                // No children to call callback with
            }

            // Execute
            ;(testReporter as any)._processTest(mockTest, suiteItem)

            // Verify
            expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('Test 1'))
            expect(mockTestRun.passed).not.toHaveBeenCalled()
        })
    })

    describe('_updateSuiteStatus', () => {
        it('should mark suite as passed when there are tests in the suite', () => {
            // Setup
            const suiteItem = createMockTestItem('suite', 'Suite')
            const mockTest = createMockTest('Test 1', 'passed', 100)
            const mockSuite = createMockTestSuite('Suite', [mockTest], [], 500)

            // Execute
            ;(testReporter as any)._updateSuiteStatus(suiteItem, mockSuite)

            // Verify
            expect(mockTestRun.passed).toHaveBeenCalledWith(suiteItem, 500)
        })
    })

    describe('updateSpecFileStatus', () => {
        it('should mark spec as passed when all tests passed', () => {
            // Setup
            const specItem = createMockTestItem('spec', 'spec.js')
            const mockResult = createMockResultSet(['/path/to/spec.js'], [], { passed: 2, failed: 0, skipped: 0 })

            // Execute
            ;(testReporter as any)._updateSpecFileStatus(specItem, mockResult)

            // Verify
            expect(mockTestRun.passed).toHaveBeenCalledWith(specItem)
        })

        it('should mark spec as failed when any test failed', () => {
            // Setup
            const specItem = createMockTestItem('spec', 'spec.js')
            const mockResult = createMockResultSet(['/path/to/spec.js'], [], { passed: 1, failed: 1, skipped: 0 })

            // Execute
            ;(testReporter as any)._updateSpecFileStatus(specItem, mockResult)

            // Verify
            expect(mockTestRun.failed).toHaveBeenCalledWith(specItem, expect.any(vscode.TestMessage))
        })

        it('should mark spec as skipped when all tests are skipped', () => {
            // Setup
            const specItem = createMockTestItem('spec', 'spec.js')
            const mockResult = createMockResultSet(['/path/to/spec.js'], [], { passed: 0, failed: 0, skipped: 2 })

            // Execute
            ;(testReporter as any)._updateSpecFileStatus(specItem, mockResult)

            // Verify
            expect(mockTestRun.skipped).toHaveBeenCalledWith(specItem)
        })
    })
})
