import { log } from '@vscode-wdio/logger'

import { getGrep, getRange, getCucumberSpec, getSpec } from './utils.js'
import type { IExtensionConfigManager } from '@vscode-wdio/types/config'

import type { RunTestOptions, IWdioExtensionWorker } from '@vscode-wdio/types/server'
import type { TestItemMetadata, TestItemMetadataWithRepository } from '@vscode-wdio/types/test'
import type * as vscode from 'vscode'

type Listeners = {
    stdout: (data: string) => void
    stderr: (data: string) => void
}

export class TestRunner implements vscode.Disposable {
    private _stdout = ''
    private _stderr = ''
    private _listeners: Listeners | undefined

    constructor(
        protected configManager: IExtensionConfigManager,
        protected workspaceFolder: vscode.WorkspaceFolder | undefined,
        protected worker: IWdioExtensionWorker
    ) {
        worker.idleMonitor.pauseTimer()
    }

    public get stdout() {
        return this._stdout
    }

    public get stderr() {
        return this._stderr
    }

    /**
     * Run a test based on the provided TestItem
     */
    public async run(test: vscode.TestItem, metadata: TestItemMetadata) {
        // Validate test item
        this.validateTestItem(metadata)

        // Create test execution options
        const testOptions = this.createTestOptions(test, metadata)

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
    private validateTestItem(metadata: TestItemMetadata): asserts metadata is TestItemMetadataWithRepository {
        if ('repository' in metadata && typeof metadata.repository !== 'object') {
            throw new Error('Workspace TestItem is not valid.')
        }
    }

    /**
     * Creates RunTestOptions based on the test type and framework
     */
    private createTestOptions(test: vscode.TestItem, metadata: TestItemMetadataWithRepository): RunTestOptions {
        const isCucumberFramework = this.isCucumberFramework(metadata)

        // Get appropriate specs based on the test framework and type
        const specs = this.determineSpecs(test, isCucumberFramework, metadata)

        // Get grep pattern for mocha-like frameworks when testing individual test cases
        const grep = !isCucumberFramework && metadata.isTestcase ? getGrep(test) : undefined

        // Get line range information for test file
        const range = !isCucumberFramework && metadata.isTestcase ? getRange(test) : undefined

        return {
            configPath: metadata.repository.wdioConfigPath,
            specs,
            grep,
            range,
            env: { paths: [], override: false }, // TODO: implement the logic for envFile
        }
    }

    /**
     * Determines if the test is using Cucumber framework
     */
    private isCucumberFramework(metadata: TestItemMetadataWithRepository): boolean {
        return metadata.repository.framework === 'cucumber'
    }

    /**
     * Determines the specs to run based on test type and framework
     */
    private determineSpecs(
        test: vscode.TestItem,
        isCucumberFramework: boolean,
        metadata: TestItemMetadataWithRepository
    ): string[] | undefined {
        if (metadata.isWorkspace || metadata.isConfigFile) {
            return []
        }
        if (isCucumberFramework) {
            return getCucumberSpec(test, metadata)
        }

        return getSpec(test)
    }

    /**
     * Executes the test with the provided options and processes the results
     */
    private async executeTest(testOptions: RunTestOptions) {
        log.trace(`REQUEST: ${JSON.stringify(testOptions, null, 2)}`)
        await this.worker.ensureConnected()
        this.setListener()

        const result = await this.worker.rpc.runTest(testOptions)
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
        this.worker.on('stdout', this._listeners.stdout)
        this.worker.on('stderr', this._listeners.stderr)
    }

    private removeListener() {
        if (this._listeners) {
            this.worker.removeListener('stdout', this._listeners.stdout)
            this.worker.removeListener('stderr', this._listeners.stderr)
        }
    }

    private stdoutListener(data: string) {
        this._stdout += data + '\n'
    }

    private stderrListener(data: string) {
        this._stderr += data + '\n'
    }

    async dispose() {
        this.worker.idleMonitor.resumeTimer()
    }
}
