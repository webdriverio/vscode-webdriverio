import * as path from 'node:path'

import type * as vscode from 'vscode'
import type {
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

export function isWdioTestItem(testItem: vscode.TestItem): testItem is WdioTestItem {
    return 'metadata' in testItem
}

export function isWorkspace(testItem: vscode.TestItem): testItem is WorkspaceTestItem {
    return isWdioTestItem(testItem) && testItem.metadata.isWorkspace
}

export function isConfig(testItem: vscode.TestItem): testItem is WdioConfigTestItem {
    return isWdioTestItem(testItem) && testItem.metadata.isConfigFile
}

export function isSpec(testItem: vscode.TestItem): testItem is SpecFileTestItem {
    return isWdioTestItem(testItem) && testItem.metadata.isSpecFile
}

export function isTestcase(testItem: vscode.TestItem): testItem is TestcaseTestItem {
    return (
        isWdioTestItem(testItem) &&
        !testItem.metadata.isWorkspace &&
        !testItem.metadata.isConfigFile &&
        !testItem.metadata.isSpecFile
    )
}
