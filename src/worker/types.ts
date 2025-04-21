import type { LoggerInterface } from '../types.js'
import type { SourceRange, TestData } from '../api/index.js'
import type { WebSocket } from 'ws'

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
