import type { WebSocket } from 'ws'
import type { SourceRange, TestData } from './test.js'
import type { ILogger } from './utils.js'

export type TestCodeParser = (fileContent: string, uri: string) => TestData[]

export type CucumberTestData = Omit<TestData, 'type' | 'children'> & {
    type: 'feature' | 'scenario' | 'scenarioOutline' | 'step' | 'examples' | 'background' | 'rule'
    children: CucumberTestData[]
    metadata: {
        // Cucumber specific properties
        description?: string
        tags?: CucumberTag[]
        stepType?: StepType
        // For future extensions
        steps?: StepInfo[]
        examples?: { [key: string]: string[] } // For Scenario outlines
        dataTable?: string[][] // For data tables
        docString?: string // For document strings
    }
}

export interface CucumberTag {
    name: string
    range: SourceRange
}

export type StepType = 'Given' | 'When' | 'Then' | 'And' | 'But' | '*'

export type { SourceRange, TestData }

export interface WorkerMetaContext {
    cwd: string
    log: ILogger
    ws: WebSocket
    shutdownRequested: boolean
    pendingCalls: Array<() => void>
}

export interface GherkinLocation {
    line: number
    column: number
}

export interface StepInfo {
    type: 'step'
    text: string
    keyword: StepType
    range: SourceRange
    dataTable?: string[][]
    docString?: string
}

export interface TagInfo {
    name: string
    range: SourceRange
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
     * Check if monitoring is currently active
     */
    isActive(): boolean

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
