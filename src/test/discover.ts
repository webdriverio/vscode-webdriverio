import { fileURLToPath } from 'node:url'
import * as vscode from 'vscode'

import { log } from '../utils/logger.js'
import { configManager } from '../config/index.js'

import type { TestRegistry } from './registry.js'

type Spec = string | string[]

export const discoverTests = async (testRegistry: TestRegistry) => {
    const workspaceFolders = configManager.getWorkspaceFolderPath()
    try {
        if (workspaceFolders.length === 1) {
            const workspaceFolder = workspaceFolders[0]

            const config = await configManager.getWdioConfig(workspaceFolder)
            if (!config) {
                throw new Error('Failed to load the configuration.')
            }

            log.debug('Loaded configuration successfully.')
            const specs = convertUri(config.getSpecs())

            log.debug(`Detected spec files: ${specs.length}`)
            await testRegistry.resisterSpecs(specs)
        } else {
            //TODO: support multiple workspace
            log.debug(`Detected ${workspaceFolders.length} workspaces.`)
            log.warn('Not support the multiple workspaces')
        }
    } catch (error) {
        log.error(`Failed to load specs: ${(error as Error).message}`)
    }
}

function convertUri(specs: Spec[]) {
    return specs.flatMap((spec) =>
        Array.isArray(spec)
            ? spec.map((path) => vscode.Uri.file(fileURLToPath(path)))
            : [vscode.Uri.file(fileURLToPath(spec))]
    )
}
