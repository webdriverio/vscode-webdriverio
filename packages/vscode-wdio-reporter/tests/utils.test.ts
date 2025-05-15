import { describe, expect, it } from 'vitest'

import { mapHooks, mapTests } from '../src/utils.js'
import type { HookStats, TestStats } from '@wdio/reporter'

describe('Reporter Utils', () => {
    describe('mapHooks', () => {
        it('should map hooks correctly', () => {
            const mockHooks: HookStats[] = [
                {
                    uid: 'hook1',
                    title: 'before all hook',
                    parent: 'Suite 1',
                    currentTest: 'Test 1',
                    start: new Date('2023-01-01T00:00:00'),
                    end: new Date('2023-01-01T00:00:01'),
                    duration: 1000,
                    state: 'passed',
                } as HookStats,
                {
                    uid: 'hook2',
                    title: 'after each hook',
                    parent: 'Suite 2',
                    currentTest: 'Test 2',
                    start: new Date('2023-01-01T00:00:02'),
                    end: new Date('2023-01-01T00:00:03'),
                    duration: 1000,
                    state: 'failed',
                    errors: [new Error('Hook failed')],
                    error: new Error('Hook failed'),
                } as HookStats,
            ]

            const mappedHooks = mapHooks(mockHooks)

            expect(mappedHooks).toHaveLength(2)

            // Check first hook
            expect(mappedHooks[0]).toEqual({
                title: 'before all hook',
                associatedSuite: 'Suite 1',
                associatedTest: 'Test 1',
                start: mockHooks[0].start,
                end: mockHooks[0].end,
                duration: 1000,
                state: 'passed',
                error: undefined,
            })

            // Check second hook
            expect(mappedHooks[1]).toEqual({
                title: 'after each hook',
                associatedSuite: 'Suite 2',
                associatedTest: 'Test 2',
                start: mockHooks[1].start,
                end: mockHooks[1].end,
                duration: 1000,
                state: 'failed',
                error: mockHooks[1].error,
            })
        })

        it('should default to passed state when no errors', () => {
            const mockHooks: HookStats[] = [
                {
                    uid: 'hook1',
                    title: 'before all hook',
                    parent: 'Suite 1',
                    start: new Date(),
                    end: new Date(),
                    duration: 1000,
                    // No state defined
                } as HookStats,
            ]

            const mappedHooks = mapHooks(mockHooks)
            expect(mappedHooks[0].state).toBe('passed')
        })

        it('should handle hooks with errors', () => {
            const mockHooks: HookStats[] = [
                {
                    uid: 'hook1',
                    title: 'before all hook',
                    parent: 'Suite 1',
                    start: new Date(),
                    end: new Date(),
                    duration: 1000,
                    state: 'failed',
                    errors: [new Error('Hook error')],
                    error: new Error('Hook error'),
                } as HookStats,
            ]

            const mappedHooks = mapHooks(mockHooks)
            expect(mappedHooks[0].state).toBe('failed')
            expect(mappedHooks[0].error).toEqual(mockHooks[0].error)
        })
    })

    describe('mapTests', () => {
        it('should map tests correctly', () => {
            const mockTests: TestStats[] = [
                {
                    uid: 'test1',
                    title: 'Test 1',
                    start: new Date('2023-01-01T00:00:00'),
                    end: new Date('2023-01-01T00:00:01'),
                    duration: 1000,
                    state: 'passed',
                } as TestStats,
                {
                    uid: 'test2',
                    title: 'Test 2',
                    start: new Date('2023-01-01T00:00:02'),
                    end: new Date('2023-01-01T00:00:03'),
                    duration: 1000,
                    state: 'failed',
                    error: new Error('Test failed'),
                } as TestStats,
                {
                    uid: 'test3',
                    title: 'Test 3',
                    start: new Date('2023-01-01T00:00:04'),
                    duration: 0,
                    state: 'skipped',
                } as TestStats,
            ]

            const mappedTests = mapTests(mockTests)

            expect(mappedTests).toHaveLength(3)

            // Check first test
            expect(mappedTests[0]).toEqual({
                name: 'Test 1',
                start: mockTests[0].start,
                end: mockTests[0].end,
                duration: 1000,
                state: 'passed',
                error: undefined,
            })

            // Check second test
            expect(mappedTests[1]).toEqual({
                name: 'Test 2',
                start: mockTests[1].start,
                end: mockTests[1].end,
                duration: 1000,
                state: 'failed',
                error: mockTests[1].error,
            })

            // Check third test
            expect(mappedTests[2]).toEqual({
                name: 'Test 3',
                start: mockTests[2].start,
                end: undefined,
                duration: 0,
                state: 'skipped',
                error: undefined,
            })
        })

        it('should skip tests with pendingReason "grep"', () => {
            const mockTests: TestStats[] = [
                {
                    uid: 'test1',
                    title: 'Test 1',
                    start: new Date(),
                    end: new Date(),
                    duration: 1000,
                    state: 'passed',
                } as TestStats,
                {
                    uid: 'test2',
                    title: 'Test 2',
                    start: new Date(),
                    end: new Date(),
                    duration: 0,
                    state: 'pending',
                    pendingReason: 'grep',
                } as TestStats,
            ]

            const mappedTests = mapTests(mockTests)

            // Only the first test should be included
            expect(mappedTests).toHaveLength(1)
            expect(mappedTests[0].name).toBe('Test 1')
        })

        it('should include pending tests with reasons other than "grep"', () => {
            const mockTests: TestStats[] = [
                {
                    uid: 'test1',
                    title: 'Test 1',
                    start: new Date(),
                    end: new Date(),
                    duration: 0,
                    state: 'pending',
                    pendingReason: 'skipped in code',
                } as TestStats,
            ]

            const mappedTests = mapTests(mockTests)

            expect(mappedTests).toHaveLength(1)
            expect(mappedTests[0].name).toBe('Test 1')
        })
    })
})
