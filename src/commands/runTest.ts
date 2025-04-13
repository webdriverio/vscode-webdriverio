import * as vscode from 'vscode'
import * as path from 'node:path'
import logger from '../utils/logger.js'
import { runWdio } from '../utils/wdioRunner.js'

/**
 * Run WebDriverIO tests
 * @param mode 'test' for current test, 'spec' for current file, 'all' for all tests
 */
export async function runTest(mode: 'test' | 'spec' | 'all'): Promise<void> {
    // Get active text editor
    const editor = vscode.window.activeTextEditor

    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open')
        return
    }
    const workspaceRoot = workspaceFolders[0].uri.fsPath

    // Get config path from settings
    const config = vscode.workspace.getConfiguration('webdriverio')
    const configPath = config.get<string>('configPath') || 'wdio.conf.js'
    const fullConfigPath = path.resolve(workspaceRoot, configPath)

    // Show output channel
    // const outputChannel = vscode.window.createOutputChannel('WebDriverIO Runner');
    // outputChannel.show(true);
    logger.appendLine('Starting WebDriverIO test run...')

    try {
        const specs: string[] = []
        let grepPattern: string | undefined

        // Determine what to run based on mode
        if (mode === 'test' && editor) {
            // Get current test name from cursor position
            const document = editor.document
            const position = editor.selection.active
            const wordRange = document.getWordRangeAtPosition(position)

            if (wordRange) {
                const line = document.lineAt(position.line).text
                // Simple regex to find test name - this could be improved
                const testMatch = line.match(/it\s*\(\s*['"](.+?)['"]/)
                if (testMatch && testMatch[1]) {
                    specs.push(document.uri.fsPath)
                    grepPattern = testMatch[1]
                    logger.appendLine(`Running test: ${testMatch[1]}`)
                } else {
                    // Fallback to spec mode if no test found
                    specs.push(document.uri.fsPath)
                    logger.appendLine(`Running spec file: ${document.uri.fsPath}`)
                }
            }
        } else if (mode === 'spec' && editor) {
            specs.push(editor.document.uri.fsPath)
            logger.appendLine(`Running spec file: ${editor.document.uri.fsPath}`)
        } else if (mode === 'all') {
            // Run all tests - let WebDriverIO find specs based on config
            logger.appendLine('Running all tests')
        }

        // Run WebDriverIO
        const result = await runWdio({
            rootDir: workspaceRoot,
            configPath: fullConfigPath,
            specs,
            grep: grepPattern,
        })

        // Display output
        logger.appendLine(result.output)

        if (result.success) {
            vscode.window.showInformationMessage('WebDriverIO tests completed successfully')
        } else {
            vscode.window.showErrorMessage('WebDriverIO tests failed')
        }
    } catch (error) {
        logger.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`)
        vscode.window.showErrorMessage(
            `Failed to run WebDriverIO tests: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}
