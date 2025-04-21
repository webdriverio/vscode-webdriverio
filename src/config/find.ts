import path from 'node:path'
import fs from 'node:fs/promises'

import { log } from '../utils/logger.js'

export async function findWdioConfig(workSpaceRoot: string) {
    log.debug(`Target workspace path: ${workSpaceRoot}`)
    log.debug('Detecting the configuration file for WebdriverIO...')

    const wdioConfigPaths = [path.join(workSpaceRoot, 'wdio.conf.js'), path.join(workSpaceRoot, 'wdio.conf.ts')]
    const configs = (
        await Promise.all(
            wdioConfigPaths.map(async (wdioConfigPath) => {
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
