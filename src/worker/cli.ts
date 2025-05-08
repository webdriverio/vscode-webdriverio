import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Launcher as LauncherType, RunCommandArguments } from '@wdio/cli'

type LauncherPublicProperty = 'configParser' | 'isMultiremote' | 'isParallelMultiremote' | 'runner' | 'interface'

/* c8 ignore start */
let isTsxRegistered = false

const TS_FILE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

class Launcher {
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

async function ensureRegisteredTsx(configFilePath: string) {
    if (isTsxRegistered){
        return
    }

    /**
    * load tsx in the main process if config file is a .ts file to allow config parser to load it
    */
    if (TS_FILE_EXTENSIONS.some((ext) => configFilePath.endsWith(ext))) {
        const tsxPath = require.resolve('tsx', {
            paths: [process.cwd()],
        })
        /**
         * add tsx to process NODE_OPTIONS so it will be passed along the worker process
         */
        if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes(tsxPath)) {
            /**
             * The `--import` flag is only available in Node 20.6.0 / 18.19.0 and later.
             * This switching can be removed once the minimum supported version of Node exceeds 20.6.0 / 18.19.0
             * see https://nodejs.org/api/module.html#customization-hooks and https://tsx.is/dev-api/node-cli#module-mode-only
             */
            const moduleLoaderFlag = nodeVersion('major') >= 21 ||
                (nodeVersion('major') === 20 && nodeVersion('minor') >= 6) ||
                (nodeVersion('major') === 18 && nodeVersion('minor') >= 19) ? '--import' : '--loader'
            process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} ${moduleLoaderFlag} ${tsxPath}`
        }
        await import(tsxPath)

        isTsxRegistered = true
    }
}

enum NodeVersion {
    'major' = 0,
    'minor' = 1,
    'patch' = 2
}

function nodeVersion(type: keyof typeof NodeVersion): number {
    return process.versions.node.split('.').map(Number)[NodeVersion[type]]
}

export async function  getLauncherInstance(configFilePath: string, args?:RunCommandArguments){

    await ensureRegisteredTsx(configFilePath)

    const configFileUrl = pathToFileURL(configFilePath).href
    const clonedArgs = (args ? structuredClone(args): {} ) as { rootDir?:string }

    if (!clonedArgs.rootDir){
        clonedArgs.rootDir = dirname(configFilePath)
    }
    // Create launcher instance
    return new Launcher(`${configFileUrl}?_=${ new Date().getTime() }`, clonedArgs)
}
/* c8 ignore stop */
