import { EventEmitter } from 'node:events'

import * as vscode from 'vscode'

import { findWdioConfig } from './find.js'
import { DEFAULT_CONFIG_VALUES, EXTENSION_ID } from '../constants.js'
import { log } from '../utils/logger.js'
import { normalizePath } from '../utils/normalize.js'
import type { WebdriverIOConfig } from '../types.js'
import type { ConfigPropertyNames, WorkspaceData } from './types.js'

export class ExtensionConfigManager extends EventEmitter implements vscode.Disposable {
    private _isInitialized = false
    private _isMultiWorkspace = false
    private _globalConfig: WebdriverIOConfig
    // private _workspaceConfigMap = new Map<string, vscode.WorkspaceFolder>()
    private _workspaceConfigMap2 = new WeakMap<vscode.WorkspaceFolder, Set<string>>()
    private _wdioConfigPathSet = new Set<string>()
    private _workspaces: WorkspaceData[] | undefined

    constructor() {
        super()
        const config = vscode.workspace.getConfiguration(EXTENSION_ID)

        const configFilePattern = config.get<string[]>('configFilePattern')

        this._globalConfig = {
            configFilePattern:
                configFilePattern && configFilePattern.length > 0
                    ? configFilePattern
                    : [...DEFAULT_CONFIG_VALUES.configFilePattern],
            showOutput: this.resolveBooleanConfig(config, 'showOutput', DEFAULT_CONFIG_VALUES.showOutput),
            logLevel: config.get<string>('logLevel', DEFAULT_CONFIG_VALUES.logLevel),
        }
    }

    public get isMultiWorkspace() {
        return this._isMultiWorkspace
    }

    public get globalConfig() {
        return this._globalConfig
    }

    public get workspaces() {
        if (!this._workspaces) {
            throw new Error('WdioConfig class is not initialized.')
        }
        return this._workspaces
    }

    public listener(event: vscode.ConfigurationChangeEvent) {
        if (!event.affectsConfiguration(EXTENSION_ID)) {
            return
        }
        log.debug('The configuration for this extension were updated.')

        const config = vscode.workspace.getConfiguration(EXTENSION_ID)

        const _configProperties = Object.keys(DEFAULT_CONFIG_VALUES) as ConfigPropertyNames

        for (const prop of _configProperties) {
            const configKey = `${EXTENSION_ID}.${prop}`
            const newValue = config.get<WebdriverIOConfig[typeof prop]>(prop)
            if (event.affectsConfiguration(configKey) && newValue !== undefined) {
                log.debug(`Update ${prop}: ${newValue}`)
                this.emit(`update:${prop}`, newValue)

                Object.assign(this._globalConfig, { [prop]: newValue })
            }
        }
    }

    public async initialize() {
        const workspaceFolders = this.getWorkspaces()
        if (workspaceFolders.length === 0) {
            log.debug('No workspace is detected.')
            return []
        }
        this._isMultiWorkspace = workspaceFolders.length > 1

        this._workspaces = await Promise.all(
            workspaceFolders.map(async (workspaceFolder) => {
                const wdioConfigFiles = await findWdioConfig(
                    workspaceFolder.uri.fsPath,
                    this._globalConfig.configFilePattern
                )
                if (!wdioConfigFiles) {
                    return {
                        workspaceFolder,
                        wdioConfigFiles: [],
                    }
                }
                for (const wdioConfigFile of wdioConfigFiles) {
                    // this._workspaceConfigMap.set(wdioConfigFile, workspaceFolder)
                    const workspaceInfo = this._workspaceConfigMap2.get(workspaceFolder)
                    if (workspaceInfo) {
                        workspaceInfo.add(wdioConfigFile)
                    } else {
                        this._workspaceConfigMap2.set(workspaceFolder, new Set([wdioConfigFile]))
                    }
                    this._wdioConfigPathSet.add(wdioConfigFile)
                }
                return {
                    workspaceFolder,
                    wdioConfigFiles,
                }
            })
        )
        this._isInitialized = true
    }

    public async addWdioConfig(configPath: string) {
        await this.initialize()
        const normalizedConfigPath = normalizePath(configPath)
        const workspaceFolders = this.getWorkspaces()

        const result: vscode.Uri[] = []
        for (const workspaceFolder of workspaceFolders) {
            const workspaceInfo = this._workspaceConfigMap2.get(workspaceFolder)
            if (workspaceInfo && workspaceInfo.has(normalizedConfigPath)) {
                log.debug(`detected workspace "${workspaceFolder.uri.fsPath}"`)
                result.push(workspaceFolder.uri)
            }
        }
        return result
    }

    private getWorkspaces() {
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            log.debug('No workspace is detected.')
            return []
        }
        return workspaceFolders
    }

    public removeWdioConfig(configPath: string) {
        const normalizedConfigPath = normalizePath(configPath)
        const result: vscode.Uri[] = []
        const workspaceFolders = this.getWorkspaces()
        for (const workspaceFolder of workspaceFolders) {
            const workspaceInfo = this._workspaceConfigMap2.get(workspaceFolder)
            if (workspaceInfo && workspaceInfo.delete(normalizedConfigPath)) {
                log.debug(`Remove the config file "${normalizedConfigPath}" from "${workspaceFolder.uri.fsPath}"`)
                result.push(workspaceFolder.uri)
            }
        }
        this._wdioConfigPathSet.delete(normalizedConfigPath)
        return result
    }

    public getWdioConfigPaths() {
        if (!this._isInitialized) {
            throw new Error('Configuration manager is not initialized')
        }
        return Array.from(this._wdioConfigPathSet)
    }

    private resolveBooleanConfig(config: vscode.WorkspaceConfiguration, key: string, defaultValue: boolean) {
        const value = config.get<boolean>(key)
        return typeof value === 'boolean' ? value : defaultValue
    }

    public dispose() {
        this._wdioConfigPathSet.clear()
        this._workspaces = undefined
    }
}

export { ConfigFileWatcher } from './watcher.js'

// TODO: Add Install command
// To add install command, the following code seems to be used.
// https://github.com/webdriverio/vscode-webdriverio/issues/8
// /**
//  * Generate a default WebdriverIO config file
//  */
// export function generateDefaultConfig(workspaceRoot: string): string {
//     const configPath = path.join(workspaceRoot, 'wdio.conf.js')

//     // Check if file already exists
//     if (fs.existsSync(configPath)) {
//         return configPath
//     }

//     // Generate default config using wdio config command
//     // This would be implemented through child_process
//     // For simplicity, we just provide a basic template here
//     const configTemplate = `// WebdriverIO configuration file
// // Generated by WebdriverIO Runner extension
// exports.config = {
//     runner: 'local',
//     specs: [
//         './test/index.js'
//     ],
//     exclude: [],
//     maxInstances: 10,
//     capabilities: [{
//         maxInstances: 5,
//         browserName: 'chrome',
//         acceptInsecureCerts: true
//     }],
//     logLevel: 'info',
//     bail: 0,
//     baseUrl: 'http://localhost',
//     waitforTimeout: 10000,
//     connectionRetryTimeout: 120000,
//     connectionRetryCount: 3,
//     framework: 'mocha',
//     reporters: ['spec'],
//     mochaOpts: {
//         ui: 'bdd',
//         timeout: 60000
//     }
// }`

//     // Write config file
//     fs.writeFileSync(configPath, configTemplate, 'utf8')

//     return configPath
// }
