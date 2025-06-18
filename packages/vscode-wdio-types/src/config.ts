import type { DEFAULT_CONFIG_VALUES } from '@vscode-wdio/constants'
import type * as vscode from 'vscode'
import type { ITypedEventEmitter } from './utils.js'

export type ConfigPropertyNames = typeof DEFAULT_CONFIG_VALUES extends Record<infer K, any> ? K[] : never

type WidenLiteral<T> = T extends readonly (infer U)[]
    ? WidenLiteral<U>[]
    : T extends number
        ? number
        : T extends string
            ? string
            : T extends boolean
                ? boolean
                : T extends object
                    ? { [K in keyof T]: WidenLiteral<T[K]> }
                    : T
type DefaultConfigs = WidenLiteral<typeof DEFAULT_CONFIG_VALUES>

export type WebdriverIOConfig = Omit<DefaultConfigs, 'nodeExecutable' | 'envFiles'> & {
    nodeExecutable: string | undefined
    envFiles: string[]
}

export type WorkspaceData = {
    workspaceFolder: vscode.WorkspaceFolder
    wdioConfigFiles: string[]
}

type ToEventConfig<T> = {
    [K in keyof T as `update:${string & K}`]: T[K]
}

export type WebdriverIOConfigEvent = ToEventConfig<WebdriverIOConfig>

export interface IExtensionConfigManager extends ITypedEventEmitter<WebdriverIOConfigEvent>, vscode.Disposable {
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
