import { STATUS } from './index.ts'

export function createExpectedNotRun() {
    return {
        text: 'wdio.conf.ts',
        status: STATUS.NOT_YET_RUN,
        children: [
            {
                text: 'my-feature.feature',
                status: STATUS.NOT_YET_RUN,
                children: [
                    {
                        text: 'Example feature',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'Get title of website',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'Given I go on the website "https://webdriver.io"',
                                        status: STATUS.NOT_YET_RUN,
                                    },
                                    {
                                        text: 'Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"',
                                        status: STATUS.NOT_YET_RUN,
                                    },
                                ],
                            },
                            {
                                text: 'Business rule 1',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'Get title of website',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Given I go on the website "https://github.com/"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                text: 'Business rule 2',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'Data Tables',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Given I go on the website "http://todomvc.com/examples/react/dist/"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'When I add the following groceries',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'Then I should have a list of 4 items',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    }
}

export function createExpectedRunPartially() {
    return {
        text: 'wdio.conf.ts',
        status: STATUS.PASSED,
        children: [
            {
                text: 'my-feature.feature',
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'Example feature',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Get title of website',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'Given I go on the website "https://webdriver.io"',
                                        status: STATUS.PASSED,
                                    },
                                    {
                                        text: 'Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"',
                                        status: STATUS.PASSED,
                                    },
                                ],
                            },
                            {
                                text: 'Business rule 1',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'Get title of website',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Given I go on the website "https://github.com/"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                text: 'Business rule 2',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'Data Tables',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Given I go on the website "http://todomvc.com/examples/react/dist/"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'When I add the following groceries',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'Then I should have a list of 4 items',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
export function createExpectedRunAll() {
    return {
        text: 'wdio.conf.ts',
        status: STATUS.PASSED,
        children: [
            {
                text: 'my-feature.feature',
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'Example feature',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Get title of website',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'Given I go on the website "https://webdriver.io"',
                                        status: STATUS.PASSED,
                                    },
                                    {
                                        text: 'Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"',
                                        status: STATUS.PASSED,
                                    },
                                ],
                            },
                            {
                                text: 'Business rule 1',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'Get title of website',
                                        status: STATUS.PASSED,
                                        children: [
                                            {
                                                text: 'Given I go on the website "https://github.com/"',
                                                status: STATUS.PASSED,
                                            },
                                            {
                                                text: 'Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"',
                                                status: STATUS.PASSED,
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                text: 'Business rule 2',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'Data Tables',
                                        status: STATUS.PASSED,
                                        children: [
                                            {
                                                text: 'Given I go on the website "http://todomvc.com/examples/react/dist/"',
                                                status: STATUS.PASSED,
                                            },
                                            {
                                                text: 'When I add the following groceries',
                                                status: STATUS.PASSED,
                                            },
                                            {
                                                text: 'Then I should have a list of 4 items',
                                                status: STATUS.PASSED,
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    }
}

export function createCucumberExpected() {
    return {
        notRun: [createExpectedNotRun()],
        runAll: [createExpectedRunAll()],
        runPartially: [createExpectedRunPartially()],
    }
}
