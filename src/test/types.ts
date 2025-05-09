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

type RequireUri<T extends vscode.TestItem> = Omit<T, 'uri'> & Required<Pick<T, 'uri'>>

export type BaseTestItemMetadata = {
    isWorkspace: boolean
    isConfigFile: boolean
    isSpecFile: boolean
}

export interface WdioTestItem extends RequireUri<vscode.TestItem> {
    metadata: BaseTestItemMetadata
}

export interface WorkspaceTestItem extends WdioTestItem {
    metadata: {
        isWorkspace: true
        isConfigFile: false
        isSpecFile: false
    }
}

export interface WdioConfigTestItem extends WdioTestItem {
    metadata: {
        isWorkspace: false
        isConfigFile: true
        isSpecFile: false
        repository: TestRepository
        runProfiles: vscode.TestRunProfile[]
    }
}

export interface SpecFileTestItem extends WdioTestItem {
    metadata: {
        isWorkspace: false
        isConfigFile: false
        isSpecFile: true
        repository: TestRepository
    }
}

export interface TestcaseTestItem extends WdioTestItem {
    testCaseItem: {}
    metadata: {
        isWorkspace: false
        isConfigFile: false
        isSpecFile: false
        repository: TestRepository
        type: TestType
    }
}
