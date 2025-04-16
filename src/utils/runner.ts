import * as path from 'node:path'
import * as vscode from 'vscode'

import { log } from './logger.js'
import { TEST_ID_SEPARATOR } from '../constants.js'
import { configManager } from '../config/config.js'
import { TestReporter } from '../test/reporter.js'

import type { WorkerManager } from '../manager.js'
import type { RunTestOptions } from '../api/types.js'
import type { ResultSet } from '../reporter/types.js'
import type { TestRegistry } from '../test/registry.js'

export function createRunHandler(testRegistry: TestRegistry, workerManager: WorkerManager | null) {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open')
        throw new Error()
    }
    const rootDir = workspaceFolders[0].uri.fsPath

    return async function runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
        const run = testRegistry.controller.createTestRun(request)

        const queue: (vscode.TestItem | vscode.TestItem[])[] = []

        // Collect the tests
        if (request.include) {
            log.debug('Test is requested by include')
            request.include.forEach((test) => queue.push(test))
        } else {
            log.debug('Test is requested ALL')
            const tests: vscode.TestItem[] = []
            testRegistry.controller.items.forEach((test) => tests.push(test))
            queue.push(tests)
        }

        // Create test reporter
        const reporter = new TestReporter(testRegistry, run)

        // Run tests
        for (const test of queue) {
            if (token.isCancellationRequested) {
                break
            }

            const _test = Array.isArray(test) ? test : [test]

            // Mark all tests as running
            for (const t of _test) {
                markTestsAsRunning(run, t)
            }

            try {
                const result = await runWebdriverIOTest(rootDir, _test, workerManager)

                if (result.detail && result.detail.length > 0) {
                    // Update test status based on actual test results
                    reporter.updateTestStatus(result.detail)
                }
            } catch (e) {
                // Runtime error handling
                for (const t of _test) {
                    run.failed(t, new vscode.TestMessage(`Runtime error: ${(e as Error).message}`))
                }
            }
        }

        run.end()
    }
}

/**
 * Mark a test and all its children as running
 * @param run The current test run
 * @param test The test item to mark as running
 */
function markTestsAsRunning(run: vscode.TestRun, test: vscode.TestItem): void {
    run.started(test)
    test.children.forEach((child) => markTestsAsRunning(run, child))
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

async function runWebdriverIOTest(
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
    return test.id.includes(TEST_ID_SEPARATOR) ? testNames[testNames.length - 1] : undefined
}

function getRange(test: vscode.TestItem) {
    const isRoot = test.id === test.uri?.fsPath
    const isEmptyRange = !test.range || test.range.isEmpty
    return isRoot || isEmptyRange ? undefined : test.range
}
