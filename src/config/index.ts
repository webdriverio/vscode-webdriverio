import * as vscode from 'vscode'

import { DEFAULT_CONFIG_VALUES, EXTENSION_ID } from '../constants.js'

import type { WebDriverIOConfig } from '../types.js'
import { log } from '../utils/logger.js'
import { ConfigParser } from '@wdio/config/node'
import { findWdioConfig } from './find.js'
import EventEmitter from 'node:events'

export const testControllerId = EXTENSION_ID

type ConfigPropertyNames = typeof DEFAULT_CONFIG_VALUES extends Record<infer K, any> ? K[] : never

class WdioConfig extends EventEmitter {
    private _globalConfig: WebDriverIOConfig
    private _configParser = new Map<string, ConfigParser>()

    constructor() {
        super()
        const config = vscode.workspace.getConfiguration(EXTENSION_ID)

        this._globalConfig = {
            configPath: config.get<string>('configPath') || DEFAULT_CONFIG_VALUES.configPath,
            testFilePattern: config.get<string>('testFilePattern') || DEFAULT_CONFIG_VALUES.testFilePattern,
            showOutput: this.resolveBooleanConfig(config, 'showOutput', DEFAULT_CONFIG_VALUES.showOutput),
        }
    }

    private resolveBooleanConfig(config: vscode.WorkspaceConfiguration, key: string, defaultValue: boolean) {
        const value = config.get<boolean>('showOutput')
        return typeof value === 'boolean' ? value : defaultValue
    }

    public get globalConfig() {
        return this._globalConfig
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
            const newValue = config.get<WebDriverIOConfig[typeof prop]>(prop)
            if (event.affectsConfiguration(configKey) && newValue !== undefined) {
                log.debug(`Update ${prop}: ${newValue}`)
                this.emit(prop, newValue)
                Object.assign(this._globalConfig, { [prop]: newValue })
            }
        }
    } /**
     * Gets the WebDriverIO configuration from the current workspace
     * @param workspaceFolder Optional workspace folder path. If not provided, it will be detected automatically.
     * @param reload Whether to reload the configuration from disk even if it's cached
     * @returns The WebDriverIO configuration
     * @throws Error if no workspace is detected, multiple workspaces are detected, or no config file is found
     */
    public async getWdioConfig(workspaceFolder?: string, reload = false) {
        let targetWorkspace: string

        if (workspaceFolder) {
            // Use provided workspace folder if specified
            targetWorkspace = workspaceFolder
        } else {
            // Get workspace folders automatically
            const workspaceFolders = this.getWorkspaceFolderPath()

            // Check if we have exactly one workspace folder
            if (workspaceFolders.length === 0) {
                throw new Error('No workspace is detected.')
            }

            if (workspaceFolders.length > 1) {
                throw new Error('Multiple workspaces are not supported.')
            }

            targetWorkspace = workspaceFolders[0]
        }

        // Check if we have a cached configuration
        const cachedConfig = this._configParser.get(targetWorkspace)
        if (cachedConfig && !reload) {
            return cachedConfig
        }

        // Find the configuration file
        const configFile = await findWdioConfig(targetWorkspace)
        if (!configFile) {
            throw new Error('WebDriverIO configuration file not found.')
        }

        // Initialize the configuration
        const config = new ConfigParser(configFile)
        await config.initialize()

        // Cache the configuration
        this._configParser.set(targetWorkspace, config)
        return config
    }

    public getWorkspaceFolderPath(workspaceFolders = vscode.workspace.workspaceFolders) {
        if (!workspaceFolders || workspaceFolders.length === 0) {
            log.debug('No workspace is detected.')
            return []
        }
        if (workspaceFolders.length === 1) {
            const workspaceFolder = workspaceFolders[0]
            log.debug(`Detected workspace path: ${workspaceFolder.uri.fsPath}`)
            return [workspaceFolder.uri.fsPath]
        }
        //TODO: support multiple workspace
        log.debug(`Detected ${workspaceFolders.length} workspaces.`)
        log.warn('Not support the multiple workspaces')
        return []
    }
}

export const configManager = new WdioConfig()

// TODO: Add Install command
// To add install command, the following code seems to be used.
// https://github.com/webdriverio/vscode-webdriverio/issues/8
// /**
//  * Generate a default WebDriverIO config file
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
//     const configTemplate = `// WebDriverIO configuration file
// // Generated by WebDriverIO Runner extension
// exports.config = {
//     runner: 'local',
//     specs: [
//         './test/**/*.spec.js'
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
