export type TestResult = {
    name: string
    start: string
    end: string
    duration: number
    state: 'passed' | 'failed'
}

export type TestResults = TestResult[]
