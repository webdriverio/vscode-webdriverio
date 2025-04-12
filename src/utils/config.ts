/* eslint-disable @typescript-eslint/no-explicit-any */
import * as vscode from 'vscode'

import { DEFAULT_CONFIG_VALUES, EXTENSION_ID } from '../constants.js'

import type { WebDriverIOConfig } from '../types.js'
import { log } from './logger.js'

export const testControllerId = 'wdio'

type ConfigProperty = {
    name: string
    getter: () => any
    setter: (value: any) => void
}

class WdioConfig implements WebDriverIOConfig {
    #configPath: string
    #testFilePattern: string
    #showOutput: boolean

    constructor() {
        const config = vscode.workspace.getConfiguration('webdriverio')

        this.#configPath = config.get<string>('configPath') || DEFAULT_CONFIG_VALUES.configPath
        this.#testFilePattern = config.get<string>('testFilePattern') || DEFAULT_CONFIG_VALUES.testFilePattern
        this.#showOutput = config.get<boolean>('showOutput') || DEFAULT_CONFIG_VALUES.showOutput
    }
    private createConfigProperties(config: vscode.WorkspaceConfiguration): ConfigProperty[] {
        return [
            {
                name: 'configPath',
                getter: () => config.get<string>('configPath'),
                setter: (value: string) => {
                    this.#configPath = value
                },
            },
            {
                name: 'testFilePattern',
                getter: () => config.get<string>('testFilePattern'),
                setter: (value: string) => {
                    this.#testFilePattern = value
                },
            },
            {
                name: 'showOutput',
                getter: () => config.get<boolean>('showOutput'),
                setter: (value: boolean) => {
                    this.#showOutput = value
                },
            },
        ]
    }

    listener(event: vscode.ConfigurationChangeEvent) {
        if (!event.affectsConfiguration(EXTENSION_ID)) {
            return
        }
        log.debug('The configuration for this extension were updated.')

        const config = vscode.workspace.getConfiguration(EXTENSION_ID)

        const configProperties = this.createConfigProperties(config)

        // Process each property with the same logic
        for (const prop of configProperties) {
            const configKey = `${EXTENSION_ID}.${prop.name}`
            if (event.affectsConfiguration(configKey)) {
                const newValue = prop.getter()
                if (newValue !== undefined) {
                    log.debug(`Update ${prop.name}: ${newValue}`)
                    prop.setter(newValue)
                }
            }
        }
    }

    get configPath() {
        return this.#configPath
    }
    get testFilePattern() {
        return this.#testFilePattern
    }
    get showOutput() {
        return this.#showOutput
    }
}

export const config = new WdioConfig()
