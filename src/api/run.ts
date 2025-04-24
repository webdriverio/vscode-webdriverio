import * as os from 'node:os'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { log } from '../utils/logger.js'
import { TEST_ID_SEPARATOR } from '../constants.js'
import {
    isConfig,
    isSpec,
    isTestcase,
    isWdioTestItem,
    type SpecFileTestItem,
    type WdioConfigTestItem,
    type TestcaseTestItem,
} from '../test/index.js'

import type * as vscode from 'vscode'
import type { ResultSet } from '../reporter/types.js'
import type { RunTestOptions } from './types.js'

export async function runWdio(test: vscode.TestItem) {
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
    const outputDir = getOutputDir()

    try {
        const testOptions: RunTestOptions = {
            outputDir,
            configPath: test.metadata.repository.wdioConfigPath,
            specs,
            grep,
            range,
        }

        log.trace(`REQUEST: ${JSON.stringify(testOptions, null, 2)}`)
        await test.metadata.repository.worker.ensureConnected()
        const result = await test.metadata.repository.worker.rpc.runTest(testOptions)

        const resultData = parseJson<ResultSet[]>(result.stdout)
        log.trace(`RESULT: ${JSON.stringify(resultData, null, 2)}`)

        return {
            success: result.success,
            duration: 0,
            detail: resultData,
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

function getOutputDir() {
    const resultRootDir = path.join(os.tmpdir(), 'vscode-webdriverio')
    try {
        fs.mkdirSync(resultRootDir, { recursive: true })
        const outputDir = fs.mkdtempSync(path.join(resultRootDir, 'result-'))
        return outputDir
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.debug(`Failed to create output directory: ${errorMessage}`)
        log.debug('Fallback to extract data from stdout.')
        return
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
