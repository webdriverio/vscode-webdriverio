import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import VscodeJsonReporter from '../../src/reporter/index.js'
import type { RunnerStats } from '@wdio/reporter'
import type { Reporters } from '@wdio/types'
import type { ResultSet, TestSuite } from '../../src/reporter/types.js'
// Mock fs module
vi.mock('node:fs', () => {
    return {
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
    }
})
// vi.mock('@wdio/reporter', ()=>{
//     const WDIOReporter = vi.fn()
//     return {
//         default:WDIOReporter,
//     }
// })

describe('VscodeJsonReporter', () => {
    let reporter: VscodeJsonReporter
    let options: Reporters.Options

    beforeEach(() => {
        vi.clearAllMocks()
        options = {
            stdout: true,
            outputDir: '/some/dir',
            writeStream: { write: vi.fn() },
        }
        reporter = new VscodeJsonReporter(options)
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    it('should initialize correctly with outputDir option', () => {
        expect(reporter['_outputDir']).toBe('/some/dir')
    })

    it('should track suite start correctly', () => {
        // Simulate a feature (top-level) suite
        const featureSuite = {
            uid: 'feature1',
            title: 'Feature 1',
            type: 'feature',
        } as any

        reporter.onSuiteStart(featureSuite)

        expect(reporter['_suiteUids'].has('feature1')).toBe(true)
        expect(reporter['_suiteIndents']['feature1']).toBe(0)

        // Simulate a nested suite
        const nestedSuite = {
            uid: 'scenario1',
            title: 'Scenario 1',
            type: 'scenario',
        } as any

        // Mock currentSuites to simulate nesting
        reporter['currentSuites'] = [featureSuite, nestedSuite]

        reporter.onSuiteStart(nestedSuite)

        expect(reporter['_suiteUids'].has('scenario1')).toBe(true)
        expect(reporter['_suiteIndents']['scenario1']).toBe(0)
        expect(reporter['_indents']).toBe(1)
        expect(reporter['_suiteParents']['scenario1']).toBe('feature1')
    })

    it('should track suite with rule correctly', () => {
        // Simulate a suite with a rule
        const suiteWithRule = {
            uid: 'rule1',
            title: 'Suite with Rule',
            rule: 'Some Rule',
        } as any

        reporter.onSuiteStart(suiteWithRule)

        expect(reporter['_suiteRules']['rule1']).toBe('Some Rule')
    })

    it('should decrease indent on suite end', () => {
        reporter['_indents'] = 2

        reporter.onSuiteEnd()

        expect(reporter['_indents']).toBe(1)
    })

    it('should write JSON file on runner end', () => {
        const runner = {
            cid: 'worker-0',
            start: new Date('2023-01-01'),
            end: new Date('2023-01-01T00:05:00'),
            capabilities: { browserName: 'chrome' },
            specs: ['test.js'],
            config: {
                framework: 'mocha',
                mochaOpts: { timeout: 10000 },
            },
        } as any

        // Mock methods used by onRunnerEnd
        reporter.getOrderedSuites = vi.fn().mockReturnValue([])
        reporter.createNestedStructure = vi.fn().mockReturnValue([])
        reporter.calculateStateCounts = vi.fn()

        reporter.onRunnerEnd(runner)

        expect(fs.writeFileSync).toHaveBeenCalledWith(path.join('/some/dir', 'wdio-worker-0.json'), expect.any(String))
    })

    it('should handle file writing errors gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

        // Mock fs.writeFileSync to throw an error
        vi.mocked(fs.writeFileSync).mockImplementation(() => {
            throw new Error('Write error')
        })

        reporter['writeFile']('worker-0', '{}')

        expect(consoleSpy).toHaveBeenCalledWith('Write error')

        consoleSpy.mockRestore()
    })

    it('should get ordered suites correctly', () => {
        // Add suites to _suiteUids in a specific order
        reporter['_suiteUids'] = new Set(['suite1', 'suite2'])

        // Mock the suites object
        reporter['suites'] = {
            suite1: { uid: 'suite1', title: 'Suite 1' },
            suite2: { uid: 'suite2', title: 'Suite 2' },
            suite3: { uid: 'suite3', title: 'Suite 3' }, // Not in _suiteUids
        } as any

        const orderedSuites = reporter.getOrderedSuites()

        expect(orderedSuites).toHaveLength(2)
        expect(orderedSuites[0].title).toBe('Suite 1')
        expect(orderedSuites[1].title).toBe('Suite 2')
    })

    it('should return cached ordered suites if available', () => {
        const cachedSuites = [{ title: 'Cached Suite' }] as any
        reporter['_orderedSuites'] = cachedSuites

        const result = reporter.getOrderedSuites()

        expect(result).toBe(cachedSuites)
    })

    it('should return correct indent level for a suite', () => {
        reporter['_suiteIndents'] = {
            suite1: 2,
            suite2: 3,
        }

        expect(reporter.indent('suite1')).toBe(2)
        expect(reporter.indent('suite2')).toBe(3)
        expect(reporter.indent('unknown')).toBe(0) // Default for unknown suites
    })

    it('should create a nested structure from ordered suites', () => {
        // Mock necessary internal data
        reporter['_suiteParents'] = {
            child1: 'parent1',
            child2: 'parent1',
            grandchild1: 'child1',
        }

        reporter['_suiteIndents'] = {
            parent1: 0,
            child1: 1,
            child2: 1,
            grandchild1: 2,
        }

        reporter['runnerStat'] = { sessionId: 'session123' } as any

        // Create test suites for the structure
        const orderedSuites = [
            {
                uid: 'parent1',
                title: 'Parent 1',
                tests: [],
                hooks: [],
                _duration: 100,
                start: new Date(),
                end: new Date(),
            },
            {
                uid: 'child1',
                title: 'Child 1',
                tests: [],
                hooks: [],
                _duration: 50,
                start: new Date(),
                end: new Date(),
            },
            {
                uid: 'grandchild1',
                title: 'Grandchild 1',
                tests: [],
                hooks: [],
                _duration: 25,
                start: new Date(),
                end: new Date(),
            },
            {
                uid: 'child2',
                title: 'Child 2',
                tests: [],
                hooks: [],
                _duration: 75,
                start: new Date(),
                end: new Date(),
            },
        ] as any

        const nestedStructure = reporter.createNestedStructure(orderedSuites)

        // We expect a tree with Parent 1 at the top level
        expect(nestedStructure).toHaveLength(1)
        expect(nestedStructure[0].name).toBe('Parent 1')

        // Parent 1 should have 2 children
        expect(nestedStructure[0].suites).toHaveLength(2)
        expect(nestedStructure[0].suites![0].name).toBe('Child 1')
        expect(nestedStructure[0].suites![1].name).toBe('Child 2')

        // Child 1 should have 1 child
        expect(nestedStructure[0].suites![0].suites).toHaveLength(1)
        expect(nestedStructure[0].suites![0].suites![0].name).toBe('Grandchild 1')
    })

    it('should create a nested structure with Cucumber rules', () => {
        // Mock necessary internal data
        reporter['_suiteParents'] = {
            scenario1: 'feature1',
            scenario2: 'feature1',
        }

        reporter['_suiteRules'] = {
            scenario1: 'Rule 1',
            scenario2: 'Rule 1',
        }

        reporter['_suiteIndents'] = {
            feature1: 0,
            scenario1: 1,
            scenario2: 1,
        }

        reporter['runnerStat'] = { sessionId: 'session123' } as any

        // Create test suites for the structure
        const orderedSuites = [
            {
                uid: 'feature1',
                title: 'Feature 1',
                tests: [],
                hooks: [],
                _duration: 100,
                start: new Date(),
                end: new Date(),
                type: 'feature',
            },
            {
                uid: 'scenario1',
                title: 'Scenario 1',
                tests: [],
                hooks: [],
                _duration: 50,
                start: new Date(),
                end: new Date(),
                rule: 'Rule 1',
            },
            {
                uid: 'scenario2',
                title: 'Scenario 2',
                tests: [],
                hooks: [],
                _duration: 75,
                start: new Date(),
                end: new Date(),
                rule: 'Rule 1',
            },
        ] as any

        const nestedStructure = reporter.createNestedStructure(orderedSuites)

        // We expect a tree with Feature 1 at the top level
        expect(nestedStructure).toHaveLength(1)
        expect(nestedStructure[0].name).toBe('Feature 1')

        // Feature 1 should have 1 Rule
        expect(nestedStructure[0].suites).toHaveLength(1)
        expect(nestedStructure[0].suites![0].name).toBe('Rule 1')

        // Rule 1 should have 2 scenarios
        expect(nestedStructure[0].suites![0].suites).toHaveLength(2)
        expect(nestedStructure[0].suites![0].suites![0].name).toBe('Scenario 1')
        expect(nestedStructure[0].suites![0].suites![1].name).toBe('Scenario 2')
    })

    it('should calculate state counts correctly', () => {
        const resultSet: ResultSet = {
            start: new Date(),
            capabilities: {} as any,
            suites: [
                {
                    name: 'Suite 1',
                    duration: 100,
                    start: new Date(),
                    tests: [
                        { name: 'Test 1', state: 'passed', duration: 10, start: new Date() },
                        { name: 'Test 2', state: 'failed', duration: 20, start: new Date() },
                    ],
                    hooks: [
                        { title: 'Hook 1', state: 'passed', duration: 5, start: new Date() },
                        {
                            title: 'Hook 2',
                            state: 'failed',
                            duration: 5,
                            start: new Date(),
                            error: new Error('Hook error'),
                        },
                    ],
                    suites: [
                        {
                            name: 'Nested Suite 1',
                            duration: 50,
                            start: new Date(),
                            tests: [
                                { name: 'Nested Test 1', state: 'passed', duration: 15, start: new Date() },
                                { name: 'Nested Test 2', state: 'skipped', duration: 0, start: new Date() },
                            ],
                            hooks: [],
                            suites: [],
                        },
                    ],
                },
            ],
            specs: [],
            state: { passed: 0, failed: 0, skipped: 0 },
        }

        reporter.calculateStateCounts(resultSet)

        expect(resultSet.state).toEqual({
            passed: 2, // 1 from Suite 1 + 1 from Nested Suite 1
            failed: 2, // 1 test from Suite 1 + 1 hook from Suite 1
            skipped: 1, // 1 from Nested Suite 1
        })
    })

    it('should prepare JSON result correctly', () => {
        // Mock runner stats
        const runner = {
            cid: 'worker-0',
            start: new Date('2023-01-01'),
            end: new Date('2023-01-01T00:05:00'),
            capabilities: { browserName: 'chrome' },
            specs: ['test.js'],
            config: {
                framework: 'mocha',
                mochaOpts: { timeout: 10000 },
            },
        } as unknown as RunnerStats

        // Mock nested structure
        const mockNestedSuites: TestSuite[] = [
            {
                name: 'Suite 1',
                duration: 100,
                start: new Date(),
                tests: [{ name: 'Test 1', state: 'passed', duration: 10, start: new Date() }],
                hooks: [],
                suites: [],
            },
        ]

        // Mock the methods used in #prepareJson
        reporter.getOrderedSuites = vi.fn().mockReturnValue([])
        reporter.createNestedStructure = vi.fn().mockReturnValue(mockNestedSuites)
        reporter.calculateStateCounts = vi.fn().mockImplementation((resultSet) => {
            resultSet.state = { passed: 1, failed: 0, skipped: 0 }
        })

        // We need to use any to access a private method
        const result = (reporter as any).prepareJson(runner)

        // Verify the result
        expect(result.start).toEqual(runner.start)
        expect(result.end).toEqual(runner.end)
        expect(result.capabilities).toEqual(runner.capabilities)
        expect(result.framework).toBe('mocha')
        expect(result.mochaOpts).toEqual({ timeout: 10000 })
        expect(result.specs).toEqual(['test.js'])
        expect(result.suites).toEqual(mockNestedSuites)
        expect(result.state).toEqual({ passed: 1, failed: 0, skipped: 0 })
    })
})
