import type { Launcher as LauncherType } from '@wdio/cli'
import type { WorkerMetaContext } from './types.js'
import type { LoadConfigOptions, WdioConfig } from '../api/index.js'

type LauncherPublicProperty = 'configParser' | 'isMultiremote' | 'isParallelMultiremote' | 'runner' | 'interface'

export class Launcher {
    #esmLauncher: Promise<LauncherType>

    constructor(configFilePath: string, args: any = {}, isWatchMode = false) {
        const cjsWdioCliModule = require.resolve('@wdio/cli', {
            paths: [process.cwd()],
        })
        const esmWdioCliModule = cjsWdioCliModule.replace(/\.cjs$/, '.js')
        this.#esmLauncher = import(esmWdioCliModule).then(
            ({ Launcher }) => new Launcher(configFilePath, args, isWatchMode)
        )
    }
    /**
     * run sequence
     * @return  {Promise}  that only gets resolved with either an exitCode or an error
     */
    async run(): Promise<undefined | number> {
        return (await this.#esmLauncher).run()
    }
    async initialize(): Promise<void> {
        return (await this.#esmLauncher).initialize()
    }
    async getProperty<T extends LauncherPublicProperty>(name: T): Promise<LauncherType[T]> {
        return (await this.#esmLauncher)[name]
    }
}

export async function loadWdioConfig(this: WorkerMetaContext, options: LoadConfigOptions): Promise<WdioConfig> {
    this.log.debug(`Loading the config file: ${options.configFilePath}`)
    // Create launcher instance
    const launcher = new Launcher(options.configFilePath)
    await launcher.initialize()

    const configParser = await launcher.getProperty('configParser')
    const specs = configParser.getSpecs().flatMap((specs) => (Array.isArray(specs) ? specs : [specs]))
    this.log.debug(`Successfully loaded the config file: ${options.configFilePath} (${specs.length} specs)`)
    return {
        specs,
    }
}
