import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { log } from '../utils/logger.js'
import { convertPathToUri, parseAndConvertTestData } from './converter.js'
import { TEST_ID_SEPARATOR } from '../constants.js'
import { configManager } from '../config/index.js'

import type * as vscode from 'vscode'
import type { VscodeTestData } from './types.js'
import { filterSpecsByPaths } from './utils.js'

/**
 * TestRegistry class that manages all WebDriverIO tests in VSCode
 * Handles test discovery, registration, and management
 */
export class TestRegistry implements vscode.Disposable {
    // Mapping for the id and TestItem
    private _suiteMap = new Map<string, vscode.TestItem>()
    private _fileMap = new Map<string, vscode.TestItem>()

    constructor(
        public readonly controller: vscode.TestController,
        private _loadingTestItem: vscode.TestItem
    ) {
        this._loadingTestItem.busy = true
        this.controller.items.add(this._loadingTestItem)
    }

    /**
     * Discover and register all tests from WebDriverIO configuration
     */
    public async discoverAllTests(): Promise<void> {
        try {
            // Show loading indicator
            this._loadingTestItem.busy = true
            if (!this.controller.items.get(this._loadingTestItem.id)) {
                this.controller.items.add(this._loadingTestItem)
            }

            // Get WebDriverIO configuration
            const config = await configManager.getWdioConfig()
            log.debug('Loaded configuration successfully.')

            // Get specs from configuration
            const allSpecs = this.convertPathString(config.getSpecs())

            if (allSpecs.length < 1) {
                log.debug('No spec files found in configuration')
                this.removeLoadingItem()
                return
            }

            log.debug(`Discovered ${allSpecs.length} spec files`)

            // Register all specs
            await this.resisterSpecs(allSpecs)
        } catch (error) {
            log.error(`Failed to discover tests: ${(error as Error).message}`)
            this.removeLoadingItem()
        }
    }

