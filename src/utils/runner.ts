import * as path from 'node:path'
import * as vscode from 'vscode'

import { runWdio } from './wdioRunner.js'
import logger, { log } from './logger.js'
import type { WorkerManager } from '../manager.js'
import type { RunTestOptions } from '../api/types.js'

export function createRunHandler(testController: vscode.TestController, workerManager: WorkerManager | null) {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder open')
        throw new Error()
    }
    const rootDir = workspaceFolders[0].uri.fsPath

    return async function runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
        const run = testController.createTestRun(request)

        const queue: vscode.TestItem[] = []

        // Collect the tests
        if (request.include) {
            request.include.forEach((test) => queue.push(test))
        } else {
            testController.items.forEach((test) => queue.push(test))
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
                test.children.forEach((childTest) => {
                    controlFn(childTest)
                    testStatusController(controlFn, childTest)
                })
            }

            run.started(test)
            testStatusController(run.started, test)

            try {
                const result = await runWebdriverIOTest(rootDir, test, workerManager)

                if (result.success) {
                    run.passed(test, result.duration)
                    testStatusController(run.passed, test)
                } else {
                    run.failed(test, new vscode.TestMessage(result.errorMessage || 'Run failed'), result.duration)
                }
            } catch (e) {
                run.failed(test, new vscode.TestMessage(`Runtime error: ${(e as Error).message}`))
            }
        }

        run.end()
    }
}

async function runWebdriverIOTest(rootDir: string, test: vscode.TestItem, workerManager: WorkerManager | null) {
    // Get config path from settings
    // const config = vscode.workspace.getConfiguration('webdriverio')
    const configPath = 'wdio.conf.js'
    const fullConfigPath = path.resolve(rootDir, configPath)

    const testPath = test.uri?.fsPath
    const specs = testPath ? [testPath] : undefined
    const testNames = test.id.split('#')
    const grep = test.id.includes('#') ? testNames[testNames.length - 1] : undefined

    logger.appendLine(JSON.stringify(test, null, 2))

    const isRoot = test.id === test.uri?.fsPath
    const isEmptyRange = !test.range || test.range.isEmpty

    const range = isRoot || isEmptyRange ? undefined : test.range

    if (workerManager) {
        const testOptions: RunTestOptions = {
            rootDir: rootDir,
            configPath: fullConfigPath,
            specs,
            grep,
        }
        await workerManager.ensureConnected()
        const result = await workerManager.getWorkerRpc().runTest(testOptions)
        log.debug('==========RPC')
        log.debug(result)
        log.debug('==========RPC')
    }

    try {
        const result = await runWdio({
            rootDir,
            configPath: fullConfigPath,
            specs,
            grep,
            range,
        })

        return {
            success: result.success,
            duration: 0,
            output: result.output,
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
