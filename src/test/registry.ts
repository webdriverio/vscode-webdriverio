import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import * as vscode from 'vscode'

import { log } from '../utils/logger.js'
import { parseTestCases } from './parser.js'
import { TEST_ID_SEPARATOR } from '../constants.js'

import type { TestCaseInfo } from './types.js'
/**
 * test.spec.js            <-- spec
 *   ├─describe('xxx'...)  <-- suite
 *   │   └─test or it(...  <-- test
 *   │─describe('xxx'...)  <-- suite
 *   │   └─describe(...    <-- suite
 */

export class TestRegistry implements vscode.Disposable {
    // Mapping for the id and TestItem
    private _suiteMap = new Map<string, vscode.TestItem>()
    private _fileMap = new Map<string, vscode.TestItem>()

    constructor(public readonly controller: vscode.TestController) {}

    public async resisterSpecs(specs: vscode.Uri[]) {
        this._suiteMap.clear()
        this._fileMap.clear()

        await Promise.all(
            specs.map(async (spec) => {
                // Create TestItem testFile by testFile
                log.debug(`Parse spec files: ${spec.fsPath}`)
                const fileId = this.convertPathToId(spec.fsPath)

                const fileTestItem = this.resisterSpecFile(fileId, spec)

                const fileContent = await fs.readFile(spec.fsPath, { encoding: 'utf8' })
                const document = await vscode.workspace.openTextDocument(spec)
                const testCases = parseTestCases(fileContent, document)

                const testTreeCreator = (parentId: string, testCase: TestCaseInfo) => {
                    const testCaseId = `${parentId}${TEST_ID_SEPARATOR}${testCase.name}`
                    const testCaseItem = this.controller.createTestItem(testCaseId, testCase.name, spec)
                    testCaseItem.range = testCase.range
                    if (testCase.type === 'describe') {
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
                this.controller.items.add(fileTestItem)
            })
        )
    }

    private resisterSpecFile(id: string, spec: vscode.Uri) {
        const fileTestItem = this.controller.createTestItem(id, path.basename(spec.fsPath), spec)
        this._fileMap.set(id, fileTestItem)
        return fileTestItem
    }

    public convertPathToId(specPath: string) {
        return path.normalize(specPath)
    }

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

    public getSpecById(specPath: string) {
        const _specPath = specPath.startsWith('file://') ? fileURLToPath(specPath) : specPath

        const id = this.convertPathToId(_specPath)
        return this._fileMap.get(id)
    }
    public dispose() {
        this._suiteMap.clear()
        this._fileMap.clear()
    }
}
