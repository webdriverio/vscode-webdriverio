import type * as vscode from 'vscode'
import type { ResultSet } from './reporter.js'
import type { TestData } from './test.js'
import type { NumericLogLevel, ITypedEventEmitter } from './utils.js'

export type WdioConfig = {
    specs: string[]
    specPatterns: string[]
    framework: string
}

/**
 * Shared type definitions for communication between extension and worker
 */
// Worker API that extension can call
export type WorkerApi = {
    /**
     * Run WebdriverIO tests
     */
    runTest(options: RunTestOptions): Promise<TestResultData>
    /**
     * Ping worker to check if it's alive
     */
    ping(): Promise<string>
    /**
     * Read configuration for the WebdriverIO
     */
    loadWdioConfig(options: LoadConfigOptions): Promise<WdioConfig>
    /**
     * Read spec files for the WebdriverIO
     */
    readSpecs(options: ReadSpecsOptions): Promise<ReadSpecsResult[]>
    /**
     * Shutdown worker process
     */
    shutdown(): Promise<void>
}

export interface EnvOptions {
    paths: string[]
    override: boolean
}

export interface CommonRequestOptions {
    env: EnvOptions
}

export interface ReadSpecsOptions extends CommonRequestOptions {
    specs: string[]
}

export type ReadSpecsResult = {
    spec: string
    tests: TestData[]
}

export interface LoadConfigOptions extends CommonRequestOptions {
    configFilePath: string
}

// Extension API that worker can call
export type ExtensionApi = {
    /**
     * Log message to extension output channel
     */
    log(logLevel: NumericLogLevel, message: string): Promise<void>
}

// Test run options
export interface RunTestOptions extends CommonRequestOptions {
    // Path to WebdriverIO config file
    configPath: string
    // Spec files to run (optional)
    specs?: string[]
    // Test filter pattern (optional)
    grep?: string
    // Test filter range (optional)
    range?: vscode.Range
}

// Test execution result
export interface TestResultData {
    // Whether tests passed successfully
    success: boolean
    // Test output text
    stdout: string
    // Test stderr
    stderr?: string
    // Error message if any
    error?: string
    // The detail test result (this is set the stringified json data)
    json: ResultSet[]
}

export interface IWdioExtensionWorker extends ITypedEventEmitter<WdioExtensionWorkerEvents> {
    cid: string
    rpc: WorkerApi
    start(): Promise<void>
    waitForStart(): Promise<void>
    stop(): Promise<void>
    isConnected(): boolean
    updateIdleTimeout(timeout: number): void
    pauseIdleTimer(): void
    resumeIdleTimer(): void
    ensureConnected(): Promise<void>
}

export interface WdioExtensionWorkerEvents {
    stdout: string
    stderr: string
    idleTimeout: undefined
    shutdown: undefined
}

export interface IWdioExtensionWorkerFactory {
    generate(id: string, cwd: string): IWdioExtensionWorker
}

export interface IWorkerManager extends vscode.Disposable {
    getConnection(configPaths: string): Promise<IWdioExtensionWorker>
    reorganize(configPaths: string[]): Promise<void>
}

export interface IWorkerIdleMonitor {
    /**
     * Start monitoring for idle timeout
     */
    start(): void

    /**
     * Stop monitoring and clear any pending timeout
     */
    stop(): void

    /**
     * Reset the idle timer (called when worker is accessed)
     */
    resetTimer(): void

    /**
     * Update the idle timeout configuration
     * @param timeout New timeout value in seconds (0 or negative to disable)
     */
    updateTimeout(timeout: number): void

    /**
     * Pause the idle timer (called when RPC operation starts)
     */
    pauseTimer(): void

    /**
     * Resume the idle timer (called when RPC operation completes)
     */
    resumeTimer(): void

    /**
     * Add event listener for idle timeout events
     * @param event Event name ('idleTimeout')
     * @param listener Event listener function
     */
    on(event: 'idleTimeout', listener: () => void): this
}

export interface WorkerIdleMonitorOptions {
    /**
     * Idle timeout in seconds
     * Set to 0 or negative value to disable timeout
     */
    idleTimeout: number
}
