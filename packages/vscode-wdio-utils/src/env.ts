import fs from 'node:fs/promises'
import path from 'node:path'

import type { EnvOptions, IExtensionConfigManager } from '@vscode-wdio/types'
import type * as vscode from 'vscode'

export async function getEnvOptions(
    configManager: IExtensionConfigManager,
    workspaceFolder: vscode.WorkspaceFolder
): Promise<EnvOptions> {
    const envFiles = configManager.globalConfig.envFiles
    const absEnvPaths = await asyncFilter(
        envFiles.map((file) => {
            if (path.isAbsolute(file)) {
                return file
            }
            return path.resolve(workspaceFolder.uri.fsPath, file)
        }),
        async (file) => {
            try {
                await fs.access(file, fs.constants.R_OK)
                return true
            } catch {
                return false
            }
        }
    )
    return {
        paths: absEnvPaths,
        override: configManager.globalConfig.overrideEnv,
    }
}

async function asyncFilter<R>(array: R[], asyncCallback: (item: R) => Promise<boolean>) {
    const results = await Promise.all(array.map(asyncCallback))
    return array.filter((_, i) => results[i])
}
