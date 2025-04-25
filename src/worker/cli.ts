import type { Launcher as LauncherType } from '@wdio/cli'

type LauncherPublicProperty = 'configParser' | 'isMultiremote' | 'isParallelMultiremote' | 'runner' | 'interface'

/* c8 ignore start */

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
/* c8 ignore stop */
