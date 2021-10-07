import { Options } from '@wdio/types';

type Definition<T> = {
    [k in keyof T]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'function' | 'option'
        name: string
        default?: any
        required?: boolean
        description: string,
        options?: string[] | { label: string, value?: string }[],
        multi?: boolean
    }
};

const LOGLEVEL_OPTIONS = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];

const AUTOMATION_PROTOCOL_OPTIONS = [{
    label: 'Detect Automatically',
    value: undefined
}, {
    label: 'WebDriver',
    value: 'webdriver'
}, {
    label: 'DevTools (powered by Puppeteer)',
    value: 'devtools'
}];

const FRAMEWORK_OPTIONS = [{
    label: 'Mocha',
    value: 'mocha'
}, {
    label: 'Jasmine',
    value: 'jasmine'
}, {
    label: 'Cucumber',
    value: 'cucumber'
}];

const SUPPORTED_REPORTER = [{
    label: 'Allure Reporter',
    value: 'allure'
}, {
    label: 'Concise Reporter',
    value: 'concise'
}, {
    label: 'Dot Reporter',
    value: 'dot'
}, {
    label: 'Junit Reporter',
    value: 'junit'
}, {
    label: 'Spec Reporter',
    value: 'spec'
}, {
    label: 'Sumologic Reporter',
    value: 'sumologic'
}, {
    label: 'Report Portal Reporter',
    value: 'reportportal'
}, {
    label: 'Video Reporter',
    value: 'video'
}, {
    label: 'HTML Reporter',
    value: '@rpii/wdio-html-reporter'
}, {
    label: 'JSON Reporter',
    value: 'json'
}, {
    label: 'Mochawesome Reporter',
    value: 'mochawesome'
}, {
    label: 'Timeline Reporter',
    value: 'timeline'
}, {
    label: 'CucumberJS JSON Reporter',
    value: 'cucumberjs-json'
}, {
    label: 'Markdown Reporter',
    value: 'markdown'
}, {
    label: 'TeamCity Reporter',
    value: 'teamcity'
}];

const SUPPORTED_SERVICES = [{
    label: 'Appium Service',
    value: 'appium'
}, {
    label: 'Browserstack Service',
    value: 'browserstack'
}, {
    label: 'Crossbrowsertesting Service',
    value: 'crossbrowsertesting'
}, {
    label: 'Devtools Service',
    value: 'devtools'
}, {
    label: 'Firefox Profile Service',
    value: 'firefox-profile'
}, {
    label: 'Sauce Service',
    value: 'sauce'
}, {
    label: 'Selenium Standalone Service',
    value: 'selenium-standalone'
}, {
    label: 'Shared Store Service',
    value: 'shared-store'
}, {
    label: 'Static Server Service',
    value: 'static-server'
}, {
    label: 'Testingbot Service',
    value: 'testingbot'
}, {
    label: 'ChromeDriver Service',
    value: 'chromedriver'
}, {
    label: 'Intercept Service',
    value: 'intercept'
}, {
    label: 'Zafira Listener Service',
    value: 'zafira-listener'
}, {
    label: 'Report Portal Service',
    value: 'reportportal'
}, {
    label: 'Docker Service',
    value: 'docker'
}, {
    label: 'UI5 Service',
    value: 'ui5'
}, {
    label: 'WireMock Service',
    value: 'wiremock'
}, {
    label: 'Slack Service',
    value: 'slack'
}, {
    label: 'LambdaTest Service',
    value: 'lambdatest'
}, {
    label: 'Image Comparison (Visual Regression Testing) Service',
    value: 'image-comparison'
}, {
    label: 'Ng-apimock Service',
    value: 'ng-apimock'
}, {
    label: 'Novus Visual Regression Service',
    value: 'novus-visual-regression'
}, {
    label: 'Re-run Service',
    value: 'rerun'
}, {
    label: 'winappdriver Service',
    value: 'winappdriver'
}, {
    label: 'ywinappdriver Service',
    value: 'ywinappdriver'
}, {
    label: 'PerformanceTotal Service',
    value: 'performancetotal'
}, {
    label: 'CleanupTotal Service',
    value: 'cleanuptotal'
}, {
    label: 'AWS Device Farm Service',
    value: 'aws-device-farm'
}, {
    label: 'OCR service for Appium Native Apps Service',
    value: 'ocr'
}, {
    label: 'Auto-detect missing imports w/eslint Service',
    value: 'eslinter'
}, {
    label: 'Microsoft Teams Service',
    value: 'ms-teams'
}];

