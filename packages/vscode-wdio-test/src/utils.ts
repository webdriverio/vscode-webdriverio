import * as path from 'node:path'

import { TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import * as vscode from 'vscode'

import { convertSourceRangeToVSCodeRange } from './converter.js'
import { createHandler } from './runHandler.js'

import type { IExtensionConfigManager, ITestRepository, TestData } from '@vscode-wdio/types'
import type { RepositoryManager } from './manager.js'
import type { MetadataRepository } from './metadata.js'

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

export function testTreeCreator(
    repository: ITestRepository,
    metadata: MetadataRepository,
    parentId: string,
    testCase: TestData,
    uri: vscode.Uri
) {
    const testCaseId = `${parentId}${TEST_ID_SEPARATOR}${testCase.name}`

    const testCaseItem = repository.controller.createTestItem(testCaseId, testCase.name, uri)

    metadata.createTestMetadata(testCaseItem, {
        uri,
        repository,
        testType: testCase.type,
    })

    testCaseItem.range = convertSourceRangeToVSCodeRange(testCase.range)

    for (const childTestCase of testCase.children) {
        testCaseItem.children.add(testTreeCreator(repository, metadata, testCaseId, childTestCase, uri))
    }
    return testCaseItem
}
