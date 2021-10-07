import { Options } from '@wdio/types';

type Definition<T> = {
    [k in keyof T]: {
        type: "string" | "number" | "boolean" | "object" | "function"
        default?: T[k]
        required?: boolean
        description: string,
        options?: string[]
    }
};

export const WDIO_DEFAULTS: Definition<Options.Testrunner> = {
    /**
     * allows to specify automation protocol
     */
    automationProtocol: {
        type: 'string',
        description: 'allows to specify automation protocol'
    },
    /**
     * Define specs for test execution. You can either specify a glob
     * pattern to match multiple files at once or wrap a glob or set of
     * paths into an array to run them within a single worker process.
     */
    specs: {
        type: 'object',
        description: [
            'Define specs for test execution. You can either specify a glob ',
            'pattern to match multiple files at once or wrap a glob or set of ',
            'paths into an array to run them within a single worker process.'
        ].join('')
    },
    /**
     * exclude specs from test execution
     */
    exclude: {
        type: 'object',
        description: 'exclude specs from test execution'
    },
    /**
     * key/value definition of suites (named by key) and a list of specs as value
     * to specify a specific set of tests to execute
     */
    suites: {
        type: 'object',
        description: [
            'key/value definition of suites (named by key) and a list of specs as value',
            'to specify a specific set of tests to execute'
        ].join('')
    },
    /**
     * capabilities of WebDriver sessions
     */
    capabilities: {
        type: 'object',
        description: 'capabilities of WebDriver sessions',
        required: true
    },
    /**
     * Shorten navigateTo command calls by setting a base url
     */
    baseUrl: {
        type: 'string',
        description: 'Shorten navigateTo command calls by setting a base url'
    },
    /**
     * If you only want to run your tests until a specific amount of tests have failed use
     * bail (default is 0 - don't bail, run all tests).
     */
    bail: {
        type: 'number',
        default: 0,
        description: [
            'If you only want to run your tests until a specific amount of tests have failed use',
            'bail (default is 0 - don\'t bail, run all tests).'
        ].join('')
    },
    /**
     * Default interval for all waitFor* commands
     */
    waitforInterval: {
        type: 'number',
        default: 500,
        description: 'Default interval for all waitFor* commands'
    },
    /**
     * Default timeout for all waitFor* commands
     */
    waitforTimeout: {
        type: 'number',
        default: 3000,
        description: 'Default timeout for all waitFor* commands'
    },
    /**
     * supported test framework by wdio testrunner
     */
    framework: {
        type: 'string',
        description: 'supported test framework by wdio testrunner',
        options: ['Mocha', 'Jasmine', 'Cucumber']
    },
    /**
     * list of reporters to use, a reporter can be either a string or an object with
     * reporter options, e.g.:
     * [
     *  'dot',
     *  {
     *    name: 'spec',
     *    outputDir: __dirname + '/reports'
     *  }
     * ]
     */
    reporters: {
        type: 'object',
        description: 'list of reporters to use, a reporter can be either a string or an object with reporter options'
    },
    /**
     * set of WDIO services to use
     */
    services: {
        type: 'object',
        description: 'set of WDIO services to use',
        default: []
    },
    /**
     * Node arguments to specify when launching child processes
     */
    execArgv: {
        type: 'object',
        description: 'Node arguments to specify when launching child processes',
        default: []
    },
    /**
     * amount of instances to be allowed to run in total
     */
    maxInstances: {
        type: 'number',
        description: 'amount of instances to be allowed to run in total'
    },
    /**
     * amount of instances to be allowed to run per capability
     */
    maxInstancesPerCapability: {
        type: 'number',
        description: 'amount of instances to be allowed to run per capability'
    },
    /**
     * list of strings to watch of `wdio` command is called with `--watch` flag
     */
    filesToWatch: {
        type: 'object',
        description: 'list of strings to watch of `wdio` command is called with `--watch` flag'
    },

    /**
     * hooks
     */
    // onPrepare: HOOK_DEFINITION,
    // onWorkerStart: HOOK_DEFINITION,
    // before: HOOK_DEFINITION,
    // beforeSession: HOOK_DEFINITION,
    // beforeSuite: HOOK_DEFINITION,
    // beforeHook: HOOK_DEFINITION,
    // beforeTest: HOOK_DEFINITION,
    // beforeCommand: HOOK_DEFINITION,
    // afterCommand: HOOK_DEFINITION,
    // afterTest: HOOK_DEFINITION,
    // afterHook: HOOK_DEFINITION,
    // afterSuite: HOOK_DEFINITION,
    // afterSession: HOOK_DEFINITION,
    // after: HOOK_DEFINITION,
    // onComplete: HOOK_DEFINITION,
    // onReload: HOOK_DEFINITION
};
