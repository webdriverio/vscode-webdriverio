import * as path from 'node:path'

import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import { getEnvOptions, normalizePath } from '@vscode-wdio/utils'
import * as vscode from 'vscode'

import { MetadataRepository } from './metadata.js'
import { filterSpecsByPaths, testTreeCreator } from './utils.js'

import type { IExtensionConfigManager, IWorkerManager, IWdioExtensionWorker, ITestRepository } from '@vscode-wdio/types'

class WorkerMiddleware {
    private _worker: IWdioExtensionWorker | undefined
    constructor(
        private _workerManager: IWorkerManager,
        private readonly _wdioConfigPath: string
    ) {}

    async getWorker() {
        if (!this._worker) {
            this._worker = await this._workerManager.getConnection(this._wdioConfigPath)
            this._worker.on('shutdown', () => {
                this._worker = undefined
            })
        }
        return this._worker
    }
}

/**
 * TestRepository class that manages all WebdriverIO tests at
 * the single WebdriverIO configuration file
 */
export class TestRepository extends WorkerMiddleware implements ITestRepository {
    private _specPatterns: string[] = []
    private _fileMap = new Map<string, vscode.TestItem>()
    private _framework: string | undefined = undefined

    constructor(
        public readonly configManager: IExtensionConfigManager,
        public readonly controller: vscode.TestController,
        public readonly wdioConfigPath: string,
        private _wdioConfigTestItem: vscode.TestItem,
        workerManager: IWorkerManager,
        private _workspaceFolder: vscode.WorkspaceFolder,
        private readonly _metadata = new MetadataRepository()
    ) {
        super(workerManager, wdioConfigPath)
    }

    public getMetadata(testItem: vscode.TestItem) {
        return this._metadata.getMetadata(testItem)
    }

    public getRepository(testItem: vscode.TestItem): ITestRepository {
        return this._metadata.getRepository(testItem)
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

    private async getEnvOptions() {
        return await getEnvOptions(this.configManager, this._workspaceFolder)
    }

    /**
     * Discover and register all tests from WebdriverIO configuration
     */
    public async discoverAllTests(): Promise<void> {
        try {
            const worker = await this.getWorker()
            const config = await worker.rpc.loadWdioConfig({
                env: await this.getEnvOptions(),
                configFilePath: this.wdioConfigPath,
            })

            if (!config) {
                return
            }
            if (this._fileMap.size > 0) {
                log.debug('Clearing all tests from repository before discover all tests')
                this._fileMap.clear()
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
                env: await this.getEnvOptions(),
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
            for (const spec of specsToReload) {
                const testItem = this.getSpecByFilePath(spec)
                if (testItem) {
                    testItem.busy = true
                    testItem.children.replace([])
                }
            }
            // Register the updated spec files
            await this.resisterSpecs(specsToReload, false)

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
     * @param replaceAllSpecFiles if all spec files to resister, this parameter must be true
     */
    private async resisterSpecs(specs: string[], replaceAllSpecFiles: boolean = true) {
        if (replaceAllSpecFiles) {
            this._fileMap.clear()
        }
        log.debug(`Spec files registration is started for: ${specs.length} files.`)
        const worker = await this.getWorker()
        const testData = await worker.rpc.readSpecs({
            env: await this.getEnvOptions(),
            specs,
        })

        const specFileTestItems = (
            await Promise.all(
                testData.map(async (test) => {
                    try {
                        // Create TestItem testFile by testFile
                        const fileId = this.getTestFileId(this._wdioConfigTestItem, test.spec)

                        const specFileUri = vscode.Uri.file(test.spec)

                        const fileTestItem = this.resisterSpecFile(fileId, specFileUri)
                        for (const testCase of test.tests) {
                            fileTestItem.children.add(
                                testTreeCreator(this, this._metadata, fileId, testCase, specFileUri)
                            )
                        }
                        return fileTestItem
                    } catch (error) {
                        log.error(`Failed to register spec: ${test.spec} - ${(error as Error).message}`)
                        return undefined
                    }
                })
            )
        ).filter((item) => typeof item !== 'undefined')

        if (replaceAllSpecFiles) {
            this._wdioConfigTestItem.children.replace(specFileTestItems)
        } else {
            for (const specFileTestItem of specFileTestItems) {
                if (this._wdioConfigTestItem.children.get(specFileTestItem.id)) {
                    this._wdioConfigTestItem.children.delete(specFileTestItem.id)
                }
                this._wdioConfigTestItem.children.add(specFileTestItem)
            }
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
     * Register a spec file with the test controller
     * @param id Spec file ID
     * @param uri Spec file URI
     * @returns TestItem for the spec file
     */
    private resisterSpecFile(id: string, uri: vscode.Uri) {
        log.trace(`[repository] spec file was registered: ${id}`)
        const fileTestItem = this.controller.createTestItem(id, path.basename(uri.fsPath), uri)
        fileTestItem.sortText = uri.fsPath

        this._metadata.createSpecFileMetadata(fileTestItem, { uri, repository: this })
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
