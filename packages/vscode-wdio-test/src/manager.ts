import { basename, dirname, relative } from 'node:path'

import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import * as vscode from 'vscode'

import { convertPathToUri } from './converter.js'
import { MetadataRepository } from './metadata.js'
import { TestRepository } from './repository.js'
import { createRunProfile, getWorkspaceFolder } from './utils.js'
import type { ExtensionConfigManager } from '@vscode-wdio/config'
import type { IWorkerManager } from '@vscode-wdio/types/server'
import type { IRepositoryManager, ITestRepository } from '@vscode-wdio/types/test'

/**
 * workspace                                        -- managed by this class
 *   - configuration file (e.g. wdio.conf.js)       -- managed by this class
 *                                                  -- managed by repository class
 *     -  spec file (e.g. e2e.spec.js)              -- managed by repository class
 *       - test (e.g. describe('test', ()=>{...}))  -- managed by repository class
 */

const LOADING_TEST_ITEM_ID = '_resolving'

export class RepositoryManager extends MetadataRepository implements IRepositoryManager {
    private readonly _repos = new Set<ITestRepository>()
    private _loadingTestItem: vscode.TestItem
    private _workspaceTestItems: vscode.TestItem[] = []
    private _wdioConfigTestItems: vscode.TestItem[] = []
    private _isInitialized = false
    private isCreatedDefaultProfile = false

    constructor(
        public readonly controller: vscode.TestController,
        public readonly configManager: ExtensionConfigManager,
        private readonly workerManager: IWorkerManager
    ) {
        super()
        this._loadingTestItem = this.controller.createTestItem(LOADING_TEST_ITEM_ID, 'Resolving WebdriverIO Tests...')
        this._loadingTestItem.sortText = '.0' // show at first line
        this._loadingTestItem.busy = true
        this.controller.items.add(this._loadingTestItem)
        this.controller.refreshHandler = async () => {
            log.info('Refreshing WebdriverIO tests...')
            await this.refreshTests()
        }
        configManager.on('update:configFilePattern', async () => {
            if (!this._isInitialized) {
                return
            }
            this.controller.items.replace([this._loadingTestItem])
            await this.dispose()
            configManager.dispose()
            await configManager
                .initialize()
                .then(async () => await this.initialize())
                .then(
                    async () =>
                        await Promise.all(
                            this.repos.map(async (repo) => {
                                return await repo.discoverAllTests()
                            })
                        )
                )
                .then(() => this.registerToTestController())
                .then(() => this.workerManager.reorganize(configManager.getWdioConfigPaths()))
        })
    }

    public get repos() {
        return Array.from(this._repos)
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
                for (const wdioConfigFile of workspace.wdioConfigFiles) {
                    await this.createWdioConfigTestItem(workspaceTestItem, wdioConfigFile)

                    this.isCreatedDefaultProfile = true
                }
                return workspaceTestItem
            })
        )
        this._isInitialized = true
        log.debug('Finish initialize the RepositoryManager')
    }

    public async addWdioConfig(workspaceUri: vscode.Uri, wdioConfigPath: string) {
        const affectedWorkspaceItems = this._workspaceTestItems.filter((item) => {
            return item.uri?.fsPath === workspaceUri.fsPath
        })
        for (const workspaceTestItem of affectedWorkspaceItems) {
            const configTestItem = await this.createWdioConfigTestItem(workspaceTestItem, wdioConfigPath)

            const repo = this.getRepository(configTestItem)
            await repo.discoverAllTests()
            if (!this.configManager.isMultiWorkspace) {
                this.controller.items.add(configTestItem)
            }
        }
    }

    public removeWdioConfig(workspaceUri: vscode.Uri, wdioConfigPath: string) {
        const affectedWorkspaceItems = this._workspaceTestItems.filter((item) => {
            return item.uri?.fsPath === workspaceUri.fsPath
        })
        log.debug(`Remove the config file from ${affectedWorkspaceItems.length} workspace(s)`)
        const configUri = convertPathToUri(wdioConfigPath)
        for (const workspaceItem of affectedWorkspaceItems) {
            const config = workspaceItem.children.get(this.generateConfigTestItemId(workspaceItem, configUri))
            if (!config) {
                continue
            }
            log.debug(`Remove the TestItem: ${config.id}`)
            const targetRepo = this.getRepository(config)
            targetRepo.dispose()
            this._repos.delete(targetRepo)

            workspaceItem.children.delete(config.id)
            if (this.configManager.isMultiWorkspace) {
                if (workspaceItem.children.size < 1) {
                    log.debug(`Remove Workspace from the controller: ${workspaceItem.id}`)
                    this.controller.items.delete(workspaceItem.id)
                }
            } else {
                const targetId = this.generateConfigTestItemId(workspaceItem, configUri)
                log.debug(`Remove Configuration from the controller: ${targetId}`)
                this.controller.items.delete(targetId)
            }
        }
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
        )
        this.setMetadata(workspaceItem, {
            uri: workspaceFolder.uri,
            isWorkspace: true,
            isConfigFile: false,
            isSpecFile: false,
            isTestcase: false,
        })
        return workspaceItem
    }

    private async createWdioConfigTestItem(workspaceTestItem: vscode.TestItem, wdioConfigPath: string) {
        const uri = convertPathToUri(wdioConfigPath)
        const configItem = this.controller.createTestItem(
            this.generateConfigTestItemId(workspaceTestItem, uri),
            basename(wdioConfigPath),
            uri
        )

        workspaceTestItem.children.add(configItem)
        this._wdioConfigTestItems.push(configItem)

        const worker = await this.workerManager.getConnection(wdioConfigPath)
        const workspaceFolder = getWorkspaceFolder.call(this, this.configManager, configItem)
        const repo = new TestRepository(
            this.configManager,
            this.controller,
            worker,
            wdioConfigPath,
            configItem,
            this.workerManager,
            workspaceFolder
        )
        this._repos.add(repo)

        configItem.description = relative(workspaceTestItem.uri!.fsPath, dirname(wdioConfigPath))

        this.setMetadata(configItem, {
            uri,
            isWorkspace: false,
            isConfigFile: true,
            isSpecFile: false,
            isTestcase: false,
            repository: repo,
            runProfiles: createRunProfile.call(this, configItem, !this.isCreatedDefaultProfile),
        })
        return configItem
    }

    private generateConfigTestItemId(workspaceTestItem: vscode.TestItem, configUri: vscode.Uri) {
        return [workspaceTestItem.id, `config:${configUri.fsPath}`].join(TEST_ID_SEPARATOR)
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
                    if (!this._isInitialized) {
                        await this.initialize()
                    }
                    for (const repo of this._repos) {
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

    public async dispose() {
        await Promise.all(
            Array.from(this._repos).map(async (repo) => {
                await repo.dispose()
            })
        )
        this._repos.clear()
        this._workspaceTestItems = []
        this._wdioConfigTestItems = []
    }
}
