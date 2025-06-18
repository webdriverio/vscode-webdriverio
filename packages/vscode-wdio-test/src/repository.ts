import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import { normalizePath } from '@vscode-wdio/utils'

import { convertPathToUri, convertTestData } from './converter.js'
import { MetadataRepository } from './metadata.js'
import { filterSpecsByPaths } from './utils.js'

import type { IWorkerManager, IWdioExtensionWorker } from '@vscode-wdio/types/server'
import type { VscodeTestData, ITestRepository } from '@vscode-wdio/types/test'
import type * as vscode from 'vscode'

class WorkerProxy extends MetadataRepository {
    private _worker: IWdioExtensionWorker | undefined
    constructor(
        private readonly _wdioConfigPath: string,
        worker: IWdioExtensionWorker,
        private workerManager: IWorkerManager
    ) {
        super()
        this._worker = worker
        this._worker.on('shutdown', () => {
            this._worker = undefined
        })
    }

    async getWorker() {
        if (!this._worker) {
            this._worker = await this.workerManager.getConnection(this._wdioConfigPath)
        }
        return this._worker
    }
}

/**
 * TestRepository class that manages all WebdriverIO tests at
 * the single WebdriverIO configuration file
 */
export class TestRepository extends WorkerProxy implements ITestRepository {
    private _specPatterns: string[] = []
    private _fileMap = new Map<string, vscode.TestItem>()
    private _framework: string | undefined = undefined

    constructor(
        public readonly controller: vscode.TestController,
        _worker: IWdioExtensionWorker,
        public readonly wdioConfigPath: string,
        private _wdioConfigTestItem: vscode.TestItem,
        workerManager: IWorkerManager
    ) {
        super(wdioConfigPath, _worker, workerManager)
    }

    public get specPatterns() {
        return this._specPatterns
    }

    public get framework() {
        if (!this._framework) {
            throw new Error('The configuration for WebdriverIO is not loaded')
        }
        return this._framework
    }

    /**
     * Discover and register all tests from WebdriverIO configuration
     */
    public async discoverAllTests(): Promise<void> {
        try {
            const worker = await this.getWorker()
            const config = await worker.rpc.loadWdioConfig({
                env: { paths: [], override: false }, // TODO: implement the logic for envFile
                configFilePath: this.wdioConfigPath,
            })

            if (!config) {
                return
            }

            this._framework = config.framework
            this._specPatterns = config.specPatterns

            // Get specs from configuration
            const allSpecs = this.convertPathString(config.specs)

            if (allSpecs.length < 1) {
                log.debug('No spec files found in configuration')
                return
            }

            log.debug(`Discovered ${allSpecs.length} spec files`)

            // Register all specs
            return await this.resisterSpecs(allSpecs)
        } catch (error) {
            log.error(`Failed to discover tests: ${(error as Error).message}`)
            log.trace(`Failed to discover tests: ${(error as Error).stack}`)
        }
    }

