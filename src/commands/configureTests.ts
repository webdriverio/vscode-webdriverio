import * as fs from 'node:fs'
import * as path from 'node:path'

import * as vscode from 'vscode'

/**
 * Configure WebdriverIO test settings
 */
export async function configureTests(): Promise<void> {
    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open')
        return
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath

    // Get current config
    const config = vscode.workspace.getConfiguration('webdriverio')
    const currentConfigPath = config.get<string>('configPath') || 'wdio.conf.js'

    // Ask for config file
    const configPath = await vscode.window.showInputBox({
        prompt: 'Path to WebdriverIO config file (relative to workspace root)',
        value: currentConfigPath,
        validateInput: (value) => {
            if (!value) {
                return 'Config path cannot be empty'
            }

            const fullPath = path.resolve(workspaceRoot, value)
            if (!fs.existsSync(fullPath)) {
                return `Config file not found: ${value}`
            }

            return null
        },
    })

    if (configPath === undefined) {
        // User cancelled
        return
    }

    // Ask for test file pattern
    const currentPattern =
        config.get<string>('testFilePattern') || '**/*.spec.js,**/*.test.js,**/*.spec.ts,**/*.test.ts'

    const testPattern = await vscode.window.showInputBox({
        prompt: 'Glob pattern for test files (comma separated)',
        value: currentPattern,
    })

    if (testPattern === undefined) {
        // User cancelled
        return
    }

    // Ask for output preference
    // const currentShowOutput = config.get<boolean>('showOutput') || true

    const showOutput = await vscode.window
        .showQuickPick(['Yes', 'No'], {
            placeHolder: 'Show WebdriverIO output in terminal?',
        })
        .then((result) => result === 'Yes')

    // Update settings
    await config.update('configPath', configPath, vscode.ConfigurationTarget.Workspace)
    await config.update('testFilePattern', testPattern, vscode.ConfigurationTarget.Workspace)
    await config.update('showOutput', showOutput, vscode.ConfigurationTarget.Workspace)

    vscode.window.showInformationMessage('WebdriverIO Runner settings updated')
}
