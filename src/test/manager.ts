import { basename, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as vscode from 'vscode'

import { convertPathToUri } from './converter.js'
import { TestRepository } from './repository.js'
import { configManager, testControllerId } from '../config/index.js'
import { serverManager } from '../api/manager.js'
import { log } from '../utils/logger.js'

import type { WdioConfigTestItem, WorkspaceTestItem } from './types.js'
import { runHandler } from './runHandler.js'
import { TEST_ID_SEPARATOR } from '../constants.js'

const LOADING_TEST_ITEM_ID = '_resolving'

class RepositoryManager implements vscode.Disposable {
    public readonly controller: vscode.TestController
    public readonly repos: TestRepository[] = []
    private _loadingTestItem: vscode.TestItem
    private _workspaceTestItems: WorkspaceTestItem[] = []
    private _wdioConfigTestItems: WdioConfigTestItem[] = []

    constructor() {
        this.controller = vscode.tests.createTestController(testControllerId, 'WebdriverIO')
        this._loadingTestItem = this.controller.createTestItem(LOADING_TEST_ITEM_ID, 'Resolving WebdriverIO Tests...')
        this._loadingTestItem.sortText = '.0' // show at first line
        this._loadingTestItem.busy = true
        this.controller.items.add(this._loadingTestItem)
        this.controller.refreshHandler = async () => {
            log.info('Refreshing WebdriverIO tests...')
            await this.refreshTests()
        }
    }

    public async initialize() {
        const workspaces = configManager.workspaces

        if (workspaces.length < 1) {
            log.info('No workspaces is detected.')
            return
        }

        log.debug('Start initialize the RepositoryManager')

        this._workspaceTestItems = []
        this._wdioConfigTestItems = []

        this._workspaceTestItems = await Promise.all(
            workspaces.map(async (workspace) => {
                const workspaceTestItem = this.createWorkspaceTestItem(workspace.workspaceFolder)
                let isCreatedDefaultProfile = false
                for (const wdioConfigFile of workspace.wdioConfigFiles) {
                    const wdioConfigTestItem = this.createWdioConfigTestItem(workspaceTestItem, wdioConfigFile)
                    workspaceTestItem.children.add(wdioConfigTestItem)
                    this._wdioConfigTestItems.push(wdioConfigTestItem)
                    const worker = await serverManager.getConnection(wdioConfigFile)
                    const repo = new TestRepository(this.controller, worker, wdioConfigFile, wdioConfigTestItem)
                    wdioConfigTestItem.metadata.repository = repo
                    this.repos.push(repo)

                    // Create run profile
                    if (workspaces.length > 0) {
                        const profileName =
                            workspaces.length === 1
                                ? basename(wdioConfigFile)
                                : `${workspace.workspaceFolder.name} - ${basename(wdioConfigFile)}`
                        this.controller.createRunProfile(
                            profileName,
                            vscode.TestRunProfileKind.Run,
                            runHandler,
                            !isCreatedDefaultProfile
                        )
                        isCreatedDefaultProfile = true
                    }
                }
                return workspaceTestItem
            })
        )
        log.debug('Finish initialize the RepositoryManager')
    }

    /**
     * registerToTestController
     */
    public registerToTestController() {
        log.debug('Registering the TestItems to Test controller.')
        this.controller.items.delete(LOADING_TEST_ITEM_ID)
        if (this._workspaceTestItems.length === 1) {
            this.controller.items.replace(this._wdioConfigTestItems)
        } else if (this._workspaceTestItems.length > 1) {
            this.controller.items.replace(this._workspaceTestItems)
        }
        log.debug('Successfully registered.')
    }

    private createWorkspaceTestItem(workspaceFolder: vscode.WorkspaceFolder) {
        const workspaceItem = this.controller.createTestItem(
            `workspace:${fileURLToPath(workspaceFolder.uri.toString())}`,
            workspaceFolder.name,
            workspaceFolder.uri
        ) as WorkspaceTestItem
        workspaceItem['metadata'] = {
            isWorkspace: true,
            isConfigFile: false,
            isSpecFile: false,
        }
        return workspaceItem
    }

    private createWdioConfigTestItem(workspaceTestItem: WorkspaceTestItem, wdioConfigPath: string) {
        const configUri = convertPathToUri(wdioConfigPath)

        const configItem = this.controller.createTestItem(
            [workspaceTestItem.id, `config:${wdioConfigPath}`].join(TEST_ID_SEPARATOR),
            basename(wdioConfigPath),
            configUri
        ) as WdioConfigTestItem
        configItem['metadata'] = {
            isWorkspace: false,
            isConfigFile: true,
            isSpecFile: false,
            repository: {} as TestRepository, // set dummy
        }
        configItem.description = relative(workspaceTestItem.uri!.fsPath, dirname(wdioConfigPath))
        return configItem
    }

    /**
     * Refresh WebdriverIO tests
     */
    public async refreshTests(): Promise<void> {
        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Reloading WebdriverIO tests...',
                cancellable: false,
            },
            async () => {
                try {
                    for (const repo of this.repos) {
                        // Clear existing tests
                        repo.clearTests()
                        // Discover tests again
                        await repo.discoverAllTests()
                    }

                    vscode.window.showInformationMessage('WebdriverIO tests reloaded successfully')
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    log.error(`Failed to reload tests: ${errorMessage}`)
                    vscode.window.showErrorMessage(`Failed to reload WebdriverIO tests: ${errorMessage}`)
                }
            }
        )
    }

    dispose() {
        this.controller.dispose()
    }
}

export const repositoryManager = new RepositoryManager()