    /**
     * Reload tests for specific files
     * @param filePaths Paths of files to reload
     */
    public async reloadSpecFiles(filePaths: string[] = []): Promise<void> {
        try {
            const worker = await this.getWorker()
            const config = await worker.rpc.loadWdioConfig({
                env: { paths: [], override: false }, // TODO: implement the logic for envFile
                configFilePath: this.wdioConfigPath,
            })
            if (!config) {
                return
            }

            this._framework = config.framework
            this._specPatterns = config.specPatterns

            // Get specs from configuration
            const allConfigSpecs = this.convertPathString(config.specs)
            if (!filePaths || filePaths.length === 0) {
                for (const [fileId] of this._fileMap.entries()) {
                    this.removeSpecFileById(fileId)
                }
            }
            // Filter specs to only include those that match the provided file paths
            const specsToReload =
                !filePaths || filePaths.length === 0 ? allConfigSpecs : filterSpecsByPaths(allConfigSpecs, filePaths)

            if (specsToReload.length === 0) {
                // TODO: If there is information in the Repository but it cannot be retrieved from the actual configuration file,
                // there may be a discrepancy in the configuration.
                // In this case, consider using a reload of the entire file.
                log.debug('No matching spec files found for reload')
                return
            }

            log.debug(`Reloading ${specsToReload.length} spec files`)

            // Set busy state for affected test items
            const affectedTestItems: vscode.TestItem[] = []

            for (const spec of specsToReload) {
                const testItem = this.getSpecByFilePath(spec)
                if (testItem) {
                    // Set busy state before removal
                    testItem.busy = true
                    affectedTestItems.push(testItem)

                    // Remove existing test items for this file
                    this.removeSpecFile(spec)
                }
            }
            // Register the updated spec files
            await this.resisterSpecs(specsToReload, false)

            // Reset busy state for all affected items
            affectedTestItems.forEach((item) => {
                // Find the newly registered item with the same ID
                const newItem = this._fileMap.get(item.id)
                if (newItem) {
                    newItem.busy = false
                }
            })

            log.debug(`Successfully reloaded ${specsToReload.length} spec files`)
        } catch (error) {
            log.error(`Failed to reload spec files: ${this.wdioConfigPath}`)
            const msg = error instanceof Error ? error.message : String(error)
            log.debug(`Failed to reload spec files: ${msg}`)

            this._fileMap.clear()
            this._wdioConfigTestItem.children.replace([])
            // Make sure to reset busy state even if reload fails
            for (const spec of filePaths) {
                const testItem = this.getSpecByFilePath(spec)
                if (testItem) {
                    testItem.busy = false
                }
            }
        }
    }

    private getTestFileId(wdioConfigTestItem: vscode.TestItem, testFilePath: string) {
        return [wdioConfigTestItem.id, testFilePath].join(TEST_ID_SEPARATOR)
    }
    /**
     * Register spec files with the test controller
     * @param specs Paths to spec files
     * @param clearExisting Whether to clear existing tests (default: true)
     */
    private async resisterSpecs(specs: string[], clearExisting: boolean = true) {
        if (clearExisting) {
            this._fileMap.clear()
        }
        log.debug(`Spec files registration is started for: ${specs.length} files.`)
        const worker = await this.getWorker()
        const testData = await worker.rpc.readSpecs({
            env: { paths: [], override: false }, // TODO: implement the logic for envFile
            specs,
        })

        const fileTestItems = (
            await Promise.all(
                testData.map(async (test) => {
                    try {
                        // Create TestItem testFile by testFile
                        const fileId = this.getTestFileId(this._wdioConfigTestItem, test.spec)

                        const testCases = await convertTestData(test)

                        const fileTestItem = this.resisterSpecFile(fileId, convertPathToUri(test.spec))

                        const testTreeCreator = (parentId: string, testCase: VscodeTestData) => {
                            const testCaseId = `${parentId}${TEST_ID_SEPARATOR}${testCase.name}`

                            const testCaseItem = this.controller.createTestItem(testCaseId, testCase.name, testCase.uri)

                            this.setMetadata(testCaseItem, {
                                uri: testCase.uri,
                                isWorkspace: false,
                                isConfigFile: false,
                                isSpecFile: false,
                                isTestcase: true,
                                repository: this,
                                type: testCase.type,
                            })

                            testCaseItem.range = testCase.range

                            for (const childTestCase of testCase.children) {
                                testCaseItem.children.add(testTreeCreator(testCaseId, childTestCase))
                            }
                            return testCaseItem
                        }

                        // Create TestItem testCase by testCase
                        for (const testCase of testCases) {
                            fileTestItem.children.add(testTreeCreator(fileId, testCase))
                        }
                        return fileTestItem
                    } catch (error) {
                        log.error(`Failed to register spec: ${test.spec} - ${(error as Error).message}`)
                        return undefined
                    }
                })
            )
        ).filter((item) => typeof item !== 'undefined')

        if (clearExisting) {
            // Replace all items
            this._wdioConfigTestItem.children.replace(fileTestItems)
        } else {
            // Add new items while preserving existing ones
            const currentItems = Array.from(this._wdioConfigTestItem.children).map(([_id, item]) => item)

            // Remove items with the same ID
            const newItemIds = new Set<string>()
            fileTestItems.forEach((item) => newItemIds.add(item.id))

            const filteredCurrentItems = currentItems.filter((item) => !newItemIds.has(item.id))

            // Combine existing and new items
            this._wdioConfigTestItem.children.replace([...filteredCurrentItems, ...fileTestItems])
        }
        log.debug(`spec files registration is finished for: ${specs.length} files.`)
    }

