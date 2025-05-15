import { log } from '@vscode-wdio/logger'
import * as vscode from 'vscode'

import type { ResultSet, TestSuite, Test } from '@vscode-wdio/types/reporter'
import type { TestRepositoryInterface } from '@vscode-wdio/types/test'

/**
 * TestReporter class for handling WebdriverIO test results and updating VSCode TestItems
 * This class maps the WebdriverIO test results to the VSCode TestItems and updates their status
 */
export class TestReporter {
    /**
     * Creates a new instance of TestReporter
     * @param _repository The test repository containing all TestItems
     * @param _run The current test run
     */
    constructor(
        private readonly _repository: TestRepositoryInterface,
        private readonly _run: vscode.TestRun
    ) {}

    /**
     * Updates test statuses based on WebdriverIO test results
     * @param results Array of WebdriverIO test results
     * @returns True if all tests passed, false otherwise
     */
    public updateTestStatus(results: ResultSet[]): boolean {
        if (!results || results.length === 0) {
            log.debug('No test results to update')
            return false
        }

        let allPassed = true

        // Process each result (usually one per spec file)
        for (const result of results) {
            try {
                const specPaths = result.specs

                for (const specPath of specPaths) {
                    // Get the spec file TestItem
                    const specTestItem = this._repository.getSpecByFilePath(specPath)

                    if (!specTestItem) {
                        log.debug(`Spec file TestItem not found for path: ${specPath}`)
                        continue
                    }

                    // Process suites in this spec file
                    for (const suite of result.suites) {
                        this.processHierarchicalSuite(suite, specTestItem)
                    }

                    // Update spec file status based on overall result status
                    this.updateSpecFileStatus(specTestItem, result)
                }

                // Check if any test failed
                if (result.state.failed > 0) {
                    allPassed = false
                }
            } catch (error) {
                log.error(`Error updating test status: ${error instanceof Error ? error.message : String(error)}`)
                allPassed = false
            }
        }

        return allPassed
    }

    /**
     * Process a hierarchical suite and update its tests statuses
     * This method handles the hierarchical nature of the suite data
     * @param suite The suite result from WebdriverIO with potential nested suites
     * @param parentItem The parent TestItem (spec file or parent suite)
     */
    private processHierarchicalSuite(suite: TestSuite, parentItem: vscode.TestItem): void {
        // Find the suite TestItem in the repository
        let suiteItem: vscode.TestItem | undefined

        parentItem.children.forEach((child) => {
            if (child.label === suite.name) {
                suiteItem = child
            }
        })

        if (!suiteItem) {
            log.debug(`Suite TestItem not found for suite: ${suite.name}`)
            return
        }

        // Process tests in this suite
        for (const test of suite.tests) {
            this.processTest(test, suiteItem)
        }

        // Process nested suites if any
        if (suite.suites && suite.suites.length > 0) {
            for (const nestedSuite of suite.suites) {
                this.processHierarchicalSuite(nestedSuite, suiteItem)
            }
        }

        // Set suite status based on its tests
        this.updateSuiteStatus(suiteItem, suite)
    }

    /**
     * Process a test and update its status
     * @param test The test result from WebdriverIO
     * @param suiteItem The parent suite TestItem
     */
    private processTest(test: Test, suiteItem: vscode.TestItem): void {
        // Find the test item in the children of the suite item
        let testItem: vscode.TestItem | undefined

        suiteItem.children.forEach((child) => {
            if (child.label === test.name) {
                testItem = child
            }
        })

        if (!testItem) {
            log.debug(`Test item not found for test: ${test.name} in suite: ${suiteItem.label}`)
            return
        }

        // Calculate the test duration in milliseconds
        const duration = test.duration

        // Update the test status
        if (test.state === 'passed') {
            this._run.passed(testItem, duration)
        } else if (test.state === 'failed') {
            // Create an error message from the test result
            const message = new vscode.TestMessage(
                test.error ? `Test failed: ${test.error.message}` : `Test failed: ${test.name}`
            )
            this._run.failed(testItem, message, duration)
        } else if (test.state === 'skipped' || test.state === 'pending') {
            // Skipped or pending status
            this._run.skipped(testItem)
        }
    }

    /**
     * Update the status of a suite based on its tests
     * @param suiteItem The suite TestItem
     * @param suiteResult The suite result from WebdriverIO
     */
    private updateSuiteStatus(suiteItem: vscode.TestItem, suiteResult: TestSuite): void {
        const hasFailedTests = suiteResult.tests.some((test) => test.state === 'failed')

        if (hasFailedTests || suiteResult.tests.length > 0) {
            // Set the suite as failed but without displaying the error message
            // This will mark the suite as failed in the UI but won't show the red error message
            // or alternatively, if you want to indicate failure in the UI but without error text:
            // Set a minimal message that doesn't duplicate the error details
            // const message = new vscode.TestMessage('')
            // this.run.failed(suiteItem, message, suiteResult.duration)
            // Only mark as passed if there are actual tests
            this._run.passed(suiteItem, suiteResult.duration)
        }
    }

    /**
     * Update the status of a spec file based on the overall result
     * @param specItem The spec file TestItem
     * @param result The WebdriverIO result for this spec file
     */
    private updateSpecFileStatus(specItem: vscode.TestItem, result: ResultSet): void {
        if (result.state.failed > 0) {
            const message = new vscode.TestMessage(
                `${result.state.failed} tests failed out of ${result.state.passed + result.state.failed + result.state.skipped}`
            )
            this._run.failed(specItem, message)
        } else if (result.state.passed > 0) {
            this._run.passed(specItem)
        } else if (result.state.skipped > 0) {
            this._run.skipped(specItem)
        }
    }
}
