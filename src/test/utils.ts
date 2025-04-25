import * as path from 'node:path'

import * as vscode from 'vscode'

import { createHandler } from './runHandler.js'
import type { RepositoryManager } from './manager.js'

import type {
    BaseTestItemMetadata,
    SpecFileTestItem,
    TestcaseTestItem,
    WdioConfigTestItem,
    WdioTestItem,
    WorkspaceTestItem,
} from './types.js'

/**
 * Filter spec files by paths
 * @param allSpecs All spec files from configuration
 * @param filterPaths Paths to filter by
 * @returns Filtered spec files
 */
export function filterSpecsByPaths(allSpecs: string[], filterPaths: string[]): string[] {
    // Normalize paths for comparison
    const normalizedFilterPaths = filterPaths.map((file) => path.normalize(file))

    // Filter specs
    return allSpecs.filter((configSpec) => {
        const normalizedConfigSpec = path.normalize(configSpec)
        return normalizedFilterPaths.some((specFile) => {
            return (
                normalizedConfigSpec === specFile ||
                normalizedConfigSpec.includes(specFile) ||
                specFile.includes(normalizedConfigSpec)
            )
        })
    })
}

export const isWdioTestItem = (testItem: vscode.TestItem): testItem is WdioTestItem =>
    'metadata' in testItem &&
    typeof testItem.metadata !== 'undefined' &&
    typeof (testItem.metadata as BaseTestItemMetadata).isWorkspace === 'boolean' &&
    typeof (testItem.metadata as BaseTestItemMetadata).isConfigFile === 'boolean' &&
    typeof (testItem.metadata as BaseTestItemMetadata).isSpecFile === 'boolean'

export const isWorkspace = (testItem: vscode.TestItem): testItem is WorkspaceTestItem =>
    isWdioTestItem(testItem) && Boolean(testItem.metadata.isWorkspace)

export const isConfig = (testItem: vscode.TestItem): testItem is WdioConfigTestItem =>
    isWdioTestItem(testItem) && Boolean(testItem.metadata.isConfigFile)

export const isSpec = (testItem: vscode.TestItem): testItem is SpecFileTestItem =>
    isWdioTestItem(testItem) && Boolean(testItem.metadata.isSpecFile)

export const isTestcase = (testItem: vscode.TestItem): testItem is TestcaseTestItem =>
    isWdioTestItem(testItem) &&
    !testItem.metadata.isWorkspace &&
    !testItem.metadata.isConfigFile &&
    !testItem.metadata.isSpecFile

export function createRunProfile(
    repositoryManager: RepositoryManager,
    wdioConfigFile: string,
    isDefaultProfile: boolean
) {
    repositoryManager.controller.createRunProfile(
        path.basename(wdioConfigFile),
        vscode.TestRunProfileKind.Run,
        createHandler(repositoryManager.configManager, repositoryManager),
        isDefaultProfile
    )
}
