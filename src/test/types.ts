import type * as vscode from 'vscode'
import type { TestRepository } from './repository.js'

export type TestResult = {
    name: string
    start: string
    end: string
    duration: number
    state: 'passed' | 'failed'
}

export type TestResults = TestResult[]

export interface SourcePosition {
    line: number
    column: number
}

export interface SourceRange {
    start: SourcePosition
    end: SourcePosition
}

export type TestType =
    | 'describe'
    | 'it'
    | 'test'
    | 'before'
    | 'after'
    | 'beforeEach'
    | 'afterEach'
    | 'feature'
    | 'scenario'
    | 'step'
    | 'scenarioOutline'
    | 'background'
    | 'examples'
    | 'rule'

/**
 * TestCase information interface
 */
export interface TestData {
    type: TestType
    name: string
    range: SourceRange
    children: TestData[]
    // Optional fields for future extensions
    metadata?: Record<string, unknown>
}

export type VscodeTestData = Omit<TestData, 'range' | 'children'> & {
    uri: vscode.Uri
    range: vscode.Range
    children: VscodeTestData[]
}

export type TestItemMetadata = {
    uri: vscode.Uri
    isWorkspace: boolean
    isConfigFile: boolean
    isSpecFile: boolean
    isTestcase: boolean
    repository?: TestRepository // only workspace dose not have repository
    runProfiles?: vscode.TestRunProfile[]
    type?: TestType
}

export type TestItemMetadataWithRepository = Omit<TestItemMetadata, 'repository'> &
    Required<Pick<TestItemMetadata, 'repository'>>
