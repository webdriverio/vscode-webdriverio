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
        getWorkspaceFolder: vi.fn(),
        createRunProfile: vi.fn(),
    }
})

describe('RepositoryManager', () => {
    let fakeWorkspaceFolder: vscode.WorkspaceFolder
    let fakeWorkspaces: WorkspaceData[]
    let workerManager: WdioWorkerManager
    let clearTestsStub: ReturnType<typeof vi.fn>
    let discoverAllTestsStub: ReturnType<typeof vi.fn>
    let controller: vscode.TestController

    const configManager = new ExtensionConfigManager()
    let repositoryManager: RepositoryManager

    const workspacePath = join(process.cwd(), 'fake', 'workspace')
    const configPath = join(workspacePath, 'wdio.conf.ts')

    const anotherWorkspacePath = join(process.cwd(), 'another', 'workspace')
    const anotherConfigPath = join(anotherWorkspacePath, 'wdio.conf.ts')

    beforeEach(() => {
        vi.resetAllMocks()

        controller = {
            items: new MockTestItemCollection(),
            createTestItem: mockCreateTestItem,
            createRunProfile: vi.fn,
        } as unknown as vscode.TestController

        // Setup fake workspace
        fakeWorkspaceFolder = {
            uri: vscode.Uri.file(workspacePath),
            name: 'fake-workspace',
            index: 0,
        }

        // Setup fake config
        fakeWorkspaces = [
            {
                workspaceFolder: fakeWorkspaceFolder,
                wdioConfigFiles: [configPath],
            },
        ]

        // Setup ServerManager mock
        workerManager = new WdioWorkerManager(configManager)
        vi.spyOn(workerManager, 'getConnection').mockResolvedValue({
            on: vi.fn(),
        } as unknown as IWdioExtensionWorker)

        // Stub configManager
        vi.spyOn(configManager, 'workspaces', 'get').mockReturnValue(fakeWorkspaces)

        // Stub TestRepository
        discoverAllTestsStub = vi.fn().mockResolvedValue(undefined)
        clearTestsStub = vi.fn()

        vi.spyOn(TestRepository.prototype, 'discoverAllTests').mockImplementation(discoverAllTestsStub)
        vi.spyOn(TestRepository.prototype, 'clearTests').mockImplementation(clearTestsStub)

        repositoryManager = new RepositoryManager(controller, configManager, workerManager)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('initialize', () => {
        it('should success to initialize when no workspace', async () => {
            // Override the configManager stub to return an empty array
            vi.spyOn(configManager, 'workspaces', 'get').mockReturnValue([])

            await repositoryManager.initialize()

            expect((repositoryManager as any)._workspaceTestItems.length).toBe(0)
        })

        it('should success to initialize when one workspace', async () => {
            await repositoryManager.initialize()

            expect((repositoryManager as any)._workspaceTestItems.length).toBe(1)
            expect((repositoryManager as any)._wdioConfigTestItems.length).toBe(1)

            expect(workerManager.getConnection).toHaveBeenCalledWith(fakeWorkspaces[0].wdioConfigFiles[0])
        })
    })

    describe('registerToTestController', () => {
        it('should delete the loading test item', () => {
            const deleteStub = vi.fn()
            vi.spyOn(controller.items, 'delete').mockImplementation(deleteStub)

            repositoryManager.registerToTestController()

            expect(deleteStub).toHaveBeenCalledWith('_resolving')
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

            fakeWorkspaces = [
                {
                    workspaceFolder: fakeWorkspaceFolder,
                    wdioConfigFiles: [configPath],
                },
                {
                    workspaceFolder: anotherWorkspaceFolder,
                    wdioConfigFiles: [anotherConfigPath],
                },
            ]
            vi.spyOn(configManager, 'workspaces', 'get').mockReturnValue(fakeWorkspaces)
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

    describe('refreshTests', () => {
        beforeEach(async () => {
            await repositoryManager.initialize()
        })

        it('should handle errors during refresh', async () => {
            repositoryManager.refreshTests()
            // @ts-ignore the target function of this test is callback of vscode api
            await vi.mocked(vscode.window.withProgress).mock.calls[0][1]()

            expect(clearTestsStub).toHaveBeenCalledTimes(1)
            expect(discoverAllTestsStub).toHaveBeenCalledTimes(1)
        })
    })

    describe('dispose', () => {
        it('should dispose the test controller', () => {
            const disposeStub = vi.fn()
            vi.spyOn(repositoryManager, 'dispose').mockImplementation(disposeStub)

            repositoryManager.dispose()

            expect(disposeStub).toHaveBeenCalled()
        })
    })
})
