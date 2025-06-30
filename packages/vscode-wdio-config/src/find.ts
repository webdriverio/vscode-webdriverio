import fs from 'node:fs/promises'

import { log } from '@vscode-wdio/logger'
import { normalizePath } from '@vscode-wdio/utils'
import * as vscode from 'vscode'

export async function findWdioConfig(workSpaceRoot: string, configFilePattern: string[]) {
    log.debug(`Target workspace path: ${workSpaceRoot}`)
    log.debug(`Detecting the configuration file for WebdriverIO...: ${configFilePattern.join(', ')}`)
    const globResult = await Promise.all(
        configFilePattern.map((p) =>
            vscode.workspace.findFiles(new vscode.RelativePattern(workSpaceRoot, p), '**/node_modules/**')
        )
    )

    const wdioConfigPaths = globResult.flatMap((uri) => uri).map((uri) => uri.fsPath)

    const configs = (
        await Promise.all(
            wdioConfigPaths.map(async (wdioConfigPath) => {
                log.debug(`Checking the path: ${wdioConfigPath}`)
                try {
                    await fs.access(wdioConfigPath, fs.constants.R_OK)
                } catch {
                    return undefined
                }
                return normalizePath(wdioConfigPath)
            })
        )
    ).filter((result) => typeof result !== 'undefined')
    log.debug(`Detected file: ${configs.join('\n')}`)
    return configs
}
