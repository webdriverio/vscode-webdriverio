import { getGrep, getRange, getCucumberSpec, getSpec } from './utils.js'
import { isConfig, isSpec, isTestcase, isWdioTestItem } from '../test/index.js'
import { log } from '../utils/logger.js'

import type * as vscode from 'vscode'
import type { RunTestOptions } from './types.js'
import type { WdioExtensionWorkerInterface } from './types.js'
import type { SpecFileTestItem, WdioConfigTestItem, TestcaseTestItem } from '../test/index.js'

type Listeners = {
    stdout: (data: string) => void
    stderr: (data: string) => void
}

export class TestRunner {
    private _stdout = ''
    private _stderr = ''
    private _listeners: Listeners | undefined

    constructor(private _worker: WdioExtensionWorkerInterface) {}

    public get stdout() {
        return this._stdout
    }

    public get stderr() {
        return this._stderr
    }

    /**
     * Run a test based on the provided TestItem
     */
    public async run(test: vscode.TestItem) {
        // Validate test item
        this.validateTestItem(test)

        // Create test execution options
        const testOptions = this.createTestOptions(test)

        try {
            // Execute test and process results
            return await this.executeTest(testOptions)
        } catch (error) {
            const _error = error as Error
            return {
                success: false,
                errorMessage: _error.message,
                detail: [],
            }
        }
    }

    /**
     * Validates that the provided TestItem is a valid WebdriverIO test
     */
    private validateTestItem(
        test: vscode.TestItem
    ): asserts test is TestcaseTestItem | WdioConfigTestItem | SpecFileTestItem {
        if (!isWdioTestItem(test)) {
            throw new Error("The metadata for TestItem is not set. This is extension's bug.")
        }

        if (!isConfig(test) && !isSpec(test) && !isTestcase(test)) {
            throw new Error('Workspace TestItem is not valid.')
        }
    }

    /**
     * Creates RunTestOptions based on the test type and framework
     */
    private createTestOptions(test: TestcaseTestItem | WdioConfigTestItem | SpecFileTestItem): RunTestOptions {
        const isCucumberFramework = this.isCucumberFramework(test)

        // Get appropriate specs based on the test framework and type
        const specs = this.determineSpecs(test, isCucumberFramework)

        // Get grep pattern for mocha-like frameworks when testing individual test cases
        const grep = !isCucumberFramework && isTestcase(test) ? getGrep(test) : undefined

        // Get line range information for test file
        const range = !isCucumberFramework && isTestcase(test) ? getRange(test) : undefined

        return {
            configPath: test.metadata.repository.wdioConfigPath,
            specs,
            grep,
            range,
        }
    }

    /**
     * Determines if the test is using Cucumber framework
     */
    private isCucumberFramework(test: TestcaseTestItem | WdioConfigTestItem | SpecFileTestItem): boolean {
        return test.metadata.repository.framework === 'cucumber'
    }

    /**
     * Determines the specs to run based on test type and framework
     */
    private determineSpecs(
        test: TestcaseTestItem | WdioConfigTestItem | SpecFileTestItem,
        isCucumberFramework: boolean
    ): string[] | undefined {
        if (isCucumberFramework && isTestcase(test)) {
            return getCucumberSpec(test)
        }

        if (isSpec(test) || isTestcase(test)) {
            return getSpec(test)
        }

        return undefined
    }

    /**
     * Executes the test with the provided options and processes the results
     */
    private async executeTest(testOptions: RunTestOptions) {
        log.trace(`REQUEST: ${JSON.stringify(testOptions, null, 2)}`)
        await this._worker.ensureConnected()
        this.setListener()

        const result = await this._worker.rpc.runTest(testOptions)
        this.removeListener()
        const resultData = result.json
        log.trace(`RESULT: ${JSON.stringify(resultData, null, 2)}`)

        return {
            success: result.success,
            duration: 0,
            detail: resultData,
            log: result.stdout,
            errorMessage: result.error,
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
        this._stdout += data + '\n'
    }

    private stderrListener(data: string) {
        this._stderr += data + '\n'
    }
}
