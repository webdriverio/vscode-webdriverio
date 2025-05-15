import type { WebSocket } from 'ws'
import type { SourceRange, TestData } from './test.js'
import type { LoggerInterface } from './utils.js'

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
    log: LoggerInterface
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
