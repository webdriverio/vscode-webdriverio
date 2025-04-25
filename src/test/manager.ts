import { basename, dirname, relative } from 'node:path'

import * as vscode from 'vscode'

import { convertPathToUri } from './converter.js'
import { TestRepository } from './repository.js'
import { createRunProfile } from './utils.js'
import { TEST_ID_SEPARATOR } from '../constants.js'
import { log } from '../utils/logger.js'

import type { WdioConfigTestItem, WorkspaceTestItem } from './types.js'
import type { ServerManager } from '../api/manager.js'
import type { ExtensionConfigManager } from '../config/index.js'

/**
 * workspace                                        -- managed by this class
 *   - configuration file (e.g. wdio.conf.js)       -- managed by this class
 *                                                  -- managed by repository class
 *     -  spec file (e.g. e2e.spec.js)              -- managed by repository class
 *       - test (e.g. describe('test', ()=>{...}))  -- managed by repository class
 */

const LOADING_TEST_ITEM_ID = '_resolving'

export class RepositoryManager implements vscode.Disposable {
    public readonly repos: TestRepository[] = []
    private _loadingTestItem: vscode.TestItem
    private _workspaceTestItems: WorkspaceTestItem[] = []
    private _wdioConfigTestItems: WdioConfigTestItem[] = []

    constructor(
        public readonly controller: vscode.TestController,
        public readonly configManager: ExtensionConfigManager,
        private readonly serverManager: ServerManager
    ) {
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
        const workspaces = this.configManager.workspaces

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
                    await this.createWdioConfigTestItem(workspaceTestItem, wdioConfigFile)

                    // Create run profile
                    createRunProfile(this, wdioConfigFile, !isCreatedDefaultProfile)
                    isCreatedDefaultProfile = true
                }
                return workspaceTestItem
            })
        )
        log.debug('Finish initialize the RepositoryManager')
    }

    /**
     * The test is reflected in the UI by registering the loaded test in the controller.
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
            `workspace:${workspaceFolder.uri.fsPath}`,
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

    private async createWdioConfigTestItem(workspaceTestItem: WorkspaceTestItem, wdioConfigPath: string) {
        const configUri = convertPathToUri(wdioConfigPath)
        const configItem = this.controller.createTestItem(
            [workspaceTestItem.id, `config:${configUri.fsPath}`].join(TEST_ID_SEPARATOR),
            basename(wdioConfigPath),
            configUri
        ) as WdioConfigTestItem

        workspaceTestItem.children.add(configItem)
        this._wdioConfigTestItems.push(configItem)

        const worker = await this.serverManager.getConnection(wdioConfigPath)
        const repo = new TestRepository(this.controller, worker, wdioConfigPath, configItem)
        this.repos.push(repo)

        configItem['metadata'] = {
            isWorkspace: false,
            isConfigFile: true,
            isSpecFile: false,
            repository: repo,
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

    public dispose() {
        this.repos.splice(0)
        this._workspaceTestItems = []
        this._wdioConfigTestItems = []
    }
}
