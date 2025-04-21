import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

import { TestRepository } from '../../src/test/repository.js'
import { parseAndConvertTestData } from '../../src/test/converter.js'
import { TEST_ID_SEPARATOR } from '../../src/constants.js'
import { log } from '../../src/utils/logger.js'
import { configManager } from '../../src/config/index.js'
import type { VscodeTestData } from '../../src/test/types.js'
import type { ConfigParser } from '@wdio/config/node'
import type * as ConverterModule from '../../src/test/converter.js'
import { fileURLToPath } from 'node:url'

// Mock dependencies
vi.mock('vscode', async () => import('../__mocks__/vscode.js'))
vi.mock('../../src/test/converter.js', async (importOriginal) => {
    const actual = await importOriginal<typeof ConverterModule>()
    return {
        ...actual,
        convertPathToUri: vi.fn((path) => ({ fsPath: path, toString: () => `file://${path}` })),
        parseAndConvertTestData: vi.fn(),
    }
})
vi.mock('../../src/utils/logger.js', () => ({
    log: {
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
}))
vi.mock('../../src/config/index.js', () => ({
    configManager: {
        getWdioConfig: vi.fn(),
    },
}))
vi.mock('node:fs/promises')

describe('TestRegistry', () => {
    const mockSpecUri = 'file:///mock/workspace/test.spec.js'
    const mockSpecUri2 = 'file:///mock/workspace/test2.spec.js'

    // Create mock test data
    const createMockTestData = (name: string, type: 'describe' | 'it' | 'test', specPath: string): VscodeTestData => ({
        name,
        type,
        uri: { fsPath: specPath, toString: () => `file://${specPath}` } as vscode.Uri,
        range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 10)),
        children: [],
    })

    // Mock objects
    let testController: vscode.TestController
    let loadingTestItem: vscode.TestItem
    let testRegistry: TestRepository
    let mockConfig: ConfigParser

    // Setup mocks before each test
    beforeEach(() => {
        vi.resetAllMocks()

        // Mock loading test item
        loadingTestItem = {
            id: '_resolving',
            label: 'Resolving WebDriverIO...',
            busy: false,
            children: {
                add: vi.fn(),
                replace: vi.fn(),
                delete: vi.fn(),
                forEach: vi.fn(),
                get: vi.fn(),
                has: vi.fn(),
                size: 0,
            },
        } as unknown as vscode.TestItem

        // Setup TestController mock
        testController = {
            createTestItem: vi.fn().mockImplementation((id, label, uri) => ({
                id,
                label,
                uri,
                busy: false,
                children: {
                    add: vi.fn(),
                    replace: vi.fn(),
                    delete: vi.fn(),
                    forEach: vi.fn((callback) => {
                        // Simple mock implementation for forEach
                        const mockChildren = [
                            { id: `${id}${TEST_ID_SEPARATOR}child1`, label: 'Child 1' },
                            { id: `${id}${TEST_ID_SEPARATOR}child2`, label: 'Child 2' },
                        ]
                        mockChildren.forEach(callback)
                    }),
                    get: vi.fn(),
                    has: vi.fn(),
                    size: 2,
                },
                range: undefined,
                parent: undefined,
            })),
            items: {
                add: vi.fn(),
                replace: vi.fn(),
                delete: vi.fn(),
                forEach: vi.fn(),
                get: vi.fn((id) => (id === '_resolving' ? loadingTestItem : undefined)),
                has: vi.fn((id) => id === '_resolving'),
                size: 1,
            },
            dispose: vi.fn(),
            createRunProfile: vi.fn(),
            refreshTests: vi.fn(),
        } as unknown as vscode.TestController

        // Mock config
        mockConfig = {
            getSpecs: vi.fn(),
        } as unknown as ConfigParser

        vi.mocked(configManager.getWdioConfig).mockResolvedValue(mockConfig)

        // Create registry with mocked dependencies
        testRegistry = new TestRepository(testController, loadingTestItem)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    // Group 1: Initialization and basic functionality
    describe('Initialization and Resource Management', () => {
        it('should initialize with provided TestController and loading item', () => {
            // Verify
            expect(testRegistry.controller).toBe(testController)
            expect(loadingTestItem.busy).toBe(true)
            expect(testController.items.add).toHaveBeenCalledWith(loadingTestItem)
        })

        it('should dispose resources properly', () => {
            // Setup spies
            const spyOnSuiteMapClear = vi.spyOn((testRegistry as any)._suiteMap, 'clear')
            const spyOnFileMapClear = vi.spyOn((testRegistry as any)._fileMap, 'clear')

            // Execute
            testRegistry.dispose()

            // Verify
            expect(spyOnSuiteMapClear).toHaveBeenCalled()
            expect(spyOnFileMapClear).toHaveBeenCalled()
        })

        it('should remove loading item from display', () => {
            // Execute
            testRegistry.removeLoadingItem()

            // Verify
            expect(loadingTestItem.busy).toBe(false)
            expect(testController.items.delete).toHaveBeenCalledWith('_resolving')
        })

        it('should clear all tests from registry', () => {
            // Setup spies
            const spyOnSuiteMapClear = vi.spyOn((testRegistry as any)._suiteMap, 'clear')
            const spyOnFileMapClear = vi.spyOn((testRegistry as any)._fileMap, 'clear')

            // Execute
            testRegistry.clearTests()

            // Verify
            expect(spyOnSuiteMapClear).toHaveBeenCalled()
            expect(spyOnFileMapClear).toHaveBeenCalled()
            expect(testController.items.replace).toHaveBeenCalledWith([loadingTestItem])
            expect(loadingTestItem.busy).toBe(true)
            expect(log.debug).toHaveBeenCalledWith('Clearing all tests from registry')
        })
    })

    // Group 2: Test File Registration
    describe('Spec File Registration', () => {
        it('should register spec files and create test items', async () => {
            // Setup
            const mockFileContent = 'describe("test suite", () => { it("test case", () => {}) })'
            const mockTestCases = [createMockTestData('test suite', 'describe', mockSpecUri)]
            mockTestCases[0].children = [createMockTestData('test case', 'it', mockSpecUri)]

            // Mocks
            vi.mocked(fs.readFile).mockResolvedValue(mockFileContent)
            vi.mocked(parseAndConvertTestData).mockResolvedValue(mockTestCases)

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri])

            // Verify
            expect(parseAndConvertTestData).toHaveBeenCalledWith(mockFileContent, mockSpecUri)
            expect(testController.createTestItem).toHaveBeenCalledTimes(3) // File + Suite + Test
            expect(testController.items.replace).toHaveBeenCalled()
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
            const spyClear = vi.spyOn(Map.prototype, 'clear')
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri])

            // Verify
            expect(spyClear).toHaveBeenCalledTimes(2) // _suiteMap.clear() and _fileMap.clear()
        })

        it('should preserve existing items when clearExisting is false', async () => {
            // Setup
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            // Mock existing items
            const existingItems = [{ id: 'existing-item' }]
            vi.mocked(testController.items.replace).mockImplementation(() => undefined)
            vi.spyOn(Array, 'from').mockReturnValueOnce([['existing-item', existingItems[0]]])

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri], false)

            // Verify
            expect(testController.items.replace).toHaveBeenCalled()

            // Get the replaced items array from the call
            const replacedItemsCall = vi.mocked(testController.items.replace).mock.calls[0][0]

            // Ensure it includes items that weren't being reloaded
            expect(replacedItemsCall).toBeDefined()
            expect(Array.isArray(replacedItemsCall)).toBe(true)
        })

        it('should use custom parse function if provided', async () => {
            // Setup
            const mockFileContent = 'test content'
            const mockCustomParseFunction = vi.fn().mockResolvedValue([])

            vi.mocked(fs.readFile).mockResolvedValue(mockFileContent)

            // Execute
            await testRegistry.resisterSpecs([mockSpecUri], true, mockCustomParseFunction)

            // Verify
            expect(mockCustomParseFunction).toHaveBeenCalledWith(mockFileContent, mockSpecUri)
            expect(parseAndConvertTestData).not.toHaveBeenCalled()
        })

        it('should read file content with UTF-8 encoding', async () => {
            // Setup
            const filePath = '/path/to/file'
            const fileContent = 'file content'
            vi.mocked(fs.readFile).mockResolvedValue(fileContent)

            // Create test instance with access to protected method
            const MockClass = class MockTestRegistry extends TestRepository {
                public async _readSpecFile(filePath: string) {
                    return await this.readSpecFile(filePath)
                }
            }
            const mockTestRegistry = new MockClass(testController, loadingTestItem)

            // Execute
            const result = await mockTestRegistry._readSpecFile(filePath)

            // Verify
            expect(fs.readFile).toHaveBeenCalledWith(filePath, { encoding: 'utf8' })
            expect(result).toBe(fileContent)
        })
    })

    // Group 3: Test Discovery
    describe('Test Discovery', () => {
        it('should discover and register test specs from configuration', async () => {
            // Setup
            const mockSpecFiles = ['file:///mock/workspace/test/spec1.js', 'file:///mock/workspace/test/spec2.js']
            vi.mocked(mockConfig.getSpecs).mockReturnValue(mockSpecFiles)
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            // Execute
            await testRegistry.discoverAllTests()

            // Verify
            expect(configManager.getWdioConfig).toHaveBeenCalled()
            expect(mockConfig.getSpecs).toHaveBeenCalled()
            expect(log.debug).toHaveBeenCalledWith('Loaded configuration successfully.')
            expect(fs.readFile).toHaveBeenCalledTimes(2)
            expect(loadingTestItem.busy).toBe(false)
        })

        it('should handle array of spec files correctly', async () => {
            // Setup
            const mockSpecFilesAsArray = [
                ['file:///mock/workspace/test/spec1.js', 'file:///mock/workspace/test/spec2.js'],
                'file:///mock/workspace/test/spec3.js',
            ]
            vi.mocked(mockConfig.getSpecs).mockReturnValue(mockSpecFilesAsArray)
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            // Create spy on the resisterSpecs method
            const resisterSpecsSpy = vi.spyOn(testRegistry, 'resisterSpecs')

            // Execute
            await testRegistry.discoverAllTests()

            // Verify
            expect(resisterSpecsSpy).toHaveBeenCalled()
            const registeredSpecs = resisterSpecsSpy.mock.calls[0][0]
            expect(registeredSpecs).toHaveLength(3) // Total number of specs across all arrays
        })

        it('should handle error when getting config fails', async () => {
            // Setup
            const errorMessage = 'Failed to load configuration'
            vi.mocked(configManager.getWdioConfig).mockRejectedValue(new Error(errorMessage))

            // Execute
            await testRegistry.discoverAllTests()

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to discover tests: ${errorMessage}`)
            expect(loadingTestItem.busy).toBe(false)
        })

        it('should remove loading item when no specs are found', async () => {
            // Setup
            vi.mocked(mockConfig.getSpecs).mockReturnValue([])

            // Execute
            await testRegistry.discoverAllTests()

            // Verify
            expect(loadingTestItem.busy).toBe(false)
            expect(log.debug).toHaveBeenCalledWith('No spec files found in configuration')
        })
    })

    // Group 4: File Reloading
    describe('File Reloading', () => {
        beforeEach(() => {
            // Setup file map with mock spec files
            ;(testRegistry as any)._fileMap.set(path.normalize(mockSpecUri), { id: mockSpecUri, busy: false })
            ;(testRegistry as any)._fileMap.set(path.normalize(mockSpecUri2), {
                id: mockSpecUri2,
                busy: false,
            })
        })

        it('should reload specific spec files', async () => {
            // Setup
            const mockSpecFiles = [
                'file:///mock/workspace/test/spec1.js',
                'file:///mock/workspace/test/spec2.js',
                mockSpecUri,
            ]
            vi.mocked(mockConfig.getSpecs).mockReturnValue(mockSpecFiles)
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            // Spy on resisterSpecs method
            const resisterSpecsSpy = vi.spyOn(testRegistry, 'resisterSpecs')

            // Execute
            await testRegistry.reloadSpecFiles([mockSpecUri])

            // Verify
            expect(configManager.getWdioConfig).toHaveBeenCalled()
            expect(resisterSpecsSpy).toHaveBeenCalledWith([fileURLToPath(mockSpecUri)], false)
            expect(log.debug).toHaveBeenCalledWith('Reloading 1 spec files')
        })

        it('should set and reset busy state for reloaded files', async () => {
            // Setup
            const mockSpecItem = { id: fileURLToPath(mockSpecUri), busy: false } as vscode.TestItem

            ;(testRegistry as any)._fileMap = new Map([[fileURLToPath(mockSpecUri), mockSpecItem]])

            const removeSpecFileSpy = vi.spyOn(testRegistry, 'removeSpecFile').mockReturnValue()

            vi.mocked(mockConfig.getSpecs).mockReturnValue([mockSpecUri])
            vi.mocked(fs.readFile).mockResolvedValue('test content')
            vi.mocked(parseAndConvertTestData).mockResolvedValue([])

            const originalResisterSpecs = testRegistry.resisterSpecs
            testRegistry.resisterSpecs = vi.fn(async (_specs, _clear, _parser) => {
                expect(mockSpecItem.busy).toBe(true)
                return Promise.resolve()
            }) as any

            // Execute
            await testRegistry.reloadSpecFiles([mockSpecUri])

            // Verify
            expect(removeSpecFileSpy).toHaveBeenCalledWith(fileURLToPath(mockSpecUri))
            expect(mockSpecItem.busy).toBe(false)

            testRegistry.resisterSpecs = originalResisterSpecs
        })

        it('should handle errors during reload', async () => {
            // Setup
            const errorMessage = 'Failed to reload'
            vi.mocked(configManager.getWdioConfig).mockRejectedValue(new Error(errorMessage))

            // Execute
            await testRegistry.reloadSpecFiles([mockSpecUri])

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to reload spec files: ${errorMessage}`)
        })

        it('should handle case when no matching spec files found', async () => {
            // Setup
            vi.mocked(mockConfig.getSpecs).mockReturnValue(['file:///some/other/file.js'])

            // Execute
            await testRegistry.reloadSpecFiles([mockSpecUri])

            // Verify
            expect(log.debug).toHaveBeenCalledWith('No matching spec files found for reload')
        })
    })

    // Group 5: Search and Reference
    describe('Search and Reference Functions', () => {
        it('should convert path to normalized ID', () => {
            // Setup
            const testPath = '\\path\\to\\file'
            const normalizedPath = path.normalize(testPath)

            // Execute
            const result = testRegistry.convertPathToId(testPath)

            // Verify
            expect(result).toBe(normalizedPath)
        })

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

        it('should correctly remove a spec file and its suites', () => {
            // Setup
            const specPath = mockSpecUri
            const normalizedPath = path.normalize(specPath)

            // Create mock file and suites
            const mockFile = {
                id: normalizedPath,
                children: {
                    forEach: vi.fn((callback) => {
                        callback({ id: `${normalizedPath}${TEST_ID_SEPARATOR}suite1` })
                        callback({ id: `${normalizedPath}${TEST_ID_SEPARATOR}suite2` })
                    }),
                },
            } as unknown as vscode.TestItem

            // Set up the maps
            ;(testRegistry as any)._fileMap.set(normalizedPath, mockFile)
            ;(testRegistry as any)._suiteMap.set(`${normalizedPath}${TEST_ID_SEPARATOR}suite1`, {
                id: `${normalizedPath}${TEST_ID_SEPARATOR}suite1`,
            })
            ;(testRegistry as any)._suiteMap.set(`${normalizedPath}${TEST_ID_SEPARATOR}suite2`, {
                id: `${normalizedPath}${TEST_ID_SEPARATOR}suite2`,
            })

            // Spy on removeNestedSuites
            const removeNestedSuitesSpy = vi.spyOn(testRegistry as any, 'removeNestedSuites')

            // Execute
            testRegistry.removeSpecFile(specPath)

            // Verify
            expect(testController.items.delete).toHaveBeenCalledWith(normalizedPath)
            expect(removeNestedSuitesSpy).toHaveBeenCalledTimes(2)
            expect((testRegistry as any)._fileMap.has(normalizedPath)).toBe(false)
            expect((testRegistry as any)._suiteMap.has(`${normalizedPath}${TEST_ID_SEPARATOR}suite1`)).toBe(false)
            expect((testRegistry as any)._suiteMap.has(`${normalizedPath}${TEST_ID_SEPARATOR}suite2`)).toBe(false)
        })
    })
})
