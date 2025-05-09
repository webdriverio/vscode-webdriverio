import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { convertPathToUri, convertTestData } from './converter.js'
import { TEST_ID_SEPARATOR } from '../constants.js'
import { filterSpecsByPaths } from './utils.js'
import { log } from '../utils/logger.js'
import { normalizePath } from '../utils/normalize.js'

import type * as vscode from 'vscode'
import type { SpecFileTestItem, TestcaseTestItem, VscodeTestData, WdioConfigTestItem } from './types.js'
import type { WdioExtensionWorkerInterface } from '../api/index.js'

/**
 * TestRepository class that manages all WebdriverIO tests at
 * the single WebdriverIO configuration file
 */
export class TestRepository implements vscode.Disposable {
    private _specPatterns:string[] = []
    private _suiteMap = new Map<string, TestcaseTestItem>() // Mapping for the id and TestItem
    private _fileMap = new Map<string, SpecFileTestItem>()
    private _framework: string | undefined = undefined
    constructor(
        public readonly controller: vscode.TestController,
        public readonly worker: WdioExtensionWorkerInterface,
        public readonly wdioConfigPath: string,
        private _wdioConfigTestItem: WdioConfigTestItem
    ) {}

    public get specPatterns(){
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
            const config = await this.worker.rpc.loadWdioConfig({ configFilePath: this.wdioConfigPath })

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
            const config = await this.worker.rpc.loadWdioConfig({ configFilePath: this.wdioConfigPath })
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
            log.error(`Failed to reload spec files: ${(error as Error).message}`)
            log.trace(`Failed to reload spec files: ${(error as Error).stack}`)

            // Make sure to reset busy state even if reload fails
            for (const spec of filePaths) {
                const testItem = this.getSpecByFilePath(spec)
                if (testItem) {
                    testItem.busy = false
                }
            }
        }
    }

    private getTestFileId(wdioConfigTestItem: WdioConfigTestItem, testFilePath: string) {
        return [wdioConfigTestItem.id, testFilePath].join(TEST_ID_SEPARATOR)
    }
    /**
     * Register spec files with the test controller
     * @param specs Paths to spec files
     * @param clearExisting Whether to clear existing tests (default: true)
     */
    private async resisterSpecs(specs: string[], clearExisting: boolean = true) {
        if (clearExisting) {
            this._suiteMap.clear()
            this._fileMap.clear()
        }
        log.debug(`Spec files registration is started for: ${specs.length} files.`)
        const testData = await this.worker.rpc.readSpecs({ specs })

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

                            const testCaseItem = this.controller.createTestItem(
                                testCaseId,
                                testCase.name,
                                testCase.uri
                            ) as TestcaseTestItem

                            testCaseItem.metadata = {
                                isWorkspace: false,
                                isConfigFile: false,
                                isSpecFile: false,
                                repository: this,
                                type: testCase.type,
                            }

                            testCaseItem.range = testCase.range

                            // Add metadata as custom properties if available
                            if (testCase.metadata) {
                                // Use type assertion since customData isn't in TypeScript definition
                                ;(testCaseItem as any).customData = testCase.metadata
                            }

                            if (
                                testCase.type === 'describe' ||
                                testCase.type === 'feature' ||
                                testCase.type === 'scenario' ||
                                testCase.type === 'scenarioOutline' ||
                                testCase.type === 'background' ||
                                testCase.type === 'rule' ||
                                testCase.type === 'step'
                            ) {
                                log.trace(`[repository] test was registered: ${testCaseId}`)
                                this._suiteMap.set(testCaseId, testCaseItem)
                            }

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

        // Remove all suites associated with this file
        fileItem.children.forEach((child) => {
            const suiteId = child.id
            this._suiteMap.delete(suiteId)

            // Also remove any nested suites
            this.removeNestedSuites(suiteId)
        })

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
     * Recursively remove nested suites from the repository
     * @param parentId Parent suite ID
     */
    private removeNestedSuites(parentId: string): void {
        // Find all suites that have this parent as a prefix
        const prefix = `${parentId}${TEST_ID_SEPARATOR}`

        // Create a list of suites to remove
        const suitesToRemove = Array.from(this._suiteMap.entries())
            .filter(([id]) => id.startsWith(prefix))
            .map(([id]) => id)

        // Remove each matching suite
        for (const suiteId of suitesToRemove) {
            this._suiteMap.delete(suiteId)

            // Recursively remove children
            this.removeNestedSuites(suiteId)
        }
    }

    /**
     * Clear all tests from the repository
     */
    public clearTests(): void {
        log.debug('Clearing all tests from repository')

        // Clear internal maps
        this._suiteMap.clear()
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
     * @param spec Spec file URI
     * @returns TestItem for the spec file
     */
    private resisterSpecFile(id: string, spec: vscode.Uri) {
        log.trace(`[repository] spec file was registered: ${id}`)
        const fileTestItem = this.controller.createTestItem(id, path.basename(spec.fsPath), spec) as SpecFileTestItem
        fileTestItem.sortText = spec.fsPath
        fileTestItem['metadata'] = {
            isWorkspace: false,
            isConfigFile: false,
            isSpecFile: true,
            repository: this,
        }
        this._fileMap.set(id, fileTestItem)
        return fileTestItem
    }

    /**
     * Search for a suite by name
     * @param suiteName Suite name to search for
     * @param parent Parent test item
     * @returns TestItem for the suite if found
     */
    public searchSuite(suiteName: string, parent: vscode.TestItem): vscode.TestItem | undefined {
        const id = `${parent.id}${TEST_ID_SEPARATOR}${suiteName}`
        const suiteItem = this._suiteMap.get(id)
        if (suiteItem) {
            return suiteItem
        }
        if (parent.parent) {
            return this.searchSuite(suiteName, parent.parent)
        }
        const errorMessage = `proper test suite is not found: ${suiteName}`
        log.debug(errorMessage)
        return undefined
    }

    /**
     * Get a spec file by ID
     * @param specPath Path to the spec file
     * @returns TestItem for the spec file
     */
    public getSpecByFilePath(specPath: string) {
        const normalizedSpecFilePath = normalizePath(specPath)
        log.trace(`searching the file :${normalizedSpecFilePath}`)
        for (const [key, value] of this._fileMap.entries()) {
            // The path of the Spec file is the third one, as it is the next level after Workspace,WdioConfig.
            const candidatePath = key.split(TEST_ID_SEPARATOR)[2]
            if (typeof key === 'string' && normalizedSpecFilePath === candidatePath) {
                return value
            }
        }

        return undefined
    }

    /**
     * Dispose of resources
     */
    public dispose() {
        this._wdioConfigTestItem.metadata.runProfiles.forEach((p)=>p.dispose())
        this._suiteMap.clear()
        this._fileMap.clear()
    }
}
