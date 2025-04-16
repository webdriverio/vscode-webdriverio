import WDIOReporter, { type RunnerStats, type SuiteStats } from '@wdio/reporter'
import type { Reporters } from '@wdio/types'

import type { ResultSet, TestSuite } from './types.js'

import { mapHooks, mapTests } from './utils.js'

export default class VscodeJsonReporter extends WDIOReporter {
    // Track suite order and nesting, similar to spec reporter
    private _suiteUids = new Set<string>()
    private _suiteIndents: Record<string, number> = {}
    private _indents = 0
    private _orderedSuites: SuiteStats[] = []
    // Track parent-child relationships
    private _suiteParents: Record<string, string> = {}

    constructor(options: Reporters.Options) {
        if (options.logFile && options.logFile.endsWith('.log')) {
            options.logFile = options.logFile.slice(0, -4) + '.json'
        }
        super(options)
    }

    // Track suite start to capture nesting information
    onSuiteStart(suite: SuiteStats) {
        this._suiteUids.add(suite.uid)

        // Store parent reference for all non-root suites
        if (this.currentSuites.length > 1) {
            const parentSuite = this.currentSuites[this.currentSuites.length - 2]
            this._suiteParents[suite.uid] = parentSuite.uid
        }

        // Handle feature (top-level) suites differently from nested suites
        if (suite.type === 'feature') {
            this._indents = 0
            this._suiteIndents[suite.uid] = this._indents
        } else {
            // Store current indent level for this suite
            this._suiteIndents[suite.uid] = this._indents
            // Increment indent for the next child suite that may come
            this._indents++
        }
    }

    // Reset indent count when a suite ends
    onSuiteEnd() {
        this._indents--
    }

    onRunnerEnd(runner: RunnerStats) {
        const json = this.#prepareJson(runner)
        this.write(JSON.stringify(json))
    }

    /**
     * Get suites in the order they were called
     * @return {Array} Ordered suites
     */
    getOrderedSuites() {
        if (this._orderedSuites.length) {
            return this._orderedSuites
        }

        this._orderedSuites = []
        for (const uid of this._suiteUids) {
            for (const [suiteUid, suite] of Object.entries(this.suites)) {
                if (suiteUid !== uid) {
                    continue
                }

                this._orderedSuites.push(suite)
            }
        }

        return this._orderedSuites
    }

    /**
     * Get indent level for a suite based on its nesting
     * @param  {string} uid Unique suite key
     * @return {number}     Indent level
     */
    indent(uid: string): number {
        return this._suiteIndents[uid] || 0
    }

    /**
     * Create a nested structure for suites based on parent-child relationships
     * @param {Array} orderedSuites Suites in execution order
     * @return {Array} Nested suite structure
     */
    createNestedStructure(orderedSuites: SuiteStats[]): TestSuite[] {
        // First process all suites into TestSuite objects
        const suitesMap: Record<string, TestSuite> = {}

        // Convert all suites to TestSuite format but don't link them yet
        for (const suite of orderedSuites) {
            // Skip root suites completely
            if (suite.title === '(root)') {
                continue
            }

            suitesMap[suite.uid] = {
                name: suite.title,
                duration: suite._duration,
                start: suite.start,
                end: suite.end,
                sessionId: this.runnerStat?.sessionId || '',
                tests: mapTests(suite.tests),
                hooks: mapHooks(suite.hooks),
                suites: [], // Initialize empty array for children
                level: this.indent(suite.uid),
            }
        }

        // Top level suites (no parent or parent is root)
        const topLevelSuites: TestSuite[] = []

        // Now establish all parent-child relationships
        for (const [uid, suite] of Object.entries(suitesMap)) {
            const parentUid = this._suiteParents[uid]

            if (parentUid && suitesMap[parentUid]) {
                // This suite has a parent that's in our map
                const parentSuite = suitesMap[parentUid]
                parentSuite.suites = parentSuite.suites || []
                parentSuite.suites.push(suite)
            } else {
                // No parent or parent is root - this is a top level suite
                topLevelSuites.push(suite)
            }
        }

        return topLevelSuites
    }

    #prepareJson(runner: RunnerStats) {
        const resultSet: ResultSet = {
            start: runner.start,
            end: runner.end,
            capabilities: runner.capabilities,
            framework: runner.config.framework,
            mochaOpts: runner.config.mochaOpts,
            suites: [],
            specs: [],
            state: { passed: 0, failed: 0, skipped: 0 },
        }

        for (const spec of runner.specs) {
            resultSet.specs.push(spec)

            // Get suites in execution order
            const orderedSuites = this.getOrderedSuites()

            // Create nested structure based on parent-child relationships
            const nestedSuites = this.createNestedStructure(orderedSuites)

            // Add the nested suites to the result
            resultSet.suites = nestedSuites

            // Calculate overall state counts
            this.calculateStateCounts(resultSet)
        }

        return resultSet
    }

    /**
     * Recursively calculate test state counts from all suites
     * @param {ResultSet} resultSet The result object to update
     */
    calculateStateCounts(resultSet: ResultSet) {
        // Reset counts
        resultSet.state = { passed: 0, failed: 0, skipped: 0 }

        // Recursive function to count test states
        const countTestStates = (suites: TestSuite[]) => {
            for (const suite of suites) {
                // Count hook errors
                resultSet.state.failed += suite.hooks.filter((hook) => hook.error).length

                // Count test states
                resultSet.state.passed += suite.tests.filter((test) => test.state === 'passed').length
                resultSet.state.failed += suite.tests.filter((test) => test.state === 'failed').length
                resultSet.state.skipped += suite.tests.filter((test) => test.state === 'skipped').length

                // Process nested suites
                if (suite.suites && suite.suites.length > 0) {
                    countTestStates(suite.suites)
                }
            }
        }

        countTestStates(resultSet.suites)
    }
}
