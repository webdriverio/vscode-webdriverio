import type EventEmitter from 'node:events'
import type { DEFAULT_CONFIG_VALUES } from '@vscode-wdio/constants'
import type * as vscode from 'vscode'
import type { WebdriverIOConfig } from './utils.js'

export type ConfigPropertyNames = typeof DEFAULT_CONFIG_VALUES extends Record<infer K, any> ? K[] : never

export type WorkspaceData = {
    workspaceFolder: vscode.WorkspaceFolder
    wdioConfigFiles: string[]
}

export interface ExtensionConfigManagerInterface extends EventEmitter, vscode.Disposable {
    isMultiWorkspace: boolean
    globalConfig: WebdriverIOConfig
    workspaces: WorkspaceData[]
    listener(event: vscode.ConfigurationChangeEvent): void
    initialize(): Promise<never[] | undefined>
    addWdioConfig(configPath: string): Promise<vscode.Uri[]>
    removeWdioConfig(configPath: string): vscode.Uri[]
    getWorkspaces(): readonly vscode.WorkspaceFolder[]
    getWdioConfigPaths(): string[]
}
