import path from 'node:path'
import type { createTempConfigFile } from './config.js'

export type TempConfigFileCreator = typeof createTempConfigFile

const VSCODE_WINDOWS_CONFIG_CREATOR_PATH = path.resolve(__dirname, 'windows.cjs')

export async function getTempConfigCreator(creator: TempConfigFileCreator | undefined): Promise<TempConfigFileCreator> {
    return !creator
        ? ((await import(VSCODE_WINDOWS_CONFIG_CREATOR_PATH)).createTempConfigFile as TempConfigFileCreator)
        : creator!
}

export function isWindows() {
    return process.platform === 'win32'
}
