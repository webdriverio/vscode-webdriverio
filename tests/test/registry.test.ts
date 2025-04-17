import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

import { TestRegistry } from '../../src/test/registry.js'
import { parseAndConvertTestData } from '../../src/test/converter.js'
import { TEST_ID_SEPARATOR } from '../../src/constants.js'
import { log } from '../../src/utils/logger.js'
import type { VscodeTestData } from '../../src/test/types.js'

// Mock dependencies
vi.mock('vscode', async () => import('../__mocks__/vscode.js'))
vi.mock('../../src/test/converter.js', async (importOriginal) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importOriginal<typeof import('../../src/test/converter.js')>()
    return {
        ...actual,
        convertTestData: vi.fn(),
        parseAndConvertTestData: vi.fn(),
    }
})
vi.mock('../../src/utils/logger', () => ({
    log: {
        debug: vi.fn(),
        error: vi.fn(),
    },
}))
vi.mock('node:fs/promises')

describe('TestRegistry', () => {
    const mockSpecUri = '/mock/workspace/test.spec.js'

    let testController: vscode.TestController
    let testRegistry: TestRegistry

    beforeEach(() => {
        vi.resetAllMocks()

        // Setup TestController mock
        testController = {
            createTestItem: vi.fn().mockImplementation((id, label, uri) => ({
                id,
                label,
                uri,
                children: {
                    add: vi.fn(),
                    replace: vi.fn(),
                    delete: vi.fn(),
                    forEach: vi.fn(),
                    get: vi.fn(),
                    has: vi.fn(),
                    size: 0,
                },
                range: undefined,
                parent: undefined,
            })),
            items: {
                add: vi.fn(),
                replace: vi.fn(),
                delete: vi.fn(),
                forEach: vi.fn(),
                get: vi.fn(),
                has: vi.fn(),
                size: 0,
            },
            dispose: vi.fn(),
            createRunProfile: vi.fn(),
            refreshTests: vi.fn(),
        } as unknown as vscode.TestController

        testRegistry = new TestRegistry(testController)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('constructor', () => {
        it('should initialize with provided TestController', () => {
            // Execute
            const registry = new TestRegistry(testController)

            // Verify
            expect(registry.controller).toBe(testController)
        })
    })

    describe('resisterSpecs', () => {
        it('should register spec files and create test items', async () => {
            // Setup
            const mockFileContent = 'describe("test suite", () => { it("test case", () => {}) })'
            const mockTestCases = [
                {
                    name: 'test suite',
                    type: 'describe',
                    uri: { fsPath: mockSpecUri, toString: () => `file://${mockSpecUri}` } as vscode.Uri,
                    range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10)),
                    children: [
                        {
                            name: 'test case',
                            type: 'test',
                            uri: { fsPath: mockSpecUri, toString: () => `file://${mockSpecUri}` } as vscode.Uri,
                            range: new vscode.Range(new vscode.Position(0, 20), new vscode.Position(0, 30)),
                            children: [],
                        },
                    ],
                },
            ] as unknown as VscodeTestData[]

            // Mocks
            vi.mocked(fs.readFile).mockResolvedValue(mockFileContent)
            vi.mocked(parseAndConvertTestData).mockResolvedValue(mockTestCases)

            const MockClass = class MockTestRegistry extends TestRegistry {
                protected readSpecFile(_filePath: string) {
                    return Promise.resolve(mockFileContent)
                }
            }
            const mockTestRegistry = new MockClass(testController)

            // Execute
            await mockTestRegistry.resisterSpecs([mockSpecUri])

            // Verify
            expect(parseAndConvertTestData).toHaveBeenCalledWith(mockFileContent, mockSpecUri)
            expect(testController.createTestItem).toHaveBeenCalledTimes(3) // File + Suite + Test
            expect(testController.items.add).toHaveBeenCalled()
        })

        it('should handle errors when registering spec files', async () => {
            // Setup
            const error = new Error('Failed to read file')
            vi.mocked(fs.readFile).mockRejectedValue(error)

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri])

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to register spec: ${mockSpecUri} - ${error.message}`)
        })

        it('should clear existing maps before registering new specs', async () => {
            // Setup
            const spyOnClear = vi.spyOn(Map.prototype, 'clear')
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri])

            // Verify
            expect(spyOnClear).toHaveBeenCalledTimes(2) // _suiteMap.clear() and _fileMap.clear()
        })

        it('should use custom parse function if provided', async () => {
            // Setup
            const mockFileContent = 'test content'
            const mockCustomParseFunction = vi.fn().mockReturnValue([])

            vi.mocked(fs.readFile).mockResolvedValue(mockFileContent)

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri], mockCustomParseFunction)

            // Verify
            expect(mockCustomParseFunction).toHaveBeenCalledWith(mockFileContent, mockSpecUri)
            expect(parseAndConvertTestData).not.toHaveBeenCalled()
        })
    })

    describe('readSpecFile', () => {
        it('should read file content with UTF-8 encoding', async () => {
            // Setup
            const filePath = '/path/to/file'
            const fileContent = 'file content'
            vi.mocked(fs.readFile).mockResolvedValue(fileContent)

            const MockClass = class MockTestRegistry extends TestRegistry {
                public _readSpecFile(filePath: string) {
                    return this.readSpecFile(filePath)
                }
            }
            const mockTestRegistry = new MockClass(testController)

            // Execute
            const result = await mockTestRegistry._readSpecFile(filePath)

            // Verify
            expect(fs.readFile).toHaveBeenCalledWith(filePath, { encoding: 'utf8' })
            expect(result).toBe(fileContent)
        })
    })

    describe('convertPathToId', () => {
        it('should normalize the provided path', () => {
            // Setup
            const testPath = '\\path\\to\\file'
            const normalizedPath = path.normalize(testPath)

            // Execute
            const result = testRegistry.convertPathToId(testPath)

            // Verify
            expect(result).toBe(normalizedPath)
        })
    })

    describe('searchSuite', () => {
        it('should find suite by name in parent', () => {
            // Setup
            const suiteName = 'test suite'
            const parentId = 'parent-id'
            const suiteId = `${parentId}${TEST_ID_SEPARATOR}${suiteName}`
            const mockParent = { id: parentId } as vscode.TestItem
            const mockSuite = { id: suiteId } as vscode.TestItem

            // Set the suite in the map
            ;(testRegistry as any)._suiteMap.set(suiteId, mockSuite)

            // Execute
            const result = testRegistry.searchSuite(suiteName, mockParent)

            // Verify
            expect(result).toBe(mockSuite)
        })

        it('should search recursively in parent hierarchy', () => {
            // Setup
            const suiteName = 'test suite'
            const grandParentId = 'grandparent-id'
            const parentId = 'parent-id'
            const suiteId = `${grandParentId}${TEST_ID_SEPARATOR}${suiteName}`

            const mockGrandParent = { id: grandParentId }
            const mockParent = {
                id: parentId,
                parent: mockGrandParent,
            } as vscode.TestItem
            const mockSuite = { id: suiteId }

            // Set the suite in the map
            ;(testRegistry as any)._suiteMap.set(suiteId, mockSuite)

            // Execute
            const result = testRegistry.searchSuite(suiteName, mockParent)

            // Verify
            expect(result).toBe(mockSuite)
        })

        it('should return undefined if suite is not found', () => {
            // Setup
            const suiteName = 'not found suite'
            const parentId = 'parent-id'
            const mockParent = { id: parentId } as vscode.TestItem

            // Execute
            const result = testRegistry.searchSuite(suiteName, mockParent)

            // Verify
            expect(result).toBeUndefined()
            expect(log.debug).toHaveBeenCalledWith(`proper test suite is not found: ${suiteName}`)
        })
    })

    describe('getSpecById', () => {
        it('should return spec file by path', () => {
            // Setup
            const specPath = '/path/to/spec.js'
            const normalizedPath = path.normalize(specPath)
            const mockSpec = { id: normalizedPath }

            // Set the file in the map
            ;(testRegistry as any)._fileMap.set(normalizedPath, mockSpec)

            // Execute
            const result = testRegistry.getSpecById(specPath)

            // Verify
            expect(result).toBe(mockSpec)
        })

        it('should handle file URL format paths', () => {
            // Setup
            const fileUrl = 'file:///path/to/spec.js'
            const filePath = '/path/to/spec.js'
            const normalizedPath = path.normalize(filePath)
            const mockSpec = { id: normalizedPath } as vscode.TestItem
            ;(testRegistry as any)._fileMap.set(normalizedPath, mockSpec)

            // Execute
            const result = testRegistry.getSpecById(fileUrl)

            // Verify
            expect(result).toBe(mockSpec)
        })
    })

    describe('dispose', () => {
        it('should clear all maps', () => {
            // Setup
            const spyOnSuiteMapClear = vi.spyOn((testRegistry as any)._suiteMap, 'clear')
            const spyOnFileMapClear = vi.spyOn((testRegistry as any)._fileMap, 'clear')

            // Execute
            testRegistry.dispose()

            // Verify
            expect(spyOnSuiteMapClear).toHaveBeenCalled()
            expect(spyOnFileMapClear).toHaveBeenCalled()
        })
    })
})
