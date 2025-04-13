import path from 'node:path'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vscode from 'vscode'

import { parseTestCases, type TestCaseInfo } from './parser.js'
import { configManager } from '../config/index.js'
import { log } from './logger.js'

type Spec = string | string[]

export const discoverTests = async (testController: vscode.TestController) => {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
        log.debug('No workspace is detected.')
        return
    }
    try {
        if (workspaceFolders.length === 1) {
            const workspaceFolder = workspaceFolders[0]
            log.debug(`Detected workspace path: ${workspaceFolder.uri.fsPath}`)

            const config = await configManager.getWdioConfig(workspaceFolder.uri.fsPath)
            if (!config) {
                throw new Error('Failed to load the configuration.')
            }

            log.debug('Loaded configuration successfully.')
            const specs = convertUri(config.getSpecs())

            log.debug(`Detected spec files: ${specs.length}`)
            await loadWdioSpecs(testController, specs)
        } else {
            //TODO: support multiple workspace
            log.debug(`Detected ${workspaceFolders.length} workspaces.`)
            log.warn('Not support the multiple workspaces')
        }
    } catch (error) {
        log.error(`Failed to load specs: ${(error as Error).message}`)
    }
}

function convertUri(specs: Spec[]) {
    return specs.flatMap((spec) =>
        Array.isArray(spec)
            ? spec.map((path) => vscode.Uri.file(fileURLToPath(path)))
            : [vscode.Uri.file(fileURLToPath(spec))]
    )
}

async function loadWdioSpecs(controller: vscode.TestController, specs: vscode.Uri[]) {
    await Promise.all(
        specs.map(async (spec) => {
            // Create TestItem testFile by testFile
            log.debug(`Parse spec files: ${spec.fsPath}`)
            const fileTestItem = controller.createTestItem(spec.fsPath, path.basename(spec.fsPath), spec)
            const fileContent = await fs.readFile(spec.fsPath, { encoding: 'utf8' })
            const document = await vscode.workspace.openTextDocument(spec)
            const testCases = parseTestCases(fileContent, document)
            const testTreeCreator = (parentId: string, testCase: TestCaseInfo) => {
                const testCaseId = `${parentId}#${testCase.name}`
                const testCaseItem = controller.createTestItem(testCaseId, testCase.name, spec)
                testCaseItem.range = testCase.range
                for (const childTestCase of testCase.children) {
                    testCaseItem.children.add(testTreeCreator(testCaseId, childTestCase))
                }
                return testCaseItem
            }
            // Create TestItem testCase by testCase
            for (const testCase of testCases) {
                fileTestItem.children.add(testTreeCreator(spec.fsPath, testCase))
            }
            controller.items.add(fileTestItem)
        })
    )
}
