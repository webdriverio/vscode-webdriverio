import path from 'node:path'
import { pathToFileURL } from 'node:url'

import type { WorkerMetaContext } from '@vscode-wdio/types'
import type { createTempConfigFile } from './config.js'

export type TempConfigFileCreator = typeof createTempConfigFile

const VSCODE_WINDOWS_CONFIG_CREATOR_PATH = path.resolve(__dirname, 'parser/ast.cjs')

let tempConfigCreator: TempConfigFileCreator | undefined

export async function getTempConfigCreator(context: WorkerMetaContext): Promise<TempConfigFileCreator> {
    return (await dynamicLoader(
        context,
        tempConfigCreator,
        VSCODE_WINDOWS_CONFIG_CREATOR_PATH,
        'createTempConfigFile'
    )) as TempConfigFileCreator
}

export function isWindows() {
    return process.platform === 'win32'
}

export async function dynamicLoader(
    context: WorkerMetaContext,
    libModule: unknown,
    modulePath: string,
    fnName: string
): Promise<unknown> {
    if (libModule) {
        context.log.debug(`Use cached ${path.dirname(modulePath)}`)
        return libModule
    }
    context.log.debug(`Import ${path.basename(modulePath)}`)
    libModule = (await import(pathToFileURL(modulePath).href))[fnName]
    return libModule
}
