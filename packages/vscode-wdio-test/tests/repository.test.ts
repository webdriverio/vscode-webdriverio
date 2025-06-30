import { join } from 'node:path'

import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { mockCreateTestItem, MockTestItemCollection } from '../../../tests/utils.js'
import { TestRepository } from '../src/repository.js'
import type { IExtensionConfigManager, TestItemMetadata } from '@vscode-wdio/types'
import type { IWorkerManager, WdioConfig, IWdioExtensionWorker } from '@vscode-wdio/types/server'
import type { MetadataRepository } from '../src/metadata.js'

// Mock dependencies
vi.mock('vscode', async () => import('../../../tests/__mocks__/vscode.cjs'))

vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('@vscode-wdio/utils', async (importActual) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importActual<typeof import('@vscode-wdio/utils')>()
    return {
        ...actual,
        getEnvOptions: vi.fn(() => ({ paths: [], override: false })),
    }
})

class MockMetadataRepository {
    createTestMetadata = vi.fn()
    createSpecFileMetadata = vi.fn()
    createWdioConfigFileMetadata = vi.fn()
    createWorkspaceMetadata = vi.fn()
    _repo = new WeakMap<vscode.TestItem, TestItemMetadata>()
    getMetadata = vi.fn()
    getRepository = vi.fn()
}

