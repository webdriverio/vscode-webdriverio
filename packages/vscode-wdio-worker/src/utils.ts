import path from 'node:path'

import type { WorkerMetaContext } from '@vscode-wdio/types'
import type { createTempConfigFile } from './config.js'

export type TempConfigFileCreator = typeof createTempConfigFile

const VSCODE_WINDOWS_CONFIG_CREATOR_PATH = path.resolve(__dirname, 'parser/ast.cjs')

let tempConfigCreator: TempConfigFileCreator | undefined

export async function getTempConfigCreator(context: WorkerMetaContext): Promise<TempConfigFileCreator> {
    if (tempConfigCreator) {
        context.log.debug('Use cached TempConfigFileCreator')
        return tempConfigCreator
    }
    context.log.debug('Import TempConfigFileCreator')
    tempConfigCreator = (await import(VSCODE_WINDOWS_CONFIG_CREATOR_PATH)).createTempConfigFile as TempConfigFileCreator
    return tempConfigCreator
}

export function isWindows() {
    return process.platform === 'win32'
}
