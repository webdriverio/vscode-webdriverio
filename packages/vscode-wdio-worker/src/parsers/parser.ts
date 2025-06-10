import EventEmitter from 'node:events'
import { pathToFileURL } from 'node:url'

import { resolve } from 'import-meta-resolve'

import { getLauncherInstance } from '../cli.js'
import type { ReadSpecsOptions } from '@vscode-wdio/types/api'
import type { WorkerMetaContext } from '@vscode-wdio/types/worker'

class BaseReporter extends EventEmitter {
    errors: Error[] = []
    constructor() {
        super()
        this.on('error', (e) => {
            this.errors.push(e)
        })
    }
}

class MochaReporter extends BaseReporter {
    result: any[] = []
    testMap = new Map<string, any>()

    emit(eventName: string, payload: any) {
        if (eventName !== 'test:start' && eventName !== 'suite:start') {
            return true
        }
        const type = eventName.startsWith('test:') ? 'test' : 'suite'
        const testItem = {
            type,
            title: payload.title,
            parent: payload.parent,
            filename: payload.file,
            children: [],
        }
        this.testMap.set(payload.title, testItem)

        if (!payload.parent) {
            this.result.push(testItem)
        } else {
            this.testMap.get(payload.parent)?.children.push(testItem)
        }
        return true
    }
}

const FRAMEWORK_MAP = {
    cucumber: { adapter: '@wdio/cucumber-framework', reporter: BaseReporter },
    jasmine: { adapter: '@wdio/jasmine-framework', reporter: BaseReporter },
    mocha: {
        adapter: '@wdio/mocha-framework',
        reporter: MochaReporter,
    },
} as const
// class DummyReporter extends EventEmitter{
//     result:any[] = []
//     testMap = new Map<string, any>()
//     constructor(){
//         super()
//         this.on('error', (e)=>{
//             console.log(e)
//         })
//     }
//     emit(_eventName: string, payload:any ){
//         if (payload.type !== 'test:start' && payload.type !== 'suite:start'){
//             return true
//         }
//         const type = payload.type.startsWith('test:') ? 'test' : 'suite'
//         const testItem = {
//             type,
//             title:payload.title,
//             parent:payload.parent,
//             filename: payload.file,
//             children:[],
//         }
//         this.testMap.set(payload.title, testItem)

//         if (!payload.parent) {
//             this.result.push(testItem)
//         } else {
//             this.testMap.get(payload.parent)?.children.push(testItem)
//         }
//         // console.log(`========= EMIT ${eventName}`)
//         // console.log(payload)
//         // console.log(`========= EMIT ${eventName}`)
//         return true
//     }
// }
export async function parseWithWdio(context: WorkerMetaContext, options: ReadSpecsOptions) {
    const log = context.log

    log.debug(`==PARSER START===   ${options.framework}`)

    try {
        const launcher = await getLauncherInstance(options.wdioConfigPath)
        await launcher.initialize()
        const configParser = await launcher.getProperty('configParser')
        const lib = FRAMEWORK_MAP[options.framework].adapter
        const r = new FRAMEWORK_MAP[options.framework].reporter()
        if (options.framework === 'mocha') {
            const libUrl = resolve(lib, pathToFileURL(options.wdioConfigPath).href)

            const { default: libModule } = await import(libUrl)
            const a = await libModule.init(
                'dummy-cid',
                configParser.getConfig(),
                configParser.getSpecs(),
                configParser.getCapabilities(),
                r
            )
            a._mocha.dryRun()
            await a.run()

            console.log(JSON.stringify((r as MochaReporter).result, null, 2))
        } else if (options.framework === 'jasmine') {
            const libUrl = resolve(lib, pathToFileURL(options.wdioConfigPath).href)
            const { default: libModule } = await import(libUrl)
            const a = await libModule.init(
                'dummy-cid',
                configParser.getConfig(),
                configParser.getSpecs(),
                configParser.getCapabilities(),
                r
            )
            const result = a._jrunner.env.topSuite().children.map(toEnumerateResult)
            console.log(JSON.stringify(result, null, 2))
        }
    } catch (error) {
        log.debug(`==PARSER ==ERROR=== test process ${error}`)
        log.debug(`==PARSER ==ERROR=== test process ${(error as Error).stack}`)
    }

    log.debug(`==PARSER ==END=== test process ${options.framework}`)
}

function toEnumerateResult(suiteOrSpecMeta: any) {
    // Omit parent links to avoid JSON serialization failure due to circular
    // references. Omit IDs since they aren't stable across executions. Add
    // type information to make interpreting the output easier.

    /**
     * @interface EnumeratedSuiteOrSpec
     * @property {string} type - 'suite' or 'spec'
     * @property {EnumeratedSuiteOrSpec[]} [children] - Only defined for suites
     */
    const result = {
        title: suiteOrSpecMeta.description,
    } as any

    if (suiteOrSpecMeta.children === undefined) {
        result.type = 'spec'
    } else {
        result.type = 'suite'
        result.filename = suiteOrSpecMeta.suite_.filename
        result.children = suiteOrSpecMeta.children.map(toEnumerateResult)
    }

    return result
}
