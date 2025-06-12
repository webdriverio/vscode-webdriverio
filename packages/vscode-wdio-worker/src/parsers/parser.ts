import EventEmitter from 'node:events'
import { pathToFileURL } from 'node:url'

import { resolve } from 'import-meta-resolve'

import { getLauncherInstance } from '../cli.js'
import { enhanceWithPositions } from './position.js'
import { isWindows } from '../utils.js'

import type { ReadSpecsOptions } from '@vscode-wdio/types/api'
import type { TestData, WorkerMetaContext } from '@vscode-wdio/types/worker'
import type { RunCommandArguments } from '@wdio/cli'
import type { JasmineAdapter } from '@wdio/jasmine-framework'
import type { MochaAdapter } from '@wdio/mocha-framework'
import type Jasmine from 'jasmine'
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

abstract class TestExtractor {
    protected abstract reporter: BaseReporter

    protected getTestMap(tests: ExTestData[]) {
        const testMap = new Map<string, TestData[]>()
        for (const test of tests) {
            if (testMap.has(test.filename)) {
                testMap.get(test.filename)?.push(test)
            } else {
                testMap.set(test.filename, [test])
            }
        }
        return testMap
    }

    abstract extract(): Promise<Map<string, TestData[]>>
}
class CucumberTestExtractor extends TestExtractor {
    protected reporter: BaseReporter = new BaseReporter()
    extract(): Promise<Map<string, TestData[]>> {
        throw new Error('Method not implemented.')
    }
}
class MochaTestExtractor extends TestExtractor {
    constructor(
        private adaptor: MochaAdapter,
        protected reporter: BaseReporter
    ) {
        super()
    }

    async extract(): Promise<Map<string, TestData[]>> {
        await this.adaptor.run()
        const tests = enhanceWithPositions((this.reporter as MochaReporter).result)

        return this.getTestMap(tests)
    }
}
class JasmineTestExtractor extends TestExtractor {
    constructor(
        private adaptor: JasmineAdapter,
        protected reporter: BaseReporter
    ) {
        super()
    }

    async extract(): Promise<Map<string, TestData[]>> {
        const jasmine = (this.adaptor as any)._jrunner as Jasmine
        const tests = enhanceWithPositions(jasmine.env.topSuite().children.map(enumerate))

        return this.getTestMap(tests)
    }
}

const FRAMEWORK_MAP = {
    cucumber: {
        adapter: '@wdio/cucumber-framework',
        reporter: BaseReporter,
        extractor: CucumberTestExtractor,
    },
    jasmine: {
        adapter: '@wdio/jasmine-framework',
        reporter: BaseReporter,
        extractor: JasmineTestExtractor,
    },
    mocha: {
        adapter: '@wdio/mocha-framework',
        reporter: MochaReporter,
        extractor: MochaTestExtractor,
    },
} as const

export async function parseWithWdio(
    _context: WorkerMetaContext,
    options: ReadSpecsOptions
): Promise<Map<string, TestData[]>> {
    const wdioArgs: RunCommandArguments = {
        configPath: options.wdioConfigPath,
    }

    // Add specs if provided
    if (options.specs && options.specs.length > 0) {
        wdioArgs.spec = isWindows()
            ? options.specs.map((spec) => spec.replace(/^([a-z]):/, (_match, p1) => `${p1.toUpperCase()}:`))
            : options.specs
    }
    if (options.framework === 'mocha') {
        wdioArgs.mochaOpts = { dryRun: true }
    }

    const launcher = await getLauncherInstance(options.wdioConfigPath, wdioArgs)
    await launcher.initialize()
    const configParser = await launcher.getProperty('configParser')
    const lib = FRAMEWORK_MAP[options.framework].adapter
    const reporter = new FRAMEWORK_MAP[options.framework].reporter()
    const libUrl = resolve(lib, pathToFileURL(options.wdioConfigPath).href)

    const { default: libModule } = await import(libUrl)
    const frameworkAdapter = await libModule.init(
        'dummy-cid',
        configParser.getConfig(),
        configParser.getSpecs(),
        configParser.getCapabilities(),
        reporter
    )

    const extractor = new FRAMEWORK_MAP[options.framework].extractor(frameworkAdapter, reporter)

    return await extractor.extract()
}

function isSuite(x: object): x is jasmine.Suite {
    return 'children' in x
}

function enumerate(suiteOrSpecMeta: jasmine.Suite | jasmine.Spec) {
    const result = {
        name: suiteOrSpecMeta.description,
    } as any

    if (!isSuite(suiteOrSpecMeta)) {
        result.type = 'test'
        result.children = []
    } else {
        result.type = 'suite'
        result.filename = (suiteOrSpecMeta as any).suite_.filename
        result.children = suiteOrSpecMeta.children.map(enumerate)
    }

    return result
}
