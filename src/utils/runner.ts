import * as path from 'node:path'
import * as vscode from 'vscode'

import { log } from './logger.js'
import type { WorkerManager } from '../manager.js'
import type { RunTestOptions } from '../api/types.js'
import { configManager } from '../config/config.js'

export function createRunHandler(testController: vscode.TestController, workerManager: WorkerManager | null) {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open')
        throw new Error()
    }
    const rootDir = workspaceFolders[0].uri.fsPath

    return async function runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
        const run = testController.createTestRun(request)

        const queue: (vscode.TestItem | vscode.TestItem[])[] = []

        // Collect the tests
        if (request.include) {
            log.debug('Test is requested by include')
            request.include.forEach((test) => queue.push(test))
        } else {
            log.debug('Test is requested ALL')
            const tests: vscode.TestItem[] = []
            testController.items.forEach((test) => tests.push(test))
            queue.push(tests)
        }

        // Run tests
        for (const test of queue) {
            if (token.isCancellationRequested) {
                break
            }

            const testStatusController = (
                controlFn: (test: vscode.TestItem, duration?: number) => void,
                test: vscode.TestItem
            ) => {
                controlFn(test)
                test.children.forEach((childTest) => {
                    testStatusController(controlFn, childTest)
                })
            }
            const _test = Array.isArray(test) ? test : [test]

            _test.forEach((test) => testStatusController(run.started, test))

            try {
                const result = await runWebdriverIOTest(rootDir, _test, workerManager)

                if (result.success) {
                    _test.forEach((test) => testStatusController(run.started, test))
                } else {
                    _test.forEach((test) =>
                        run.failed(test, new vscode.TestMessage(result.errorMessage || 'Run failed'), result.duration)
                    )
                }
            } catch (e) {
                _test.forEach((test) =>
                    run.failed(test, new vscode.TestMessage(`Runtime error: ${(e as Error).message}`))
                )
            }
        }

        run.end()
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
        log.debug(`RESULT: ${result.success}`)
        log.debug(`DETAIL: ${JSON.stringify(JSON.parse(result.stdout), null, 2)}`)

        return {
            success: result.success,
            duration: 0,
            output: JSON.parse(result.stdout),
        }
    } catch (error) {
        const _error = error as Error
        return {
            success: false,
            errorMessage: _error.message,
            output: _error.message,
        }
    }
}

function getGrep(test: vscode.TestItem) {
    const testNames = test.id.split('#')
    return test.id.includes('#') ? testNames[testNames.length - 1] : undefined
}

function getRange(test: vscode.TestItem) {
    const isRoot = test.id === test.uri?.fsPath
    const isEmptyRange = !test.range || test.range.isEmpty
    return isRoot || isEmptyRange ? undefined : test.range
}
