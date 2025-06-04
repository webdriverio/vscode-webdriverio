import * as cucumber from './cucumber.ts'
import { STATUS } from './index.ts'

function createExpectedNotRun(targetFramework: 'mocha' | 'jasmine') {
    return {
        text: 'wdio.conf.ts',
        status: STATUS.NOT_YET_RUN,
        children: [
            {
                text: `${targetFramework}.spec.ts`,
                status: STATUS.NOT_YET_RUN,
                children: [
                    {
                        text: 'Website Tests',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            { text: 'should be a pending test', status: STATUS.NOT_YET_RUN },
                            { text: 'should have the right title - WebdriverIO', status: STATUS.NOT_YET_RUN },
                            {
                                text: 'should have the right title - WebdriverJS Testpage',
                                status: STATUS.NOT_YET_RUN,
                            },
                            { text: 'should fail', status: STATUS.NOT_YET_RUN },
                        ],
                    },
                ],
            },
        ],
    }
}

function createExpectedRunAll(targetFramework: 'mocha' | 'jasmine') {
    return {
        text: 'wdio.conf.ts',
        status: STATUS.FAILED,
        children: [
            {
                text: `${targetFramework}.spec.ts`,
                status: STATUS.FAILED,
                children: [
                    {
                        text: 'Website Tests',
                        status: STATUS.FAILED,
                        children: [
                            { text: 'should be a pending test', status: STATUS.SKIPPED },
                            { text: 'should have the right title - WebdriverIO', status: STATUS.PASSED },
                            {
                                text: 'should have the right title - WebdriverJS Testpage',
                                status: STATUS.PASSED,
                            },
                            { text: 'should fail', status: STATUS.FAILED },
                        ],
                    },
                ],
            },
        ],
    }
}
function createExpectedRunPartially(targetFramework: 'mocha' | 'jasmine') {
    return {
        text: 'wdio.conf.ts',
        status: STATUS.PASSED,
        children: [
            {
                text: `${targetFramework}.spec.ts`,
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'Website Tests',
                        status: STATUS.PASSED,
                        children: [
                            { text: 'should be a pending test', status: STATUS.NOT_YET_RUN },
                            { text: 'should have the right title - WebdriverIO', status: STATUS.PASSED },
                            {
                                text: 'should have the right title - WebdriverJS Testpage',
                                status: STATUS.NOT_YET_RUN,
                            },
                            { text: 'should fail', status: STATUS.NOT_YET_RUN },
                        ],
                    },
                ],
            },
        ],
    }
}

export function createExpected(targetFramework: 'mocha' | 'jasmine') {
    return {
        notRun: [createExpectedNotRun(targetFramework)],
        runAll: [createExpectedRunAll(targetFramework)],
        runPartially: [createExpectedRunPartially(targetFramework)],
    }
}
