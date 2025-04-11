import * as vscode from 'vscode'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as glob from 'glob'

/**
 * Tree data provider for WebDriverIO test explorer
 */
export class TestExplorerProvider implements vscode.TreeDataProvider<TestItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TestItem | undefined | null | void> = new vscode.EventEmitter<
        TestItem | undefined | null | void
    >()

    readonly onDidChangeTreeData: vscode.Event<TestItem | undefined | null | void> = this._onDidChangeTreeData.event

    constructor() {}

    /**
     * Refresh the test explorer view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire()
    }

    /**
     * Get tree item
     */
    getTreeItem(element: TestItem): vscode.TreeItem {
        return element
    }

    /**
     * Get children of the provided element
     */
    async getChildren(element?: TestItem): Promise<TestItem[]> {
        if (!vscode.workspace.workspaceFolders) {
            return Promise.resolve([])
        }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath

        // If no element is provided, return top-level test specs
        if (!element) {
            return this.getTestFiles(workspaceRoot)
        }

        // If it's a spec file, return tests in that file
        if (element.type === 'spec') {
            return this.getTestsInFile(element.resourceUri.fsPath)
        }

        return []
    }

    /**
     * Get all test files in the workspace
     */
    private async getTestFiles(workspaceRoot: string): Promise<TestItem[]> {
        const config = vscode.workspace.getConfiguration('webdriverio-runner')
        const testPattern =
            config.get<string>('testFilePattern') || '**/*.spec.js,**/*.test.js,**/*.spec.ts,**/*.test.ts'

        // Split patterns and find files
        const patterns = testPattern.split(',')
        const files: string[] = []

        for (const pattern of patterns) {
            const matches = glob.sync(pattern, { cwd: workspaceRoot })
            matches.forEach((match) => {
                files.push(path.resolve(workspaceRoot, match))
            })
        }

        // Create tree items for each spec file
        return files.map((file) => {
            const relativePath = path.relative(workspaceRoot, file)
            return new TestItem(
                vscode.Uri.file(file),
                path.basename(file),
                relativePath,
                'spec',
                vscode.TreeItemCollapsibleState.Collapsed
            )
        })
    }

    /**
     * Get all tests in a spec file
     */
    private async getTestsInFile(filePath: string): Promise<TestItem[]> {
        try {
            // Read file content
            const content = fs.readFileSync(filePath, 'utf8')

            // Extract test names using regex
            // This is a simple regex for demonstration - you might need to improve it
            const testRegex = /it\s*\(\s*['"](.+?)['"]/g
            const tests: TestItem[] = []

            let match
            while ((match = testRegex.exec(content)) !== null) {
                const testName = match[1]
                const position = new vscode.Position(content.substring(0, match.index).split('\n').length - 1, 0)

                tests.push(
                    new TestItem(
                        vscode.Uri.file(filePath),
                        testName,
                        testName,
                        'test',
                        vscode.TreeItemCollapsibleState.None,
                        {
                            command: 'webdriverio-runner.runTest',
                            title: 'Run Test',
                            arguments: [{ testName, filePath, position }],
                        }
                    )
                )
            }

            return tests
        } catch (error) {
            console.error(`Error parsing tests in file ${filePath}:`, error)
            return []
        }
    }
}

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
