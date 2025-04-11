import path from 'node:path'
import * as fs from 'node:fs'
import * as vscode from 'vscode'
import * as glob from 'glob'
import { parseTestCases, type TestCaseInfo } from './parser.js'

export const discoverTests = async (testController: vscode.TestController) => {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        return
    }

    for (const workspaceFolder of workspaceFolders) {
        const wdioConfigPath = path.join(workspaceFolder.uri.fsPath, 'wdio.conf.js')
        if (fs.existsSync(wdioConfigPath)) {
            await findWebdriverIOTests(workspaceFolder.uri, testController)
        }
    }
}

async function findWebdriverIOTests(workspaceUri: vscode.Uri, controller: vscode.TestController) {
    const config = vscode.workspace.getConfiguration('webdriverio-runner')
    const testPattern = config.get<string>('testFilePattern') || '**/*.spec.js,**/*.test.js,**/*.spec.ts,**/*.test.ts'

    // Split patterns and find files
    const patterns = testPattern.split(',')
    const testFiles: vscode.Uri[] = []

    for (const pattern of patterns) {
        const matches = glob.sync(pattern, { cwd: workspaceUri.fsPath })
        matches.forEach((match) => {
            testFiles.push(vscode.Uri.file(path.resolve(workspaceUri.fsPath, match)))
        })
    }

    for (const testFile of testFiles) {
        // Create TestItem testFile by testFile
        const fileTestItem = controller.createTestItem(testFile.fsPath, path.basename(testFile.fsPath), testFile)

        // analyze the test file contests
        const fileContent = fs.readFileSync(testFile.fsPath, 'utf-8')
        const document = await vscode.workspace.openTextDocument(testFile)
        const testCases = parseTestCases(fileContent, document)

        const testTreeCreator = (parentId: string, testCase: TestCaseInfo) => {
            const testCaseId = `${parentId}#${testCase.name}`
            const testCaseItem = controller.createTestItem(testCaseId, testCase.name, testFile)
            testCaseItem.range = testCase.range
            for (const childTestCase of testCase.children) {
                testCaseItem.children.add(testTreeCreator(testCaseId, childTestCase))
            }
            return testCaseItem
        }

        // Create TestItem testCase by testCase
        for (const testCase of testCases) {
            fileTestItem.children.add(testTreeCreator(testFile.fsPath, testCase))
        }

        controller.items.add(fileTestItem)
    }
}