export const WDIO_DEFAULTS: Definition<Options.Testrunner> = {
    /**
     * Allows to specify automation protocol.
     */
    automationProtocol: {
        name: 'Automation Protocol',
        type: 'option',
        description: 'Allows to specify automation protocol.',
        options: AUTOMATION_PROTOCOL_OPTIONS,
        default: AUTOMATION_PROTOCOL_OPTIONS[0]
    },
    /**
     * Define specs for test execution. You can either specify a glob
     * pattern to match multiple files at once or wrap a glob or set of
     * paths into an array to run them within a single worker process.
     */
    specs: {
        name: 'Spec Files',
        type: 'string',
        description: [
            'Define specs for test execution. You can either specify a glob ',
            'pattern to match multiple files at once or wrap a glob or set of ',
            'paths into an array to run them within a single worker process.'
        ].join(''),
        multi: true
    },
    /**
     * Exclude specs from test execution.
     */
    exclude: {
        name: 'Files to Exclude',
        type: 'string',
        description: 'Exclude specs from test execution.',
        multi: true
    },
    /**
     * Definition of suites (named by key) and a list of specs as value
     * to specify a specific set of tests to execute
     */
    suites: {
        name: 'Suites',
        type: 'object',
        description: [
            'Definition of suites (named by key) and a list of specs as value',
            'to specify a specific set of tests to execute'
        ].join('')
    },
    /**
     * Capabilities of WebDriver sessions.
     */
    capabilities: {
        name: 'Capabilities',
        type: 'object',
        description: 'Capabilities of WebDriver sessions.',
        required: true
    },
    /**
     * Shorten navigateTo command calls by setting a base url.
     */
    baseUrl: {
        name: 'Base URL',
        type: 'string',
        description: 'Shorten navigateTo command calls by setting a base url.'
    },
    /**
     * If you only want to run your tests until a specific amount of tests have failed use
     * bail (default is 0 - don't bail, run all tests).
     */
    bail: {
        name: 'Bail',
        type: 'number',
        default: 0,
        description: [
            'If you only want to run your tests until a specific amount of tests have failed use',
            'bail (default is <code>0</code> - don\'t bail, run all tests).'
        ].join('')
    },
    /**
     * Level of logging verbosity.
     */
    logLevel: {
        name: 'Logging Level',
        type: 'option',
        options: LOGLEVEL_OPTIONS,
        description: 'Level of logging verbosity.',
        default: 'info'
    },
    /**
     * Default interval for all waitFor* commands.
     */
    waitforInterval: {
        name: 'WaitFor Interval',
        type: 'number',
        default: 500,
        description: 'Default interval for all <code>waitFor*</code> commands.'
    },
    /**
     * Default timeout for all waitFor* commands.
     */
    waitforTimeout: {
        name: 'WaitFor Timeout',
        type: 'number',
        default: 3000,
        description: 'Default timeout for all <code>waitFor*</code> commands.'
    },
    /**
     * Supported test framework by wdio testrunner.
     */
    framework: {
        name: 'Framework',
        type: 'option',
        description: 'Supported test framework by wdio testrunner.',
        options: FRAMEWORK_OPTIONS
    },
    /**
     * List of reporters to use, a reporter can be either a string or an object with
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
        name: 'Reporters',
        type: 'option',
        description: 'List of reporters to use, a reporter can be either a string or an object with reporter options.',
        options: SUPPORTED_REPORTER,
        multi: true
    },
    /**
     * Set of WDIO services to use.
     */
    services: {
        name: 'Services',
        type: 'option',
        description: 'Set of WDIO services to use.',
        options: SUPPORTED_SERVICES,
        multi: true
    },
    /**
     * Node arguments to specify when launching child processes
     */
    execArgv: {
        name: 'Worker Arguments',
        type: 'string',
        description: 'Node arguments to specify when launching child processes',
        multi: true
    },
    /**
     * amount of instances to be allowed to run in total
     */
    maxInstances: {
        name: 'Maximum Instances',
        type: 'number',
        description: 'amount of instances to be allowed to run in total'
    },
    /**
     * amount of instances to be allowed to run per capability
     */
    maxInstancesPerCapability: {
        name: 'Maxium Instances by Capability',
        type: 'number',
        description: 'amount of instances to be allowed to run per capability'
    },
    /**
     * list of strings to watch of `wdio` command is called with `--watch` flag
     */
    filesToWatch: {
        name: 'Files to Watch',
        type: 'string',
        description: 'list of strings to watch of <code>wdio</code> command is called with <code>--watch</code> flag',
        multi: true
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
