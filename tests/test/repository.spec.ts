import { join } from 'node:path'

import * as chai from 'chai'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { TEST_ID_SEPARATOR } from '../../src/constants.js'
import { RepositoryManager } from '../../src/test/manager.js'
import { TestRepository } from '../../src/test/repository.js'
import { log } from '../../src/utils/logger.js'
import type { WdioExtensionWorkerInterface } from '../../src/api/index.js'

const expect = chai.expect

describe('TestRepository', () => {
    let sandbox: sinon.SinonSandbox

    const mockWorkspaceUri = vscode.Uri.file(join(process.cwd(), 'mock', 'workspace'))
    const mockSpecPath = join(process.cwd(), 'mock', 'workspace', 'e2e', 'test1.spec.js')
    const mockSpecPath2 = join(process.cwd(), 'mock', 'workspace', 'e2e', 'test2.spec.js')
    const mockSpecUri = vscode.Uri.file(mockSpecPath)
    const mockWdioConfigPath = join(process.cwd(), 'mock', 'workspace', 'wdio.conf.js')
    const mockWdioConfigUri = vscode.Uri.file(mockWdioConfigPath)

    // Mock objects
    let testController: vscode.TestController
    let wdioConfigTestItem: vscode.TestItem
    let testRepository: TestRepository
    let mockWorker: WdioExtensionWorkerInterface
    let readFile: sinon.SinonStub
    let readSpecsStub: sinon.SinonStub
    let runProfileDisposeStub: sinon.SinonStub

    beforeEach(() => {
        sandbox = sinon.createSandbox()

        sandbox.stub(log, 'debug')
        sandbox.stub(log, 'error')
        sandbox.stub(log, 'warn')
        sandbox.stub(log, 'info')
        sandbox.stub(log, 'trace')

        // Setup TestController mock
        testController = vscode.tests.createTestController('wdio-dummy', 'wdio-dummy')

        // Setup WdioConfigTestItem mock
        wdioConfigTestItem = testController.createTestItem(
            `workspace:${mockWorkspaceUri.fsPath}${TEST_ID_SEPARATOR}config:${mockWdioConfigUri.fsPath}`,
            mockWdioConfigUri.fsPath,
            mockWdioConfigUri
        )
        runProfileDisposeStub = sandbox.stub()

        RepositoryManager.setMetadata(wdioConfigTestItem, {
            uri: mockWdioConfigUri,
            isWorkspace: false,
            isConfigFile: true,
            isSpecFile: false,
            isTestcase: false,
            repository: {} as any,
            runProfiles: [
                {
                    dispose: runProfileDisposeStub,
                } as unknown as vscode.TestRunProfile,
            ],
        })

        // Setup worker mock
        readSpecsStub = sandbox.stub().resolves([
            { spec: mockSpecPath, data: 'test content 1' },
            { spec: mockSpecPath2, data: 'test content 2' },
        ])
        mockWorker = {
            rpc: {
                loadWdioConfig: sandbox.stub().resolves({
                    framework: 'mocha',
                    specs: [mockSpecPath, mockSpecPath2],
                }),
                readSpecs: readSpecsStub,
            },
        } as unknown as WdioExtensionWorkerInterface

        readFile = sinon.stub()
        class MockTestRepository extends TestRepository {
            protected override readSpecFile() {
                return readFile()
            }
        }

        // Create repository with mocked dependencies
        testRepository = new MockTestRepository(testController, mockWorker, mockWdioConfigPath, wdioConfigTestItem)
    })

    afterEach(() => {
        sandbox.restore()
        testController.dispose()
    })

    // Group 1: Initialization and basic functionality
    describe('Initialization and Resource Management', () => {
        it('should initialize with provided dependencies', () => {
            // Verify
            expect(testRepository.controller).to.equal(testController)
            expect(testRepository.worker).to.equal(mockWorker)
            expect(testRepository.wdioConfigPath).to.equal(mockWdioConfigPath)
        })

        it('should dispose resources properly', () => {
            // Setup spies
            const spyOnFileMapClear = sandbox.spy((testRepository as any)._fileMap, 'clear')

            // Execute
            testRepository.dispose()
            runProfileDisposeStub
            // Verify
            expect(runProfileDisposeStub).to.have.been.called
            expect(spyOnFileMapClear).to.have.been.called
        })

        it('should clear all tests from repository', () => {
            // Setup spies
            const spyOnFileMapClear = sandbox.spy((testRepository as any)._fileMap, 'clear')

            // Execute
            testRepository.clearTests()

            // Verify
            expect(spyOnFileMapClear).to.have.been.called
        })

        it('should throw error if framework is accessed before loading config', () => {
            // Create new instance without loading config
            const repo = new TestRepository(testController, mockWorker, mockWdioConfigPath, wdioConfigTestItem)

            // Verify
            expect(() => repo.framework).to.throw('The configuration for WebdriverIO is not loaded')
        })
    })

    // Group 2: Test Discovery
    describe('Test Discovery', () => {
        it('should discover and register test specs from configuration', async () => {
            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(mockWorker.rpc.loadWdioConfig).to.have.been.calledWith({ configFilePath: mockWdioConfigPath })
            expect(mockWorker.rpc.readSpecs).to.have.been.calledWith({ specs: [mockSpecPath, mockSpecPath2] })
            // expect(converter.convertTestData).to.have.been.called
            expect(testRepository.framework).to.equal('mocha')

            expect(log.debug).to.have.been.calledWith(`Discovered ${2} spec files`)
        })

        it('should handle no specs case', async () => {
            // Setup
            ;(mockWorker.rpc.loadWdioConfig as sinon.SinonStub).resolves({
                framework: 'mocha',
                specs: [],
            })

            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(log.debug).to.have.been.calledWith('No spec files found in configuration')
            expect(mockWorker.rpc.readSpecs).to.not.have.been.called
        })

        it('should handle error when loading config fails', async () => {
            // Setup
            const errorMessage = 'Failed to load configuration'
            ;(mockWorker.rpc.loadWdioConfig as sinon.SinonStub).rejects(new Error(errorMessage))

            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(log.error).to.have.been.calledWith(`Failed to discover tests: ${errorMessage}`)
        })

        it('should handle error gracefully when loadWdioConfig throws an exception', async () => {
            // Setup
            const error = new Error('RPC communication error')
            ;(mockWorker.rpc.loadWdioConfig as sinon.SinonStub).throws(error)

            // Execute
            await testRepository.discoverAllTests()

            // Verify
            expect(log.error).to.have.been.calledWith(`Failed to discover tests: ${error.message}`)
            expect(log.trace).to.have.been.called
            expect(mockWorker.rpc.readSpecs).to.not.have.been.called
        })
    })

    // Group 3: File Reloading
    describe('File Reloading', () => {
        beforeEach(() => {
            // Setup file map with mock spec files
            const fileId1 = [wdioConfigTestItem.id, mockSpecPath].join(TEST_ID_SEPARATOR)
            const fileId2 = [wdioConfigTestItem.id, mockSpecPath2].join(TEST_ID_SEPARATOR)

            ;(testRepository as any)._fileMap.set(fileId1, {
                id: fileId1,
                busy: false,
                children: {
                    forEach: sandbox.stub().callsFake((callback) => {
                        callback({ id: `${fileId1}${TEST_ID_SEPARATOR}suite1` })
                    }),
                },
            })
            ;(testRepository as any)._fileMap.set(fileId2, {
                id: fileId2,
                busy: false,
                children: {
                    forEach: sandbox.stub().callsFake((callback) => {
                        callback({ id: `${fileId2}${TEST_ID_SEPARATOR}suite1` })
                    }),
                },
            })
        })

        it('should reload specific spec files', async () => {
            // Setup
            const removeSpecFileSpy = sandbox.spy(testRepository, 'removeSpecFile')

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify
            expect(mockWorker.rpc.loadWdioConfig).to.have.been.calledWith({ configFilePath: mockWdioConfigPath })
            expect(readSpecsStub).to.have.been.calledWithExactly({ specs: [mockSpecPath] })
            expect(removeSpecFileSpy).to.have.been.calledWith(mockSpecPath)
            expect(log.debug).to.have.been.calledWith('Reloading 1 spec files')
            expect(log.debug).to.have.been.calledWith('Successfully reloaded 1 spec files')
        })

        it('should set and reset busy state for reloaded files', async () => {
            // Setup
            const fileId = `workspace:${mockWorkspaceUri.fsPath}${TEST_ID_SEPARATOR}config:${mockWdioConfigUri.fsPath}`
            const mockSpecItem = {
                id: fileId,
                busy: false,
                children: {
                    forEach: sandbox.stub().callsFake((callback) => {
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite1` })
                    }),
                },
            } as unknown as vscode.TestItem

            ;(testRepository as any)._fileMap.set(fileId, mockSpecItem)

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify - busy state should have been set initially and then reset
            expect((testRepository as any)._fileMap.get(fileId).busy).to.equal(false)
        })

        it('should handle errors during reload', async () => {
            // Setup
            const errorMessage = 'Failed to reload'
            ;(mockWorker.rpc.loadWdioConfig as sinon.SinonStub).rejects(new Error(errorMessage))

            const fileId = [wdioConfigTestItem.id, mockSpecPath].join(TEST_ID_SEPARATOR)
            const mockSpecItem = {
                id: fileId,
                busy: true,
                children: {
                    forEach: sandbox.stub().callsFake((callback) => {
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite1` })
                    }),
                },
            } as unknown as vscode.TestItem

            ;(testRepository as any)._fileMap.set(fileId, mockSpecItem)

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify
            expect(log.error).to.have.been.calledWith(`Failed to reload spec files: ${errorMessage}`)
            expect(mockSpecItem.busy).to.equal(false) // Should reset busy state even on error
        })

        it('should handle case when no matching spec files found', async () => {
            // Setup
            ;(mockWorker.rpc.loadWdioConfig as sinon.SinonStub).resolves({
                framework: 'mocha',
                specs: [join(process.cwd(), 'some', 'other', 'file.js')],
            })

            // Execute
            await testRepository.reloadSpecFiles([mockSpecPath])

            // Verify
            expect(log.debug).to.have.been.calledWith('No matching spec files found for reload')
        })

        it('should handle empty file paths array', async () => {
            // Execute
            await testRepository.reloadSpecFiles([])

            // Verify
            expect(readSpecsStub).to.have.been.calledWithExactly({ specs: [mockSpecPath, mockSpecPath2] })

            expect(log.debug).to.have.been.calledWith('Reloading 2 spec files')
            expect(log.debug).to.have.been.calledWith('Successfully reloaded 2 spec files')
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
            expect(result).to.equal(mockSpec)
        })

        it('should handle file URL format paths when getting spec', () => {
            // Setup
            const fileId = [wdioConfigTestItem.id, vscode.Uri.file(mockSpecPath).fsPath].join(TEST_ID_SEPARATOR)
            const mockSpec = { id: fileId } as vscode.TestItem
            ;(testRepository as any)._fileMap.set(fileId, mockSpec)

            // Execute
            const result = testRepository.getSpecByFilePath(mockSpecUri.toString())

            // Verify
            expect(result).to.equal(mockSpec)
        })

        it('should convert array of specs correctly', () => {
            // Setup
            const specs = [
                join(process.cwd(), 'path', 'to', 'spec1.js').toString(),
                join(process.cwd(), 'path', 'to', 'spec2.js').toString(),
                join(process.cwd(), 'path', 'to', 'spec3.js').toString(),
            ]

            // Execute
            const result = (testRepository as any).convertPathString(specs)

            // Verify
            expect(result).to.have.lengthOf(3)
            expect(result).to.include(join(process.cwd(), 'path', 'to', 'spec1.js'))
            expect(result).to.include(join(process.cwd(), 'path', 'to', 'spec2.js'))
            expect(result).to.include(join(process.cwd(), 'path', 'to', 'spec3.js'))
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
                    forEach: sandbox.stub().callsFake((callback) => {
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite1` })
                        callback({ id: `${fileId}${TEST_ID_SEPARATOR}suite2` })
                    }),
                },
            } as unknown as vscode.TestItem

            // Set up the maps
            ;(testRepository as any)._fileMap.set(fileId, mockFile)
            // Spy
            const spy = sinon.spy(wdioConfigTestItem.children, 'delete')

            // Execute
            testRepository.removeSpecFile(mockSpecPath)

            // Verify
            expect(spy).to.have.been.calledWith(fileId)
            expect((testRepository as any)._fileMap.has(fileId)).to.be.false
            expect(log.debug).to.have.been.calledWith(`Removed spec file: ${mockSpecPath}`)
        })

        it('should handle non-existent spec file in removeSpecFile', () => {
            // Spy
            const spy = sinon.spy(wdioConfigTestItem.children, 'delete')
            // Execute
            testRepository.removeSpecFile('non-existent-file.js')

            // Verify
            expect(log.debug).to.have.been.calledWith('Spec file not found in repository: non-existent-file.js')
            expect(spy).to.not.have.been.called
        })
    })
})