    /**
     * Reload tests for specific files
     * @param filePaths Paths of files to reload
     */
    public async reloadSpecFiles(filePaths: string[]): Promise<void> {
        if (!filePaths || filePaths.length === 0) {
            log.debug('No files specified for reload')
            return
        }

        try {
            // Get all spec files from config
            const config = await configManager.getWdioConfig()
            const allConfigSpecs = this.convertPathString(config.getSpecs())
            // Filter specs to only include those that match the provided file paths
            const specsToReload = filterSpecsByPaths(allConfigSpecs, filePaths)
            if (specsToReload.length === 0) {
                log.debug('No matching spec files found for reload')
                return
            }

            log.debug(`Reloading ${specsToReload.length} spec files`)

            // Set busy state for affected test items
            const affectedTestItems: vscode.TestItem[] = []

            for (const spec of specsToReload) {
                const normalizedPath = this.convertPathToId(spec)
                const testItem = this._fileMap.get(normalizedPath)

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

            // Make sure to reset busy state even if reload fails
            for (const spec of filePaths) {
                const normalizedPath = this.convertPathToId(spec)
                const testItem = this._fileMap.get(normalizedPath)
                if (testItem) {
                    testItem.busy = false
                }
            }
        }
    }

    /**
     * Register spec files with the test controller
     * @param specs Paths to spec files
     * @param clearExisting Whether to clear existing tests (default: true)
     * @param customParseFunction Optional custom parser function
     */
    public async resisterSpecs(
        specs: string[],
        clearExisting: boolean = true,
        customParseFunction?: (content: string, filePath: string) => Promise<VscodeTestData[]>
    ) {
        if (clearExisting) {
            this._suiteMap.clear()
            this._fileMap.clear()
        }

        const parseFunction = customParseFunction || parseAndConvertTestData
        const fileTestItems = (
            await Promise.all(
                specs.map(async (spec) => {
                    try {
                        // Create TestItem testFile by testFile
                        log.debug(`Parse spec files: ${spec}`)
                        const testTreeCreator = (parentId: string, testCase: VscodeTestData) => {
                            const testCaseId = `${parentId}${TEST_ID_SEPARATOR}${testCase.name}`
                            const testCaseItem = this.controller.createTestItem(testCaseId, testCase.name, testCase.uri)
                            testCaseItem.range = testCase.range
                            if (testCase.type === 'describe') {
                                this._suiteMap.set(testCaseId, testCaseItem)
                            }
                            for (const childTestCase of testCase.children) {
                                testCaseItem.children.add(testTreeCreator(testCaseId, childTestCase))
                            }
                            return testCaseItem
                        }

                        const fileId = this.convertPathToId(spec)

                        const fileContent = await this.readSpecFile(spec)
                        const testCases = await parseFunction(fileContent, spec)

                        const fileTestItem = this.resisterSpecFile(fileId, convertPathToUri(spec))

                        // Create TestItem testCase by testCase
                        for (const testCase of testCases) {
                            fileTestItem.children.add(testTreeCreator(fileId, testCase))
                        }
                        return fileTestItem
                    } catch (error) {
                        log.error(`Failed to register spec: ${spec} - ${(error as Error).message}`)
                        return undefined
                    }
                })
            )
        ).filter((item) => typeof item !== 'undefined')

        if (clearExisting) {
            // Replace all items
            this.controller.items.replace(fileTestItems)
        } else {
            // Add new items while preserving existing ones
            const currentItems = Array.from(this.controller.items)
                .map(([_id, item]) => item)
                .filter((item) => item !== this._loadingTestItem)

            // Remove items with the same ID
            const newItemIds = new Set<string>()
            fileTestItems.forEach((item) => newItemIds.add(item.id))

            const filteredCurrentItems = currentItems.filter((item) => !newItemIds.has(item.id))

            // Combine existing and new items
            this.controller.items.replace([...filteredCurrentItems, ...fileTestItems])
        }

        // Remove loading indicator
        this.removeLoadingItem()
    }

    /**
     * Remove a specific spec file from the registry
     * @param specPath Path to the spec file to remove
     */
    public removeSpecFile(specPath: string): void {
        const normalizedPath = this.convertPathToId(specPath)

        // Get the TestItem for this spec file
        const fileItem = this._fileMap.get(normalizedPath)
        if (!fileItem) {
            log.debug(`Spec file not found in registry: ${specPath}`)
            return
        }

        // Remove all suites associated with this file
        fileItem.children.forEach((child) => {
            const suiteId = child.id
            this._suiteMap.delete(suiteId)

            // Also remove any nested suites
            this.removeNestedSuites(suiteId)
        })

        // Remove the file from the registry
        this._fileMap.delete(normalizedPath)

        // Remove from the test controller
        this.controller.items.delete(fileItem.id)

        log.debug(`Removed spec file: ${specPath}`)
    }

    /**
     * Convert spec paths from WebDriverIO config to file system paths
     */
    private convertPathString(specs: (string | string[])[]) {
        return specs.flatMap((spec) =>
            Array.isArray(spec) ? spec.map((path) => fileURLToPath(path)) : [fileURLToPath(spec)]
        )
    }

    /**
     * Recursively remove nested suites from the registry
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
     * Clear all tests from the registry
     */
    public clearTests(): void {
        log.debug('Clearing all tests from registry')

        // Clear internal maps
        this._suiteMap.clear()
        this._fileMap.clear()

        // Clear test controller items
        this.controller.items.replace([this._loadingTestItem])
        this._loadingTestItem.busy = true
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
     * Remove the loading item from the test controller
     */
    public removeLoadingItem() {
        this._loadingTestItem.busy = false
        this.controller.items.delete(this._loadingTestItem.id)
    }

    /**
     * Register a spec file with the test controller
     * @param id Spec file ID
     * @param spec Spec file URI
     * @returns TestItem for the spec file
     */
    private resisterSpecFile(id: string, spec: vscode.Uri) {
        const fileTestItem = this.controller.createTestItem(id, path.basename(spec.fsPath), spec)
        this._fileMap.set(id, fileTestItem)
        return fileTestItem
    }

    /**
     * Convert a path to an ID
     * @param specPath Path to convert
     * @returns Normalized path as ID
     */
    public convertPathToId(specPath: string) {
        return path.normalize(specPath)
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
    public getSpecById(specPath: string) {
        const _specPath = specPath.startsWith('file://') ? fileURLToPath(specPath) : specPath

        const id = this.convertPathToId(_specPath)
        return this._fileMap.get(id)
    }

    /**
     * Dispose of resources
     */
    public dispose() {
        this._suiteMap.clear()
        this._fileMap.clear()
    }
}
