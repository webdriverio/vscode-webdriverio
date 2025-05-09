import { getLauncherInstance,  } from './cli.js'
import { parse } from './parsers/index.js'
import { runTest } from './test.js'
import { normalizePath } from '../utils/normalize.js'

import type { WorkerMetaContext } from './types.js'
import type { LoadConfigOptions, WdioConfig, WorkerApi } from '../api/index.js'

export function createWorker(context: WorkerMetaContext): WorkerApi {
    return {
        /**
         * Run WebdriverIO tests
         */
        runTest: runTest.bind(context),
        /**
         * Read configuration for the WebdriverIO
         */
        loadWdioConfig: loadWdioConfig.bind(context),
        /**
         * Read spec files for the WebdriverIO
         */
        readSpecs: parse.bind(context),
        /**
         * Ping worker to check if it's alive
         */
        ping: async (): Promise<string> => 'pong',
        /**
         * Shutdown worker process
         */
        shutdown: async function (): Promise<void> {
            context.log.info('Shutting down worker process')
            context.shutdownRequested = true
            context.log.info('Worker received shutdown request')

            // Implement safe shutdown procedure
            try {
                // Give pending tasks a chance to complete
                if (context.pendingCalls.length > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 500))
                }

                // Close WebSocket connection
                context.ws.close()

                // Set safety timeout in case WebSocket doesn't close
                setTimeout(() => {
                    process.exit(0)
                }, 2000)
            } catch (error) {
                console.error('Error during shutdown:', error)
                process.exit(1)
            }
        },
    }
}

export async function loadWdioConfig(this: WorkerMetaContext, options: LoadConfigOptions): Promise<WdioConfig> {
    this.log.debug(`Loading the config file: ${options.configFilePath}`)

    // Create launcher instance
    const launcher = await getLauncherInstance(options.configFilePath)
    await launcher.initialize()

    const configParser = await launcher.getProperty('configParser')
    const specPatterns = configParser.getConfig().specs.flatMap((p)=>p)
    const specs = configParser.getSpecs().flatMap((specs) => {
        return Array.isArray(specs)
            ? specs.map((spec)=>normalizePath(spec))
            : [normalizePath(specs)]
    })
    const framework = configParser.getConfig().framework
    this.log.debug(`Successfully loaded the config file: ${options.configFilePath} (${specs.length} specs)`)

    return {
        framework,
        specs,
        specPatterns,
    }
}
