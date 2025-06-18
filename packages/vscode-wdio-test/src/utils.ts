import * as path from 'node:path'

import * as vscode from 'vscode'

import { createHandler } from './runHandler.js'
import type { IExtensionConfigManager } from '@vscode-wdio/types/config'
import type { RepositoryManager } from './manager.js'

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

export function createRunProfile(
    this: RepositoryManager,
    wdioConfigFileTestItem: vscode.TestItem,
    isDefaultProfile: boolean
) {
    const description = wdioConfigFileTestItem.description ? ` (${wdioConfigFileTestItem.description})` : ''
    return [
        this.controller.createRunProfile(
            `${path.basename(wdioConfigFileTestItem.uri!.fsPath)}${description}`,
            vscode.TestRunProfileKind.Run,
            createHandler(this.configManager, this),
            isDefaultProfile
        ),
        this.controller.createRunProfile(
            `${path.basename(wdioConfigFileTestItem.uri!.fsPath)}${description}`,
            vscode.TestRunProfileKind.Debug,
            createHandler(this.configManager, this, true),
            isDefaultProfile
        ),
    ]
}

export function getRootTestItem(testItem: vscode.TestItem) {
    let _testItem = testItem.parent
    if (typeof _testItem === 'undefined') {
        return testItem
    }

    while (typeof _testItem !== 'undefined') {
        if (typeof _testItem.parent !== 'undefined') {
            _testItem = _testItem.parent
        } else {
            break
        }
    }
    return _testItem
}

export function getWorkspaceFolder(
    this: RepositoryManager,
    configManager: IExtensionConfigManager,
    testItem: vscode.TestItem
) {
    if (!configManager.isMultiWorkspace) {
        return getWorkspace(configManager.getWorkspaces()[0].uri)
    }
    const metadata = this.getMetadata(getRootTestItem(testItem))
    return getWorkspace(metadata.uri)
}

function getWorkspace(uri: vscode.Uri) {
    const workspace = vscode.workspace.getWorkspaceFolder(uri)
    if (!workspace) {
        throw new Error(`Workspace is not found: ${uri.fsPath}`)
    }
    return workspace
}
