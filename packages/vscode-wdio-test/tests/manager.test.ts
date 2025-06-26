import { join } from 'node:path'

import { ExtensionConfigManager } from '@vscode-wdio/config'
import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { WdioWorkerManager } from '@vscode-wdio/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { mockCreateTestItem, MockTestItemCollection } from '../../../tests/utils.js'
import { RepositoryManager } from '../src/manager.js'
import { TestRepository } from '../src/repository.js'

import type { WorkspaceData } from '@vscode-wdio/types/config'
import type { IWdioExtensionWorker } from '@vscode-wdio/types/server'

// Mock dependencies
vi.mock('vscode', async () => {
    const mockVscode = await import('../../../tests/__mocks__/vscode.cjs')

    return {
        ...mockVscode,
        tests: {
            createTestController: vi.fn(),
        },
        TestRunProfileKind: {
            Run: 1,
        },
    }
})
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('../src/utils.js', () => {
    return {
        createRunProfile: vi.fn(),
    }
})

describe('RepositoryManager', () => {
    let mockWorkspaceFolder: vscode.WorkspaceFolder
    let mockWorkspaces: WorkspaceData[]
    let workerManager: WdioWorkerManager
    let mockDiscoverAllTests: ReturnType<typeof vi.fn>
    let controller: vscode.TestController

    let configManager: ExtensionConfigManager
    let repositoryManager: RepositoryManager
    let configMangerOn: any

    const workspacePath = join(process.cwd(), 'fake', 'workspace')
    const configPath = join(workspacePath, 'wdio.conf.ts')

    const anotherWorkspacePath = join(process.cwd(), 'another', 'workspace')
    const anotherConfigPath = join(anotherWorkspacePath, 'wdio.conf.ts')

    beforeEach(() => {
        vi.resetAllMocks()
        configManager = new ExtensionConfigManager()

        controller = {
            items: new MockTestItemCollection(),
            createTestItem: mockCreateTestItem,
            createRunProfile: vi.fn,
        } as unknown as vscode.TestController

        // Setup fake workspace
        mockWorkspaceFolder = {
            uri: vscode.Uri.file(workspacePath),
            name: 'fake-workspace',
            index: 0,
        }

        // Setup fake config
        mockWorkspaces = [
            {
                workspaceFolder: mockWorkspaceFolder,
                wdioConfigFiles: [configPath],
            },
        ]

        // Setup ServerManager mock
        workerManager = new WdioWorkerManager(configManager)
        vi.spyOn(workerManager, 'getConnection').mockResolvedValue({
            on: vi.fn(),
        } as unknown as IWdioExtensionWorker)

        configMangerOn = vi.fn()
        vi.spyOn(configManager, 'on').mockImplementation(configMangerOn)
        vi.spyOn(configManager, 'workspaces', 'get').mockReturnValue(mockWorkspaces)

        mockDiscoverAllTests = vi.fn().mockResolvedValue(undefined)

        vi.spyOn(TestRepository.prototype, 'discoverAllTests').mockImplementation(mockDiscoverAllTests)

        repositoryManager = new RepositoryManager(controller, configManager, workerManager)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('initialize', () => {
        it('should success to initialize when no workspace', async () => {
            vi.spyOn(configManager, 'workspaces', 'get').mockReturnValue([])

            await repositoryManager.initialize()

            expect((repositoryManager as any)._workspaceTestItems.length).toBe(0)
        })

        it('should success to initialize when one workspace', async () => {
            await repositoryManager.initialize()

            expect((repositoryManager as any)._workspaceTestItems.length).toBe(1)
            expect((repositoryManager as any)._wdioConfigTestItems.length).toBe(1)
        })
    })

    describe('update:configFilePattern', () => {
        it('should add new test item to the test controller', async () => {
            await repositoryManager.initialize()
            vi.spyOn(configManager, 'getWdioConfigPaths').mockReturnValue([])

            const handler = vi.mocked(configMangerOn).mock.calls[0][1]
            const configManagerInitializeSpy = vi.spyOn(configManager, 'initialize')
            const repositoryManagerInitializeSpy = vi.spyOn(repositoryManager, 'initialize')
            const repositoryManagerRegisterSpy = vi.spyOn(repositoryManager, 'registerToTestController')

            await handler()

            expect(configManagerInitializeSpy).toHaveBeenCalled()
            expect(repositoryManagerInitializeSpy).toHaveBeenCalled()
            expect(repositoryManagerRegisterSpy).toHaveBeenCalled()
        })
    })

    describe('registerToTestController', () => {
        it('should delete the loading test item', () => {
            const mockDelete = vi.fn()
            vi.spyOn(controller.items, 'delete').mockImplementation(mockDelete)

            repositoryManager.registerToTestController()

            expect(mockDelete).toHaveBeenCalledWith('_resolving')
        })

        it('should register wdio config test items directly for single workspace', async () => {
            await repositoryManager.initialize()
            repositoryManager.registerToTestController()

            // expect WdioConfigTestItem
            expect(repositoryManager.controller.items.size).toBe(1)
            const registeredItem = repositoryManager.controller.items.get(
                `workspace:${vscode.Uri.file(workspacePath).fsPath}${TEST_ID_SEPARATOR}config:${vscode.Uri.file(configPath).fsPath}`
            )

            expect(repositoryManager.getMetadata(registeredItem!).isConfigFile).toBe(true)
        })

        it('should register workspace test items for multiple workspaces', async () => {
            // Setup multiple workspaces
            const anotherWorkspaceFolder = {
                uri: vscode.Uri.file(anotherWorkspacePath),
                name: 'another-workspace',
                index: 1,
            }

            mockWorkspaces = [
                {
                    workspaceFolder: mockWorkspaceFolder,
                    wdioConfigFiles: [configPath],
                },
                {
                    workspaceFolder: anotherWorkspaceFolder,
                    wdioConfigFiles: [anotherConfigPath],
                },
            ]
            vi.spyOn(configManager, 'workspaces', 'get').mockReturnValue(mockWorkspaces)
            vi.spyOn(workerManager, 'getConnection').mockResolvedValue({
                on: vi.fn(),
            } as unknown as IWdioExtensionWorker)

            await repositoryManager.initialize()
            repositoryManager.registerToTestController()

            expect(repositoryManager.controller.items.size).toBe(2)
            const registeredItem1 = repositoryManager.controller.items.get(
                `workspace:${vscode.Uri.file(workspacePath).fsPath}`
            )
            const registeredItem2 = repositoryManager.controller.items.get(
                `workspace:${vscode.Uri.file(anotherWorkspacePath).fsPath}`
            )
            expect(repositoryManager.getMetadata(registeredItem1!).isWorkspace).toBe(true)
            expect(repositoryManager.getMetadata(registeredItem2!).isWorkspace).toBe(true)

            const configItem1 = registeredItem1!.children.get(
                `workspace:${vscode.Uri.file(workspacePath).fsPath}${TEST_ID_SEPARATOR}config:${vscode.Uri.file(configPath).fsPath}`
            )
            expect(repositoryManager.getMetadata(configItem1!).isConfigFile).toBe(true)

            const configItem2 = registeredItem2!.children.get(
                `workspace:${vscode.Uri.file(anotherWorkspacePath).fsPath}${TEST_ID_SEPARATOR}config:${vscode.Uri.file(anotherConfigPath).fsPath}`
            )
            expect(repositoryManager.getMetadata(configItem2!).isConfigFile).toBe(true)
        })
    })

    describe('addWdioConfig', () => {
        it('should add new test item to the test controller', async () => {
            vi.spyOn(configManager, 'isMultiWorkspace', 'get').mockReturnValue(false)
            await repositoryManager.initialize()
            repositoryManager.registerToTestController()
            expect(controller.items.size).toBe(1)

            await repositoryManager.addWdioConfig(mockWorkspaceFolder, '/path/to/newConfig.spec.ts')

            expect(repositoryManager.controller.items.size).toBe(2)
        })
    })

    describe('removeWdioConfig', () => {
        beforeEach(async () => {
            vi.spyOn(configManager, 'isMultiWorkspace', 'get').mockReturnValue(false)
            await repositoryManager.initialize()
            repositoryManager.registerToTestController()

            await repositoryManager.addWdioConfig(mockWorkspaceFolder, '/path/to/newConfig.spec.ts')
        })

        it('should remove test item to the test controller', async () => {
            repositoryManager.removeWdioConfig(mockWorkspaceFolder, '/path/to/newConfig.spec.ts')

            expect(repositoryManager.controller.items.size).toBe(1)
        })
    })

    describe('refreshTests', () => {
        it('should remove test item to the test controller', async () => {
            await repositoryManager.initialize()
            repositoryManager.registerToTestController()
            const discoverSpy = vi.spyOn(repositoryManager.repos[0], 'discoverAllTests')
            const registerSpy = vi.spyOn(repositoryManager, 'registerToTestController')
            const reorganizeSpy = vi.spyOn(workerManager, 'reorganize')
            vi.spyOn(configManager, 'getWdioConfigPaths').mockImplementation(vi.fn())

            await repositoryManager.refreshTests()

            expect(repositoryManager.controller.items.size).toBe(0)
            expect(discoverSpy).toHaveBeenCalled()
            expect(registerSpy).toHaveBeenCalled()
            expect(reorganizeSpy).toHaveBeenCalled()
        })
    })

    describe('dispose', () => {
        it('should dispose the test controller', () => {
            const mockDispose = vi.fn()
            vi.spyOn(repositoryManager, 'dispose').mockImplementation(mockDispose)

            repositoryManager.dispose()

            expect(mockDispose).toHaveBeenCalled()
        })
    })
})
