import type * as vscode from 'vscode'
import type { ResultSet } from './reporter.js'
import type { TestData } from './test.js'
import type { NumericLogLevel, TypedEventEmitterInterface } from './utils.js'

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

export interface ReadSpecsOptions {
    specs: string[]
}

export type ReadSpecsResult = {
    spec: string
    tests: TestData[]
}

export interface LoadConfigOptions {
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
export interface RunTestOptions {
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

export interface EventReady {
    type: 'ready'
    configs: string[]
    workspaceSource: string | false
}

export interface EventDebug {
    type: 'debug'
    args: string[]
}

export interface EventError {
    type: 'error'
    error: string
}

export type WorkerEvent = EventReady | EventDebug | EventError

export interface WorkerInitMetadata {
    id: string
    cwd: string
    arguments?: string
    configFile?: string
    workspaceFile?: string
    env: Record<string, any> | undefined
    pnpApi?: string
    pnpLoader?: string
}

export interface WorkerRunnerOptions {
    type: 'init'
    meta: WorkerInitMetadata
    debug: boolean
    astCollect: boolean
}

export interface WdioExtensionWorkerInterface extends TypedEventEmitterInterface<WdioExtensionWorkerEvents> {
    cid: string
    rpc: WorkerApi
    start(): Promise<void>
    waitForStart(): Promise<void>
    stop(): Promise<void>
    updateIdleTimeout(timeout: number): void
    isConnected(): boolean
    ensureConnected(): Promise<void>
}

export interface WdioExtensionWorkerEvents {
    stdout: string
    stderr: string
    idleTimeout: undefined
    shutdown: undefined
}

export interface ServerManagerInterface extends vscode.Disposable {
    start(configPaths: string[]): Promise<void>
    getConnection(configPaths: string): Promise<WdioExtensionWorkerInterface>
    reorganize(configPaths: string[]): Promise<void>
}
