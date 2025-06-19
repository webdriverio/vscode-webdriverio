import { dirname } from 'node:path'

import { log } from '@vscode-wdio/logger'
import { DebugRunner, TestRunner } from '@vscode-wdio/server'
import * as vscode from 'vscode'

import { TestReporter } from './reporter.js'
import { getWorkspaceFolder } from './utils.js'

import type { IExtensionConfigManager } from '@vscode-wdio/types/config'
import type { RepositoryManager } from './manager.js'

class TestQueue {
    private queue: vscode.TestItem[] = []

    push(item: vscode.TestItem) {
        this.queue.push(item)
    }

    forEach(cb: Parameters<typeof this.queue.forEach>[0]) {
        this.queue.forEach(cb)
    }

    [Symbol.iterator]() {
        return this.queue[Symbol.iterator]()
    }
}

export function createHandler(
    configManager: IExtensionConfigManager,
    repositoryManager: RepositoryManager,
    isDebug = false
) {
    return async function runHandler(request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> {
        const run = repositoryManager.controller.createTestRun(request)

        const queue = new TestQueue()
        // Collect the tests
        if (request.include) {
            log.debug('Test is requested by include')
            request.include.forEach((test) => {
                if (repositoryManager.getMetadata(test).isWorkspace) {
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
                if (repositoryManager.getMetadata(test).isWorkspace) {
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

            const testData = conversionCucumberStep.call(repositoryManager, test)

            const reporter = new TestReporter(testData.repository, run)

            const metadata = repositoryManager.getMetadata(testData.testItem)

            // Mark all tests as running
            markTestsAsRunning(run, testData.testItem)

            try {
                const workspaceFolder = getWorkspaceFolder.call(repositoryManager, configManager, testData.testItem)
                const runner = !isDebug
                    ? new TestRunner(configManager, workspaceFolder, await testData.repository.getWorker())
                    : new DebugRunner(
                        configManager,
                        workspaceFolder,
                        token,
                        dirname(testData.repository.wdioConfigPath)
                    )
                const result = await runner.run(testData.testItem, metadata)

                await runner.dispose()

                if (result.detail && result.detail.length > 0) {
                    // Update test status based on actual test results
                    reporter.updateTestStatus(result.detail)
                }
                if ('log' in result && result.log) {
                    run.appendOutput(result.log.replace(/\n/g, '\r\n'))
                }
                if (runner.stdout && configManager.globalConfig.showOutput) {
                    run.appendOutput(runner.stdout.replace(/\n/g, '\r\n'))
                }
            } catch (e) {
                // Runtime error handling
                run.failed(test, new vscode.TestMessage(`Runtime error: ${(e as Error).message}`))
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

function conversionCucumberStep(this: RepositoryManager, testItem: vscode.TestItem) {
    const metadata = this.getMetadata(testItem)
    const repository = this.getRepository(testItem)
    if (repository.framework !== 'cucumber' || !metadata.isTestcase) {
        return { testItem, metadata, repository }
    }
    if (metadata.type === 'step' && testItem.parent) {
        return { testItem: testItem.parent, metadata, repository }
    }
    return { testItem, metadata, repository }
}
