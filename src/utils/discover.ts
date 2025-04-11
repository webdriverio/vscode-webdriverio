import path from 'node:path'
import * as fs from 'node:fs'
import * as vscode from 'vscode'
import * as glob from 'glob'
import { parseTestCases, type TestCaseInfo } from './parser.js'

/**
 * Tree item representing a test or spec file
 */
export class TestItem extends vscode.TreeItem {
    constructor(
        public readonly resourceUri: vscode.Uri,
        public readonly label: string,
        public readonly description: string,
        public readonly type: 'test' | 'spec',
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState)

        this.tooltip = `${this.label} (${this.description})`

        // Set icon based on item type
        this.iconPath = {
            // * const good = URI.file('/coding/c#/project1');
            light: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'media', `${type}-light.svg`)),
            dark: vscode.Uri.file(path.join(__filename, '..', '..', '..', 'media', `${type}-dark.svg`)),
        }

        // Make spec files runnable
        if (type === 'spec') {
            this.command = {
                command: 'webdriverio-runner.runSpec',
                title: 'Run Spec',
                arguments: [this],
            }
        }

        this.contextValue = type
    }
}

export const discoverTests = async (testController: vscode.TestController) => {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        return
    }

    for (const workspaceFolder of workspaceFolders) {
        const wdioConfigPath = path.join(workspaceFolder.uri.fsPath, 'wdio.conf.js')
        if (fs.existsSync(wdioConfigPath)) {
            // WebDriverIOプロジェクトと判断し、テスト探索を実行
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
        // テストファイルごとにTestItemを作成
        const fileTestItem = controller.createTestItem(testFile.fsPath, path.basename(testFile.fsPath), testFile)

        // ファイル内のテストケースを解析
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

        // テストケースごとにTestItemを作成
        for (const testCase of testCases) {
            // const testCaseItem = controller.createTestItem(
            //     `${testFile.fsPath}#${testCase.name}`,
            //     testCase.name,
            //     testFile
            // )
            // testCaseItem.range = testCase.range // テストケースの位置情報
            fileTestItem.children.add(testTreeCreator(testFile.fsPath, testCase))
        }

        controller.items.add(fileTestItem)
    }
}
