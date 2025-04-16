import type * as vscode from 'vscode'

export type TestResult = {
    name: string
    start: string
    end: string
    duration: number
    state: 'passed' | 'failed'
}

export type TestResults = TestResult[]

/**
 * TestCase information interface - Keeping the same structure as original
 */
export interface TestCaseInfo {
    type: 'describe' | 'it' | 'test'
    name: string
    range: vscode.Range
    children: TestCaseInfo[]
}