describe('TestRepository', () => {
    const mockWorkspaceUri = vscode.Uri.file(join(process.cwd(), 'mock', 'workspace'))
    const mockSpecPath = join(process.cwd(), 'mock', 'workspace', 'e2e', 'test1.spec.js')
    const mockSpecPath2 = join(process.cwd(), 'mock', 'workspace', 'e2e', 'test2.spec.js')
    const mockSpecUri = vscode.Uri.file(mockSpecPath)
    const mockWdioConfigPath = join(process.cwd(), 'mock', 'workspace', 'wdio.conf.js')
    const mockWdioConfigUri = vscode.Uri.file(mockWdioConfigPath)

    // Mock objects
    let mockConfigManager: IExtensionConfigManager
    let testController: vscode.TestController
    let wdioConfigTestItem: vscode.TestItem
    let testRepository: TestRepository
    let mockWorker: IWdioExtensionWorker
    let mockReadSpecs: ReturnType<typeof vi.fn>
    let mockRunProfileDispose: ReturnType<typeof vi.fn>
    let workerManager: IWorkerManager
    let mockWorkspaceFolder: vscode.WorkspaceFolder

    beforeEach(() => {
        vi.resetAllMocks()

        // Setup TestController mock
        testController = {
            items: new MockTestItemCollection(),
            createTestItem: mockCreateTestItem,
        } as unknown as vscode.TestController

        wdioConfigTestItem = testController.createTestItem(
            `workspace:${mockWorkspaceUri.fsPath}${TEST_ID_SEPARATOR}config:${mockWdioConfigUri.fsPath}`,
            mockWdioConfigUri.fsPath,
            mockWdioConfigUri
        )
        mockRunProfileDispose = vi.fn()

        // Setup worker mock
        mockReadSpecs = vi.fn().mockResolvedValue([
            { spec: mockSpecPath, data: 'test content 1' },
            { spec: mockSpecPath2, data: 'test content 2' },
        ])

        mockConfigManager = vi.fn() as unknown as IExtensionConfigManager
        mockWorkspaceFolder = {
            uri: mockWorkspaceUri,
        } as unknown as vscode.WorkspaceFolder
        mockWorker = {
            on: vi.fn(),
            rpc: {
                loadWdioConfig: vi.fn().mockResolvedValue({
                    framework: 'mocha',
                    specs: [mockSpecPath, mockSpecPath2],
                }),
                readSpecs: mockReadSpecs,
            },
        } as unknown as IWdioExtensionWorker

        workerManager = {
            getConnection: vi.fn(() => mockWorker),
        } as unknown as IWorkerManager

        const mockMetaRepo = new MockMetadataRepository()
        mockMetaRepo.createWdioConfigFileMetadata(wdioConfigTestItem, {
            uri: mockWdioConfigUri,
            repository: {} as any,
            runProfiles: [],
        })

        mockMetaRepo.getMetadata.mockReturnValue({
            runProfiles: [
                {
                    dispose: mockRunProfileDispose,
                } as unknown as vscode.TestRunProfile,
            ],
        })

        // Create repository with mocked dependencies
        testRepository = new TestRepository(
            mockConfigManager,
            testController,
            mockWdioConfigPath,
            wdioConfigTestItem,
            workerManager,
            mockWorkspaceFolder,
            mockMetaRepo as unknown as MetadataRepository
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // Group 1: Initialization and basic functionality
    describe('Initialization and Resource Management', () => {
        it('should initialize with provided dependencies', async () => {
            // Verify
            expect(testRepository.controller).toBe(testController)
            expect(await testRepository.getWorker()).toBe(mockWorker)
            expect(testRepository.wdioConfigPath).toBe(mockWdioConfigPath)
        })

        it('should dispose resources properly', () => {
            // Setup spies
            const spyOnFileMapClear = vi.spyOn((testRepository as any)._fileMap, 'clear')

            // Execute
            testRepository.dispose()

            // Verify
            expect(mockRunProfileDispose).toHaveBeenCalled()
            expect(spyOnFileMapClear).toHaveBeenCalled()
        })

        it('should throw error if framework is accessed before loading config', () => {
            // Create new instance without loading config
            const repo = new TestRepository(
                mockConfigManager,
                testController,
                mockWdioConfigPath,
                wdioConfigTestItem,
                workerManager,
                mockWorkspaceFolder
            )

            // Verify
            expect(() => repo.framework).toThrow('The configuration for WebdriverIO is not loaded')
        })
    })

    describe('discoverAllTests', () => {
        it('should discover and register test specs from configuration', async () => {
            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(mockWorker.rpc.loadWdioConfig).toHaveBeenCalledWith({
                env: { paths: [], override: false },
                configFilePath: mockWdioConfigPath,
            })
            expect(mockWorker.rpc.readSpecs).toHaveBeenCalledWith({
                env: { paths: [], override: false },
                specs: [mockSpecPath, mockSpecPath2],
            })
            expect(testRepository.framework).toBe('mocha')
            expect(log.debug).toHaveBeenCalledWith(`Discovered ${2} spec files`)
        })

        it('should handle no specs case', async () => {
            // Setup
            vi.mocked(mockWorker.rpc.loadWdioConfig).mockResolvedValueOnce({
                framework: 'mocha',
                specs: [],
            } as unknown as WdioConfig)

            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(log.debug).toHaveBeenCalledWith('No spec files found in configuration')
            expect(mockWorker.rpc.readSpecs).not.toHaveBeenCalled()
        })

        it('should handle error when loading config fails', async () => {
            // Setup
            const errorMessage = 'Failed to load configuration'
            vi.mocked(mockWorker.rpc.loadWdioConfig).mockRejectedValueOnce(new Error(errorMessage))

            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to discover tests: ${errorMessage}`)
        })

        it('should handle error gracefully when loadWdioConfig throws an exception', async () => {
            // Setup
            const error = new Error('RPC communication error')
            vi.mocked(mockWorker.rpc.loadWdioConfig).mockImplementationOnce(() => {
                throw error
            })

            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to discover tests: ${error.message}`)
            expect(log.trace).toHaveBeenCalled()
            expect(mockWorker.rpc.readSpecs).not.toHaveBeenCalled()
        })
    })

    describe('reloadSpecFiles', () => {
        beforeEach(() => {
            // Setup file map with mock spec files
            const fileId1 = [wdioConfigTestItem.id, mockSpecPath].join(TEST_ID_SEPARATOR)
            const fileId2 = [wdioConfigTestItem.id, mockSpecPath2].join(TEST_ID_SEPARATOR)

            ;(testRepository as any)._fileMap.set(fileId1, {
                id: fileId1,
                busy: false,
                children: {
                    replace: vi.fn(),
                },
            })
            ;(testRepository as any)._fileMap.set(fileId2, {
                id: fileId2,
                busy: false,
                children: {
                    replace: vi.fn(),
                },
            })
        })

        it('should reload specific spec files', async () => {
            const orgItem = testRepository.getSpecByFilePath(mockSpecPath)
            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify
            expect(mockWorker.rpc.loadWdioConfig).toHaveBeenCalledWith({
                env: { paths: [], override: false },
                configFilePath: mockWdioConfigPath,
            })
            expect(mockReadSpecs).toHaveBeenCalledWith({
                env: { paths: [], override: false },
                specs: [mockSpecPath],
            })
            expect(testRepository.getSpecByFilePath(mockSpecPath)).not.toBe(orgItem)
            expect(log.debug).toHaveBeenCalledWith('Reloading 1 spec files')
            expect(log.debug).toHaveBeenCalledWith('Successfully reloaded 1 spec files')
        })

        it('should set and reset busy state for reloaded files', async () => {
            // Setup
            const fileId = `workspace:${mockWorkspaceUri.fsPath}${TEST_ID_SEPARATOR}config:${mockWdioConfigUri.fsPath}`
            const mockSpecItem = {
                id: fileId,
                busy: false,
                children: {
                    replace: vi.fn(),
                },
            } as unknown as vscode.TestItem

            ;(testRepository as any)._fileMap.set(fileId, mockSpecItem)

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])
            // Verify - busy state should have been set initially and then reset
            expect((testRepository as any)._fileMap.get(fileId).busy).toBe(false)
        })

        it('should handle errors during reload', async () => {
            // Setup
            const errorMessage = 'Failed to reload'
            vi.mocked(mockWorker.rpc.loadWdioConfig).mockRejectedValueOnce(new Error(errorMessage))

            const fileId = [wdioConfigTestItem.id, mockSpecPath].join(TEST_ID_SEPARATOR)
            const mockSpecItem = {
                id: fileId,
                busy: true,
                children: {
                    forEach: vi.fn().mockImplementation((callback) => {
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite1` })
                    }),
                },
            } as unknown as vscode.TestItem

            ;(testRepository as any)._fileMap.set(fileId, mockSpecItem)

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to reload spec files: ${mockWdioConfigPath}`)
        })

        it('should handle case when no matching spec files found', async () => {
            // Setup
            vi.mocked(mockWorker.rpc.loadWdioConfig).mockResolvedValueOnce({
                framework: 'mocha',
                specs: [join(process.cwd(), 'some', 'other', 'file.js')],
            } as unknown as WdioConfig)

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify
            expect(log.debug).toHaveBeenCalledWith('No matching spec files found for reload')
        })

        it('should handle empty file paths array', async () => {
            // Execute
            await testRepository.reloadSpecFiles([])

            // Verify
            expect(mockReadSpecs).toHaveBeenCalledWith({
                env: { paths: [], override: false },
                specs: [mockSpecPath, mockSpecPath2],
            })
            expect(log.debug).toHaveBeenCalledWith('Reloading 2 spec files')
            expect(log.debug).toHaveBeenCalledWith('Successfully reloaded 2 spec files')
        })
    })

    // Group 4: Search and Reference
    describe('Search and Reference Functions', () => {
        it('should get spec file by file path', () => {
            // Setup
            const fileId = [wdioConfigTestItem.id, mockSpecPath].join(TEST_ID_SEPARATOR)
            const mockSpec = { id: fileId } as vscode.TestItem

            // Set the file in the map
            ;(testRepository as any)._fileMap.set(fileId, mockSpec)

            // Execute
            const result = testRepository.getSpecByFilePath(mockSpecPath)

            // Verify
            expect(result).toBe(mockSpec)
        })

        it('should handle file URL format paths when getting spec', () => {
            // Setup
            const fileId = [wdioConfigTestItem.id, vscode.Uri.file(mockSpecPath).fsPath].join(TEST_ID_SEPARATOR)
            const mockSpec = { id: fileId } as vscode.TestItem
            ;(testRepository as any)._fileMap.set(fileId, mockSpec)

            // Execute
            const result = testRepository.getSpecByFilePath(mockSpecUri.toString())

            // Verify
            expect(result).toBe(mockSpec)
        })

        it('should convert array of specs correctly', () => {
            // Setup
            const specs = [
                join(process.cwd(), 'path', 'to', 'spec1.js').toString(),
                join(process.cwd(), 'path', 'to', 'spec2.js').toString(),
                join(process.cwd(), 'path', 'to', 'spec3.js').toString(),
            ]

            // Execute
            const result = (testRepository as any)._convertPathString(specs)

            // Verify
            expect(result).toHaveLength(3)
            expect(result).toContain(join(process.cwd(), 'path', 'to', 'spec1.js'))
            expect(result).toContain(join(process.cwd(), 'path', 'to', 'spec2.js'))
            expect(result).toContain(join(process.cwd(), 'path', 'to', 'spec3.js'))
        })
    })

    // Group 5: File Operations
    describe('File Operations', () => {
        it('should correctly remove a spec file and its suites', () => {
            // Setup
            const fileId = [wdioConfigTestItem.id, mockSpecPath].join(TEST_ID_SEPARATOR)

            // Create mock file and suites
            const mockFile = {
                id: fileId,
                children: {
                    forEach: vi.fn().mockImplementation((callback) => {
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite1` })
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite2` })
                    }),
                },
            } as unknown as vscode.TestItem

            // Set up the maps
            ;(testRepository as any)._fileMap.set(fileId, mockFile)

            // Spy
            const deleteSpy = vi.spyOn(wdioConfigTestItem.children, 'delete')

            // Execute
            testRepository.removeSpecFile(mockSpecPath)

            // Verify
            expect(deleteSpy).toHaveBeenCalledWith(fileId)
            expect((testRepository as any)._fileMap.has(fileId)).toBe(false)
            expect(log.debug).toHaveBeenCalledWith(`Removed spec file: ${mockSpecPath}`)
        })

        it('should handle non-existent spec file in removeSpecFile', () => {
            // Spy
            const deleteSpy = vi.spyOn(wdioConfigTestItem.children, 'delete')

            // Execute
            testRepository.removeSpecFile('non-existent-file.js')

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Spec file not found in repository: non-existent-file.js')
            expect(deleteSpy).not.toHaveBeenCalled()
        })
    })
})
