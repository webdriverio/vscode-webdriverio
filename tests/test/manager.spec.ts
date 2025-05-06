import { join } from 'node:path'

import * as chai from 'chai'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ServerManager } from '../../src/api/index.js'
import { ExtensionConfigManager } from '../../src/config/index.js'
import { EXTENSION_ID, TEST_ID_SEPARATOR } from '../../src/constants.js'
import { RepositoryManager } from '../../src/test/manager.js'
import { TestRepository } from '../../src/test/repository.js'
import type { WorkspaceData } from '../../src/config/types.js'
import type { WdioConfigTestItem, WorkspaceTestItem } from '../../src/test/types.js'

const expect = chai.expect

describe('RepositoryManager', () => {
    let sandbox: sinon.SinonSandbox
    let fakeWorkspaceFolder: vscode.WorkspaceFolder
    let fakeWorkspaces: WorkspaceData[]
    let serverManagerMock: sinon.SinonMock

    let clearTestsStub: sinon.SinonStub
    let discoverAllTestsStub: sinon.SinonStub

    const configManager = new ExtensionConfigManager()
    const serverManager = new ServerManager()
    let repositoryManager: RepositoryManager

    const workspacePath = join(process.cwd(), 'fake', 'workspace')
    const configPath = join(workspacePath, 'wdio.conf.ts')

    const anotherWorkspacePath = join(process.cwd(), 'another', 'workspace')
    const anotherConfigPath = join(anotherWorkspacePath, 'wdio.conf.ts')

    const controller = vscode.tests.createTestController(`${EXTENSION_ID}-dummy`, 'Dummy')

    beforeEach(() => {
        sandbox = sinon.createSandbox()

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

        serverManagerMock = sandbox.mock(serverManager)
        serverManagerMock.expects('getConnection').withArgs(fakeWorkspaces[0].wdioConfigFiles[0]).resolves({})

        // Stub configManager
        sandbox.stub(configManager, 'workspaces').get(() => fakeWorkspaces)

        // Stub TestRepository
        discoverAllTestsStub = sandbox.stub(TestRepository.prototype, 'discoverAllTests').resolves()
        clearTestsStub = sandbox.stub(TestRepository.prototype, 'clearTests')

        repositoryManager = new RepositoryManager(controller, configManager, serverManager)
    })

    afterEach(() => {
        sandbox.restore()
    })

    describe('initialize', () => {
        it('should success to initialize when no workspace', async () => {
            // Override the configManager stub to return an empty array
            sandbox.stub(configManager, 'workspaces').get(() => [])

            await repositoryManager.initialize()

            expect((repositoryManager as any)._workspaceTestItems.length).to.equal(0)
        })

        it('should success to initialize when one workspace', async () => {
            await repositoryManager.initialize()

            expect((repositoryManager as any)._workspaceTestItems.length).to.equal(1)
            expect((repositoryManager as any)._wdioConfigTestItems.length).to.equal(1)

            serverManagerMock.expects('getConnection').once().withExactArgs(fakeWorkspaces[0].wdioConfigFiles[0])
        })
    })

    describe('registerToTestController', () => {
        it('should delete the loading test item', () => {
            const stub = sandbox.stub(controller.items, 'delete').returns()

            repositoryManager.registerToTestController()

            expect(stub).to.have.been.calledWith('_resolving')
        })

        it('should register wdio config test items directly for single workspace', async () => {
            await repositoryManager.initialize()
            repositoryManager.registerToTestController()

            // expect WdioConfigTestItem
            expect(repositoryManager.controller.items.size).to.equal(1)
            const resistedItem = repositoryManager.controller.items.get(
                `workspace:${vscode.Uri.file(workspacePath).fsPath}${TEST_ID_SEPARATOR}config:${vscode.Uri.file(configPath).fsPath}`
            ) as WdioConfigTestItem
            expect(resistedItem?.metadata.isConfigFile).to.equal(true)
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
            serverManagerMock.expects('getConnection').withArgs(anotherConfigPath).resolves({})

            await repositoryManager.initialize()
            repositoryManager.registerToTestController()

            expect(repositoryManager.controller.items.size).to.equal(2)
            const resistedItem1 = repositoryManager.controller.items.get(
                `workspace:${vscode.Uri.file(workspacePath).fsPath}`
            ) as WorkspaceTestItem
            const resistedItem2 = repositoryManager.controller.items.get(
                `workspace:${vscode.Uri.file(anotherWorkspacePath).fsPath}`
            ) as WorkspaceTestItem
            expect(resistedItem1?.metadata.isWorkspace).to.equal(true)
            expect(resistedItem2?.metadata.isWorkspace).to.equal(true)

            const configItem1 = resistedItem1.children.get(
                `workspace:${vscode.Uri.file(workspacePath).fsPath}${TEST_ID_SEPARATOR}config:${vscode.Uri.file(configPath).fsPath}`
            ) as WdioConfigTestItem
            expect(configItem1?.metadata.isConfigFile).to.equal(true)

            const configItem2 = resistedItem2.children.get(
                `workspace:${vscode.Uri.file(anotherWorkspacePath).fsPath}${TEST_ID_SEPARATOR}config:${vscode.Uri.file(anotherConfigPath).fsPath}`
            ) as WdioConfigTestItem
            expect(configItem2?.metadata.isConfigFile).to.equal(true)
        })
    })

    describe('refreshTests', () => {
        beforeEach(async () => {
            await repositoryManager.initialize()
        })

        it('should handle errors during refresh', async () => {
            repositoryManager.refreshTests()

            expect(clearTestsStub).calledOnce
            expect(discoverAllTestsStub).to.have.been.calledOnce
        })
    })

    describe('dispose', () => {
        it('should dispose the test controller', () => {
            const disposeStub = (repositoryManager.dispose = sandbox.stub())

            repositoryManager.dispose()

            expect(disposeStub).to.have.been.called
        })
    })
})
