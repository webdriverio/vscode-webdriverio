import type * as vscode from 'vscode'
import type { DEFAULT_CONFIG_VALUES } from '../constants.js'

export type ConfigPropertyNames = typeof DEFAULT_CONFIG_VALUES extends Record<infer K, any> ? K[] : never

export type WorkspaceData = {
    workspaceFolder: vscode.WorkspaceFolder
    wdioConfigFiles: string[]
}
