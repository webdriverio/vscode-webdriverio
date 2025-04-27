import { TEST_ID_SEPARATOR } from '../constants.js'
import { isConfig, isSpec, isTestcase, isWdioTestItem } from '../test/index.js'
import { log } from '../utils/logger.js'

import type * as vscode from 'vscode'
import type { RunTestOptions } from './types.js'
import type { WdioExtensionWorkerInterface } from './types.js'
import type { ResultSet } from '../reporter/types.js'
import type { SpecFileTestItem, WdioConfigTestItem, TestcaseTestItem } from '../test/index.js'

type Listeners = {
    stdout: (data: string) => void
    stderr: (data: string) => void
}

export class TestRunner {
    public stdout = ''
    private _stderr = ''
    private _listeners: Listeners | undefined

    constructor(private _worker: WdioExtensionWorkerInterface) {}
    public async run(test: vscode.TestItem) {
        if (!isWdioTestItem(test)) {
            throw new Error("The metadata for TestItem is not set. This is extension's bug.")
        }

        if (!isConfig(test) && !isSpec(test) && !isTestcase(test)) {
            throw new Error('Workspace TestItem is not valid.')
        }
        const isCucumberTestItems = checkCucumberTestItems(test)

        const cucumberSpecs = isCucumberTestItems && isTestcase(test) ? getCucumberSpec(test) : undefined

        const _specs = isSpec(test) || isTestcase(test) ? getSpec(test) : undefined

        const specs = !cucumberSpecs ? _specs : cucumberSpecs

        const grep = !isCucumberTestItems && isTestcase(test) ? getGrep(test) : undefined
        const range = !isCucumberTestItems && isTestcase(test) ? getRange(test) : undefined

        try {
            const testOptions: RunTestOptions = {
                configPath: test.metadata.repository.wdioConfigPath,
                specs,
                grep,
                range,
            }

            log.trace(`REQUEST: ${JSON.stringify(testOptions, null, 2)}`)
            await this._worker.ensureConnected()
            this.setListener()
            const result = await this._worker.rpc.runTest(testOptions)
            this.removeListener()

            const resultData = parseJson<ResultSet[]>(result.json)
            log.trace(`RESULT: ${JSON.stringify(resultData, null, 2)}`)

            return {
                success: result.success,
                duration: 0,
                detail: resultData,
                log: result.stdout,
                errorMessage: result.error,
            }
        } catch (error) {
            const _error = error as Error
            return {
                success: false,
                errorMessage: _error.message,
                detail: [],
            }
        }
    }

    private setListener() {
        this._listeners = {
            stdout: (data: string) => this.stdoutListener(data),
            stderr: (data: string) => this.stderrListener(data),
        }
        this._worker.on('stdout', this._listeners.stdout)
        this._worker.on('stderr', this._listeners.stderr)
    }

    private removeListener() {
        if (this._listeners) {
            this._worker.removeListener('stdout', this._listeners.stdout)
            this._worker.removeListener('stderr', this._listeners.stderr)
        }
    }

    private stdoutListener(data: string) {
        this.stdout += data + '\n'
    }

    private stderrListener(data: string) {
        this._stderr += data + '\n'
    }
}

function getSpec(tests: vscode.TestItem) {
    const testPath = tests.uri?.fsPath
    return testPath ? [testPath] : undefined
}
function parseJson<T>(strJson: string): T {
    try {
        return JSON.parse(strJson)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error(`Failed to parse JSON of the wdio result: ${errorMessage}`)
        log.debug(strJson)
        throw new Error(errorMessage)
    }
}

function getGrep(test: vscode.TestItem) {
    const testNames = test.id.split(TEST_ID_SEPARATOR)
    // Escape following characters
    // $, ^, ., *, +, ?, (, ), [, ], {, }, |, \
    return testNames[testNames.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getRange(test: vscode.TestItem) {
    const isEmptyRange = !test.range || test.range.isEmpty
    return isEmptyRange ? undefined : test.range
}

function getCucumberSpec(testItem: TestcaseTestItem) {
    const baseSpec = getSpec(testItem)
    if (!baseSpec) {
        return undefined
    }
    if (testItem.metadata.type === 'rule') {
        const specs = []
        for (const [_, childItem] of testItem.children) {
            if ((childItem as TestcaseTestItem).metadata.type === 'scenario') {
                const start = childItem.range?.start.line || 0
                const end = childItem.range?.end.line || 0
                if (start > 0 && end > 0) {
                    const spec = `${baseSpec}:${String(start + 1)}:${String(end + 1)}`
                    log.debug(`cucumber spec: ${spec}`)
                    specs.push(spec)
                }
            }
        }
        if (specs.length > 0) {
            return specs
        }
    }

    if (testItem.metadata.type === 'scenario') {
        const specs = []
        const start = testItem.range?.start.line || 0
        const end = testItem.range?.end.line || 0
        if (start > 0 && end > 0) {
            const spec = `${baseSpec}:${String(start + 1)}:${String(end + 1)}`
            log.debug(`cucumber spec: ${spec}`)
            specs.push(spec)
        }
        if (specs.length > 0) {
            return specs
        }
    }
    return baseSpec
}

function checkCucumberTestItems(testItem: TestcaseTestItem | WdioConfigTestItem | SpecFileTestItem) {
    return testItem.metadata.repository.framework === 'cucumber'
}
