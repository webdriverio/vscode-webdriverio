import * as vscode from 'vscode'

import { log } from './logger.js'
import { runWdio } from '../api/run.js'
import { TestReporter } from '../test/reporter.js'
import { configManager } from '../config/index.js'

import type { WorkerManager } from '../api/server.js'
import type { TestRegistry } from '../test/registry.js'

export function createRunHandler(testRegistry: TestRegistry, workerManager: WorkerManager | null) {
    const workspaceFolders = configManager.getWorkspaceFolderPath()
    if (workspaceFolders.length < 1) {
        vscode.window.showErrorMessage('No workspace folder open')
        throw new Error()
    }
    const rootDir = workspaceFolders[0]

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
                const result = await runWdio(rootDir, _test, workerManager)

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
