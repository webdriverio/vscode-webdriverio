import { normalizePath } from '@vscode-wdio/utils/node'

import { getLauncherInstance } from './cli.js'
import { EnvHook } from './hook.js'
import { parse } from './parsers/index.js'
import { runTest } from './test.js'
import type { CommonRequestOptions, LoadConfigOptions, WdioConfig, WorkerApi } from '@vscode-wdio/types/server'
import type { WorkerMetaContext } from '@vscode-wdio/types/worker'

async function handlerProxy(this: { context: WorkerMetaContext; fn: Function }, options: unknown) {
    const hooks = [new EnvHook(this.context, (options as CommonRequestOptions).env)]

    await Promise.all(hooks.map((hook) => hook.before()))

    const fnResult = await this.fn.call(this.context, options)

    await Promise.all(hooks.map((hook) => hook.after()))

    return fnResult
}

export function createWorker(context: WorkerMetaContext): WorkerApi {
    let _shutdownRequest: Promise<void> | null
    return {
        /**
         * Run WebdriverIO tests
         */
        runTest: handlerProxy.bind({ context, fn: runTest }),
        /**
         * Read configuration for the WebdriverIO
         */
        loadWdioConfig: handlerProxy.bind({ context, fn: loadWdioConfig }),
        /**
         * Read spec files for the WebdriverIO
         */
        readSpecs: handlerProxy.bind({ context, fn: parse }),
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
            if (context.pendingCalls.length > 0) {
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
            _shutdownRequest = new Promise((resolve) => {
                // close after this request is returned.
                setTimeout(() => {
                    context.ws.close()
                    resolve()
                    process.exit(0)
                }, 500)
            })
            context.log.info('Worker shutdown requested!')
        },
    }
}

export async function loadWdioConfig(this: WorkerMetaContext, options: LoadConfigOptions): Promise<WdioConfig> {
    this.log.debug(`Loading the config file: ${options.configFilePath}`)

    try {
        // Create launcher instance
        const launcher = await getLauncherInstance(options.configFilePath)
        await launcher.initialize()

        const configParser = await launcher.getProperty('configParser')
        const specPatterns = configParser.getConfig().specs.flatMap((p) => p)
        const specs = configParser.getSpecs().flatMap((specs) => {
            return Array.isArray(specs) ? specs.map((spec) => normalizePath(spec)) : [normalizePath(specs)]
        })
        const framework = configParser.getConfig().framework
        this.log.debug(`Successfully loaded the config file: ${options.configFilePath} (${specs.length} specs)`)

        return {
            framework,
            specs,
            specPatterns,
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        this.log.debug(`Failed to load the config file: ${options.configFilePath}`)
        throw new Error(msg)
    }
}
