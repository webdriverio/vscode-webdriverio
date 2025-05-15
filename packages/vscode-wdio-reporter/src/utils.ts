import type { Hook, Test } from '@vscode-wdio/types/reporter'
import type { HookStats, TestStats } from '@wdio/reporter'

export function mapHooks(hooks: HookStats[]): Hook[] {
    return hooks.map((hook) => ({
        start: hook.start,
        end: hook.end,
        duration: hook.duration,
        title: hook.title,
        associatedSuite: hook.parent,
        associatedTest: hook.currentTest,
        state: hook.errors && hook.errors.length && hook.state ? hook.state : 'passed',
        error: hook.error,
    }))
}

export function mapTests(tests: TestStats[]): Test[] {
    const result = []
    for (const test of tests) {
        if (typeof test.pendingReason !== 'undefined' && test.pendingReason === 'grep') {
            continue
        }

        result.push({
            name: test.title,
            start: test.start,
            end: test.end,
            duration: test.duration,
            state: test.state,
            error: test.error,
        })
    }
    return result
}
