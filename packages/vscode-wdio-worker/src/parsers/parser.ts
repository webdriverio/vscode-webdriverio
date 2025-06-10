import EventEmitter from 'node:events'
import { pathToFileURL } from 'node:url'

import { resolve } from 'import-meta-resolve'

import { getLauncherInstance } from '../cli.js'
import { TestPositionEnhancer } from './position.js'
import { isWindows } from '../config.js'
import type { ReadSpecsOptions } from '@vscode-wdio/types/api'
import type { TestData, WorkerMetaContext } from '@vscode-wdio/types/worker'
import type { RunCommandArguments } from '@wdio/cli'
import type { ExTestData } from './position.js'

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
    result: ExTestData[] = []
    testMap = new Map<string, TestData>()

    emit(eventName: string, payload: any) {
        console.log(payload)
        if (eventName !== 'test:start' && eventName !== 'suite:start' && eventName !== 'test:pending') {
            return true
        }
        const type = eventName.startsWith('test:') ? 'test' : 'suite'
        const testItem: ExTestData = {
            type,
            name: payload.title,
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

export async function parseWithWdio(
    context: WorkerMetaContext,
    options: ReadSpecsOptions
): Promise<Map<string, TestData[]>> {
    const log = context.log

    log.debug(`==PARSER START===   ${options.framework}`)
    const wdioArgs: RunCommandArguments = {
        configPath: options.wdioConfigPath,
    }

    // Add specs if provided
    if (options.specs && options.specs.length > 0) {
        wdioArgs.spec = isWindows()
            ? options.specs.map((spec) => spec.replace(/^([a-z]):/, (_match, p1) => `${p1.toUpperCase()}:`))
            : options.specs
    }

    const launcher = await getLauncherInstance(options.wdioConfigPath, wdioArgs)
    await launcher.initialize()
    const configParser = await launcher.getProperty('configParser')
    const lib = FRAMEWORK_MAP[options.framework].adapter
    const r = new FRAMEWORK_MAP[options.framework].reporter()
    const enhancer = new TestPositionEnhancer()
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
        const enhanced = enhancer.enhanceWithPositions((r as MochaReporter).result)

        console.log(JSON.stringify(enhanced, null, 2))
        const result = new Map<string, TestData[]>()
        for (const test of enhanced) {
            if (result.has(test.filename)) {
                result.get(test.filename)?.push(test)
            } else {
                result.set(test.filename, [test])
            }
        }
        return result
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
        const enhanced = enhancer.enhanceWithPositions(a._jrunner.env.topSuite().children.map(toEnumerateResult))

        console.log(JSON.stringify(enhanced, null, 2))
        const result = new Map<string, TestData[]>()
        for (const test of enhanced) {
            if (result.has(test.filename)) {
                result.get(test.filename)?.push(test)
            } else {
                result.set(test.filename, [test])
            }
        }
        return result
    }

    throw new Error('Invalid framework is imputed')
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
        name: suiteOrSpecMeta.description,
    } as any

    if (suiteOrSpecMeta.children === undefined) {
        result.type = 'test'
        result.children = []
    } else {
        result.type = 'suite'
        result.filename = suiteOrSpecMeta.suite_.filename
        result.children = suiteOrSpecMeta.children.map(toEnumerateResult)
    }

    return result
}
