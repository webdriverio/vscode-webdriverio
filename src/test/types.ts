import type * as vscode from 'vscode'

export type TestResult = {
    name: string
    start: string
    end: string
    duration: number
    state: 'passed' | 'failed'
}

export type TestResults = TestResult[]

export interface SourcePosition {
    offset: number
}

export interface SourceRange {
    start: SourcePosition
    end: SourcePosition
}

/**
/**
 * TestCase information interface
 */
export interface TestData {
    type: 'describe' | 'it' | 'test' | 'before' | 'after' | 'beforeEach' | 'afterEach'
    name: string
    range: SourceRange
    children: TestData[]
}

export type VscodeTestData = Omit<TestData, 'range' | 'children'> & {
    uri: vscode.Uri
    range: vscode.Range
    children: VscodeTestData[]
}

export type TestCodeParser = (fileContent: string, uri: string) => TestData[]
