import { Options } from '@wdio/types';

type Definition<T> = {
    [k in keyof T]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'function' | 'option'
        name: string
        default?: any
        required?: boolean
        description: string,
        options?: string[] | { name: string, description: string }[],
        multiselect?: boolean
    }
};

const AUTOMATION_PROTOCOL_OPTIONS = [
    'Detect Automatically',
    'WebDriver',
    'DevTools (powered by Puppeteer)'
];

const FRAMEWORK_OPTIONS = [
    'Mocha',
    'Jasmine',
    'Cucumber'
];

const SUPPORTED_REPORTER = [
    {
        name: 'Allure Reporter',
        description: '@wdio/allure-reporter on NPM'
    },
    {
        name: 'Concise Reporter',
        description: '@wdio/concise-reporter on NPM'
    },
    {
        name: 'Dot Reporter',
        description: '@wdio/dot-reporter on NPM'
    },
    {
        name: 'Junit Reporter',
        description: '@wdio/junit-reporter on NPM'
    },
    {
        name: 'Spec Reporter',
        description: '@wdio/spec-reporter on NPM'
    },
    {
        name: 'Sumologic Reporter',
        description: '@wdio/sumologic-reporter on NPM'
    },
    {
        name: 'Report Portal Reporter',
        description: 'wdio-reportportal-reporter'
    },
    {
        name: 'Video Reporter',
        description: 'wdio-video-reporter on NPM'
    },
    {
        name: 'HTML Reporter',
        description: '@rpii/wdio-html-reporter'
    },
    {
        name: 'JSON Reporter',
        description: 'wdio-json-reporter on NPM'
    },
    {
        name: 'Mochawesome Reporter',
        description: 'wdio-mochawesome-reporter on NPM'
    },
    {
        name: 'Timeline Reporter',
        description: 'wdio-timeline-reporter on NPM'
    },
    {
        name: 'CucumberJS JSON Reporter',
        description: 'wdio-cucumberjs-json-reporter on NPM'
    },
    {
        name: 'Markdown Reporter',
        description: 'wdio-markdown-reporter on NPM'
    }
];

const SUPPORTED_SERVICES = [
    {
        name: 'Appium Service',
        description: '@wdio/appium-service on NPM'
    },
    {
        name: 'Browserstack Service',
        description: '@wdio/browserstack-service on NPM'
    },
    {
        name: 'Crossbrowsertesting Service',
        description: '@wdio/crossbrowsertesting-service NPM'
    },
    {
        name: 'Devtools Service',
        description: '@wdio/devtools-service on NPM'
    },
    {
        name: 'Firefox Profile Service',
        description: '@wdio/firefox-profile-service on NPM'
    },
    {
        name: 'Sauce Service',
        description: '@wdio/sauce-service on NPM'
    },
    {
        name: 'Selenium Standalone Service',
        description: '@wdio/selenium-standalone-service on NPM'
    },
    {
        name: 'Shared Store Service',
        description: '@wdio/shared-store-service on NPM'
    },
    {
        name: 'Static Server Service',
        description: '@wdio/static-server-service on NPM'
    },
    {
        name: 'Testingbot Service',
        description: '@wdio/testingbot-service on NPM'
    },
    {
        name: 'ChromeDriver Service',
        description: 'wdio-chromedriver-service on NPM'
    },
    {
        name: 'Intercept Service',
        description: 'wdio-intercept-service on NPM'
    },
    {
        name: 'Zafira Listener Service',
        description: 'wdio-zafira-listener-service on NPM'
    },
    {
        name: 'Report Portal Service',
        description: 'wdio-reportportal-service on NPM'
    },
    {
        name: 'Docker Service',
        description: 'wdio-docker-service on NPM'
    },
    {
        name: 'UI5 Service',
        description: 'wdio-ui5-service on NPM'
    },
    {
        name: 'WireMock Service',
        description: 'wdio-wiremock-service on NPM'
    },
    {
        name: 'Slack Service',
        description: 'wdio-slack-service on NPM'
    },
    {
        name: 'LambdaTest Service',
        description: 'wdio-lambdatest-service on NPM'
    },
    {
        name: 'Image Comparison (Visual Regression Testing) Service',
        description: 'wdio-image-comparison-service on NPM'
    },
    {
        name: 'Ng-apimock Service',
        description: 'wdio-ng-apimock-service on NPM'
    },
    {
        name: 'Novus Visual Regression Service',
        description: 'wdio-novus-visual-regression-service on NPM'
    },
    {
        name: 'Re-run Service',
        description: 'wdio-rerun-service on NPM'
    },
    {
        name: 'winappdriver Service',
        description: 'wdio-winappdriver-service on NPM'
    },
    {
        name: 'ywinappdriver Service',
        description: 'wdio-ywinappdriver-service on NPM'
    },
    {
        name: 'PerformanceTotal Service',
        description: 'wdio-performancetotal-service on NPM'
    },
    {
        name: 'CleanupTotal Service',
        description: 'wdio-cleanuptotal-service on NPM'
    },
    {
        name: 'AWS Device Farm Service',
        description: 'wdio-aws-device-farm-service on NPM'
    },
    {
        name: 'OCR service for Appium Native Apps Service',
        description: 'wdio-ocr-service on NPM'
    },
    {
        name: 'Auto-detect missing imports w/eslint Service',
        description: 'wdio-eslinter-service on NPM'
    },
    {
        name: 'Microsoft Teams Service',
        description: 'wdio-ms-teams-service on NPM'
    }
];

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
        type: 'object',
        description: [
            'Define specs for test execution. You can either specify a glob ',
            'pattern to match multiple files at once or wrap a glob or set of ',
            'paths into an array to run them within a single worker process.'
        ].join('')
    },
    /**
     * Exclude specs from test execution.
     */
    exclude: {
        name: 'Files to Exclude',
        type: 'object',
        description: 'Exclude specs from test execution.'
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
            'bail (default is 0 - don\'t bail, run all tests).'
        ].join('')
    },
    /**
     * Default interval for all waitFor* commands.
     */
    waitforInterval: {
        name: 'WaitFor Interval',
        type: 'number',
        default: 500,
        description: 'Default interval for all waitFor* commands.'
    },
    /**
     * Default timeout for all waitFor* commands.
     */
    waitforTimeout: {
        name: 'WaitFor Timeout',
        type: 'number',
        default: 3000,
        description: 'Default timeout for all waitFor* commands.'
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
        multiselect: true
    },
    /**
     * Set of WDIO services to use.
     */
    services: {
        name: 'Services',
        type: 'option',
        description: 'Set of WDIO services to use.',
        options: SUPPORTED_SERVICES,
        multiselect: true
    },
    /**
     * Node arguments to specify when launching child processes
     */
    execArgv: {
        name: 'Worker Arguments',
        type: 'object',
        description: 'Node arguments to specify when launching child processes',
        default: []
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
