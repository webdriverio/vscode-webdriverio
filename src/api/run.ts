import * as path from 'node:path'

import { log } from '../utils/logger.js'
import { configManager } from '../config/index.js'
import { TEST_ID_SEPARATOR } from '../constants.js'

import type * as vscode from 'vscode'
import type { WorkerManager } from './server.js'
import type { ResultSet } from '../reporter/types.js'
import type { RunTestOptions } from './types.js'

export async function runWdio(
    rootDir: string,
    tests: vscode.TestItem | vscode.TestItem[],
    workerManager: WorkerManager | null
) {
    // TODO: Support search the configuration files
    // Get config path from settings
    const configPath = configManager.globalConfig.configPath
    const fullConfigPath = path.resolve(rootDir, configPath)

    const _tests = Array.isArray(tests) ? tests : [tests]

    const specs = getSpec(_tests)

    const grep = _tests.length === 1 ? getGrep(_tests[0]) : undefined
    const range = _tests.length === 1 ? getRange(_tests[0]) : undefined

    try {
        if (!workerManager) {
            throw new Error('Worker is not initialized.')
        }
        const testOptions: RunTestOptions = {
            rootDir: rootDir,
            configPath: fullConfigPath,
            specs,
            grep,
            range,
        }
        await workerManager.ensureConnected()
        const result = await workerManager.getWorkerRpc().runTest(testOptions)

        const resultData = parseJson<ResultSet[]>(result.stdout)
        log.debug(`RESULT: ${result.success}`)
        log.debug(`DETAIL: ${JSON.stringify(resultData, null, 2)}`)

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

function getSpec(tests: vscode.TestItem[]) {
    if (tests.length === 1) {
        const testPath = tests[0].uri?.fsPath
        return testPath ? [testPath] : undefined
    }
    return tests
        .map((test) => {
            const testPath = test.uri?.fsPath
            return testPath ? testPath : undefined
        })
        .filter((testPath) => typeof testPath === 'string')
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
    return test.id.includes(TEST_ID_SEPARATOR)
        ? testNames[testNames.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        : undefined
}

function getRange(test: vscode.TestItem) {
    const isRoot = test.id === test.uri?.fsPath
    const isEmptyRange = !test.range || test.range.isEmpty
    return isRoot || isEmptyRange ? undefined : test.range
}
