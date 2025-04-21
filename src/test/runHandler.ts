import * as vscode from 'vscode'

import { log } from '../utils/logger.js'
import { runWdio } from '../api/index.js'
import { repositoryManager, TestReporter, isConfig, isSpec, isTestcase, isWorkspace } from './index.js'

// export function createRunHandler() {
export async function runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
    const run = repositoryManager.controller.createTestRun(request)

    const queue: vscode.TestItem[] = []

    // Collect the tests
    if (request.include) {
        log.debug('Test is requested by include')
        request.include.forEach((test) => {
            if (isWorkspace(test)) {
                // In case of a TestItem for  workspaces, store the TestItem of a config files one by one in a queue
                test.children.forEach((childTest) => {
                    queue.push(childTest)
                })
            } else {
                queue.push(test)
            }
        })
    } else {
        log.debug('Test is requested ALL')
        repositoryManager.controller.items.forEach((test) => {
            if (isWorkspace(test)) {
                test.children.forEach((t) => {
                    queue.push(t)
                })
            } else {
                queue.push(test)
            }
        })
    }

    // Run tests
    for (const test of queue) {
        if (token.isCancellationRequested) {
            break
        }

        // Create test reporter
        if (isWorkspace(test)) {
            throw new Error('Workspace TestItem is not valid.')
        }
        if (!isConfig(test) && !isSpec(test) && !isTestcase(test)) {
            throw new Error('Workspace TestItem is not valid.')
        }

        const reporter = new TestReporter(test.metadata.repository, run)

        // Mark all tests as running
        markTestsAsRunning(run, test)

        try {
            const result = await runWdio(test)

            if (result.detail && result.detail.length > 0) {
                // Update test status based on actual test results
                reporter.updateTestStatus(result.detail)
            }
        } catch (e) {
            // Runtime error handling
            run.failed(test, new vscode.TestMessage(`Runtime error: ${(e as Error).message}`))
        }
    }

    run.end()
}
// }

/**
 * Mark a test and all its children as running
 * @param run The current test run
 * @param test The test item to mark as running
 */
function markTestsAsRunning(run: vscode.TestRun, test: vscode.TestItem): void {
    run.started(test)
    test.children.forEach((child) => markTestsAsRunning(run, child))
}