    /**
     * Remove a specific spec file from the repository
     * @param specPath Path to the spec file to remove
     */
    public removeSpecFile(specPath: string): void {
        const normalizedPath = normalizePath(specPath)
        const fileId = this.getTestFileId(this._wdioConfigTestItem, normalizedPath)
        this.removeSpecFileById(fileId, specPath)
    }

    private removeSpecFileById(fileId: string, _specPath?: string): void {
        const specPath = _specPath ? _specPath : fileId.split(TEST_ID_SEPARATOR)[2]
        // Get the TestItem for this spec file
        const fileItem = this._fileMap.get(fileId)
        if (!fileItem) {
            log.debug(`Spec file not found in repository: ${specPath}`)
            return
        }

        // Remove the file from the repository
        this._fileMap.delete(fileId)

        // Remove from the test controller
        this._wdioConfigTestItem.children.delete(fileItem.id)

        log.debug(`Removed spec file: ${specPath}`)
    }

    /**
     * Convert spec paths from WebdriverIO config to file system paths
     */
    private convertPathString(specs: (string | string[])[]) {
        return specs.flatMap((spec) => (Array.isArray(spec) ? spec.map((path) => path) : [spec]))
    }

    /**
     * Clear all tests from the repository
     */
    public clearTests(): void {
        log.debug('Clearing all tests from repository')

        // Clear internal maps
        this._fileMap.clear()
    }

    /**
     * Read a spec file
     * @param filePath Path to the spec file
     * @returns File content
     */
    protected async readSpecFile(filePath: string): Promise<string> {
        return await fs.readFile(filePath, { encoding: 'utf8' })
    }

    /**
     * Register a spec file with the test controller
     * @param id Spec file ID
     * @param uri Spec file URI
     * @returns TestItem for the spec file
     */
    private resisterSpecFile(id: string, uri: vscode.Uri) {
        log.trace(`[repository] spec file was registered: ${id}`)
        const fileTestItem = this.controller.createTestItem(id, path.basename(uri.fsPath), uri)
        fileTestItem.sortText = uri.fsPath

        this.setMetadata(fileTestItem, {
            uri,
            isWorkspace: false,
            isConfigFile: false,
            isSpecFile: true,
            isTestcase: false,
            repository: this,
        })
        this._fileMap.set(id, fileTestItem)
        return fileTestItem
    }

    /**
     * Get a spec file by ID
     * @param specPath Path to the spec file
     * @returns TestItem for the spec file
     */
    public getSpecByFilePath(specPath: string) {
        const normalizedSpecFilePath = normalizePath(specPath)
        log.trace(`Detecting the file :${normalizedSpecFilePath}`)
        for (const [key, value] of this._fileMap.entries()) {
            // The path of the Spec file is the third one, as it is the next level after Workspace,WdioConfig.
            const candidatePath = key.split(TEST_ID_SEPARATOR)[2]
            if (normalizedSpecFilePath === normalizePath(candidatePath)) {
                log.trace(`Detected spec file :${normalizedSpecFilePath}`)
                return value
            }
        }

        return undefined
    }

    /**
     * Dispose of resources
     */
    public dispose() {
        const metadata = this.getMetadata(this._wdioConfigTestItem)
        if (metadata.runProfiles) {
            metadata.runProfiles.forEach((p) => p.dispose())
        }
        this._fileMap.clear()
    }
}
