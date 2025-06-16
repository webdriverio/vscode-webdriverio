import { createBaseConfig } from './wdio.conf.ts'

type TestTargets = 'config' | 'timeout'

const target = (process.env.VSCODE_WDIO_E2E_SCENARIO || 'config') as TestTargets

const workspace = target === 'config' ? '../samples/smoke/update-config' : '../samples/e2e/cucumber'

function defineSpecs(target: TestTargets) {
    switch (target) {
        case 'config':
            return [
                './tests/updateConfig.spec.ts',
                './tests/updateSpec.spec.ts',
                './tests/updateErrorSpec.spec.ts',
                './tests/updateErrorConfig.spec.ts',
            ]
        default:
            return ['./tests/workerIdleTimeout.spec.ts']
    }
}

const specs = defineSpecs(target)

const settings = target === 'timeout' ? { 'webdriverio.logLevel': 'debug', 'webdriverio.workerIdleTimeout': 2 } : {}

export const config: WebdriverIO.Config = {
    ...createBaseConfig(workspace, settings),
    specs,
    maxInstances: 1,
}
