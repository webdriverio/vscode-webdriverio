import type * as vscode from 'vscode'
/**
 * Shared type definitions for communication between extension and worker
 */

// Worker API that extension can call
export type WorkerApi = {
    /**
     * Run WebDriverIO tests
     */
    runTest(options: RunTestOptions): Promise<TestResult>

    /**
     * Ping worker to check if it's alive
     */
    ping(): Promise<string>

    /**
     * Shutdown worker process
     */
    shutdown(): Promise<void>
}

// Extension API that worker can call
export type ExtensionApi = {
    /**
     * Log message to extension output channel
     */
    log(message: string): Promise<void>

    /**
     * Report test progress
     */
    reportProgress(progress: TestProgress): Promise<void>
}

// Test run options
export interface RunTestOptions {
    // Root directory of the project
    rootDir: string
    // Path to WebDriverIO config file
    configPath: string
    // Spec files to run (optional)
    specs?: string[]
    // Test filter pattern (optional)
    grep?: string
    // Test filter range (optional)
    range?: vscode.Range
}

// Test execution result
export interface TestResult {
    // Whether tests passed successfully
    success: boolean
    // Test output text
    stdout: string
    stderr?: string
    // Error message if any
    error?: string
}

// Test progress information
export interface TestProgress {
    // Current status message
    message: string
    // Progress percentage (0-100), if applicable
    percentage?: number
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
