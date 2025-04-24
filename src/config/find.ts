import fs from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'glob'

import { log } from '../utils/logger.js'

export async function findWdioConfig(workSpaceRoot: string, configFilePattern: string[]) {
    log.debug(`Target workspace path: ${workSpaceRoot}`)
    log.debug(`Detecting the configuration file for WebdriverIO...: ${configFilePattern.join(', ')}`)

    const wdioConfigPaths = await glob(configFilePattern, {
        cwd: workSpaceRoot,
        withFileTypes: false,
        ignore: '**/node_modules/**',
    })

    const configs = (
        await Promise.all(
            wdioConfigPaths.map(async (_wdioConfigPath) => {
                const wdioConfigPath = path.join(workSpaceRoot, _wdioConfigPath)
                log.debug(`Checking the path: ${wdioConfigPath}`)
                try {
                    await fs.access(wdioConfigPath, fs.constants.R_OK)
                    return wdioConfigPath
                } catch {
                    return undefined
                }
            })
        )
    ).filter((result) => typeof result !== 'undefined')
    log.debug(`Detected file: ${configs.join('\n')}`)
    return configs
}
