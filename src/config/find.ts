import path from 'node:path'
import fs from 'node:fs/promises'

import { log } from '../utils/logger.js'

export async function findWdioConfig(workSpaceRoot: string) {
    log.debug(`Target workspace path: ${workSpaceRoot}`)
    log.debug('Detecting the configuration file for WebdriverIO...')

    const wdioConfigPaths = [path.join(workSpaceRoot, 'wdio.conf.js')]
    const configs = (
        await Promise.all(
            wdioConfigPaths.map(async (wdioConfigPath) => {
                log.debug(`Checking the path: ${wdioConfigPath}`)
                try {
                    await fs.access(wdioConfigPath, fs.constants.R_OK)
                    return { isOk: true, path: wdioConfigPath }
                } catch {
                    return { isOk: false, path: wdioConfigPath }
                }
            })
        )
    ).filter((result) => result.isOk)

    if (configs.length === 0) {
        log.debug('There is no configuration file.')
    }

    if (configs.length > 1) {
        log.debug(`Detected files: \n${configs.join('\n')}`)
        log.debug(`${configs.length} configuration files were detected. Use first one. `)
    }
    log.debug(`Detected file: ${configs[0].path}`)
    return configs[0].path
}
