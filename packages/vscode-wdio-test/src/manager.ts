import { basename, dirname, relative } from 'node:path'

import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import * as vscode from 'vscode'

import { convertPathToUri } from './converter.js'
import { MetadataRepository } from './metadata.js'
import { TestRepository } from './repository.js'
import { createRunProfile } from './utils.js'
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

export class RepositoryManager implements IRepositoryManager {
    private readonly _repos = new Set<ITestRepository>()
    private _loadingTestItem: vscode.TestItem
    private _workspaceTestItems: vscode.TestItem[] = []
    private _wdioConfigTestItems: vscode.TestItem[] = []
    private _isInitialized = false
    private _isCreatedDefaultProfile = false

    constructor(
        public readonly controller: vscode.TestController,
        public readonly configManager: ExtensionConfigManager,
        private readonly _workerManager: IWorkerManager,
        private readonly _metadata = new MetadataRepository()
    ) {
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
                .then(async () => await Promise.all(this.repos.map(async (repo) => await repo.discoverAllTests())))
                .then(() => this.registerToTestController())
                .then(() => this._workerManager.reorganize(configManager.getWdioConfigPaths()))
        })
    }

    public get repos() {
        return Array.from(this._repos)
    }

    public getMetadata(testItem: vscode.TestItem) {
        return this._metadata.getMetadata(testItem)
    }

    public getRepository(testItem: vscode.TestItem): ITestRepository {
        return this._metadata.getRepository(testItem)
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
                const workspaceTestItem = this._createWorkspaceTestItem(workspace.workspaceFolder)
                for (const wdioConfigFile of workspace.wdioConfigFiles) {
                    await this._createWdioConfigTestItem(workspace.workspaceFolder, workspaceTestItem, wdioConfigFile)

                    this._isCreatedDefaultProfile = true
                }
                return workspaceTestItem
            })
        )
        this._isInitialized = true
        log.debug('Finish initialize the RepositoryManager')
    }

    public async addWdioConfig(workspaceFolder: vscode.WorkspaceFolder, wdioConfigPath: string) {
        const affectedWorkspaceItems = this._workspaceTestItems.filter((item) => {
            return item.uri?.fsPath === workspaceFolder.uri.fsPath
        })
        for (const workspaceTestItem of affectedWorkspaceItems) {
            const configTestItem = await this._createWdioConfigTestItem(
                workspaceFolder,
                workspaceTestItem,
                wdioConfigPath
            )

            const repo = this._metadata.getRepository(configTestItem)
            await repo.discoverAllTests()
            if (!this.configManager.isMultiWorkspace) {
                this.controller.items.add(configTestItem)
            }
        }
    }

    public removeWdioConfig(workspaceFolder: vscode.WorkspaceFolder, wdioConfigPath: string) {
        const affectedWorkspaceItems = this._workspaceTestItems.filter((item) => {
            return item.uri?.fsPath === workspaceFolder.uri.fsPath
        })
        log.debug(`Remove the config file from ${affectedWorkspaceItems.length} workspace(s)`)
        const configUri = convertPathToUri(wdioConfigPath)
        for (const workspaceItem of affectedWorkspaceItems) {
            const config = workspaceItem.children.get(this._generateConfigTestItemId(workspaceItem, configUri))
            if (!config) {
                continue
            }
            log.debug(`Remove the TestItem: ${config.id}`)
            const targetRepo = this._metadata.getRepository(config)
            targetRepo.dispose()
            this._repos.delete(targetRepo)

            workspaceItem.children.delete(config.id)
            if (this.configManager.isMultiWorkspace) {
                if (workspaceItem.children.size < 1) {
                    log.debug(`Remove Workspace from the controller: ${workspaceItem.id}`)
                    this.controller.items.delete(workspaceItem.id)
                }
            } else {
                const targetId = this._generateConfigTestItemId(workspaceItem, configUri)
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

    private _createWorkspaceTestItem(workspaceFolder: vscode.WorkspaceFolder) {
        const workspaceItem = this.controller.createTestItem(
            `workspace:${workspaceFolder.uri.fsPath}`,
            workspaceFolder.name,
            workspaceFolder.uri
        )
        this._metadata.createWorkspaceMetadata(workspaceItem, { uri: workspaceFolder.uri })
        return workspaceItem
    }

    private async _createWdioConfigTestItem(
        workspaceFolder: vscode.WorkspaceFolder,
        workspaceTestItem: vscode.TestItem,
        wdioConfigPath: string
    ) {
        const uri = convertPathToUri(wdioConfigPath)
        const configItem = this.controller.createTestItem(
            this._generateConfigTestItemId(workspaceTestItem, uri),
            basename(wdioConfigPath),
            uri
        )

        workspaceTestItem.children.add(configItem)
        this._wdioConfigTestItems.push(configItem)

        const repository = new TestRepository(
            this.configManager,
            this.controller,
            wdioConfigPath,
            configItem,
            this._workerManager,
            workspaceFolder
        )
        this._repos.add(repository)

        configItem.description = relative(workspaceTestItem.uri!.fsPath, dirname(wdioConfigPath))

        const runProfiles = createRunProfile.call(this, configItem, !this._isCreatedDefaultProfile)

        this._metadata.createWdioConfigFileMetadata(configItem, { uri, repository, runProfiles })
        return configItem
    }

    private _generateConfigTestItemId(workspaceTestItem: vscode.TestItem, configUri: vscode.Uri) {
        return [workspaceTestItem.id, `config:${configUri.fsPath}`].join(TEST_ID_SEPARATOR)
    }

    /**
     * Refresh WebdriverIO tests
     */
    public async refreshTests(): Promise<void> {
        this.controller.items.replace([this._loadingTestItem])
        try {
            if (!this._isInitialized) {
                await this.initialize()
            }
            await Promise.all(
                this.repos.map(async (repo) => {
                    return await repo.discoverAllTests()
                })
            )

            this.registerToTestController()
            await this._workerManager.reorganize(this.configManager.getWdioConfigPaths())
        } catch (error) {
            this.controller.items.replace([])
            const errorMessage = error instanceof Error ? error.message : String(error)
            log.error(`Failed to reload tests: ${errorMessage}`)
            vscode.window.showErrorMessage(`Failed to reload WebdriverIO tests: ${errorMessage}`)
        }
    }

    public async dispose() {
        await Promise.all(this.repos.map(async (repo) => repo.dispose()))
        this._repos.clear()
        this._workspaceTestItems = []
        this._wdioConfigTestItems = []
    }
}
