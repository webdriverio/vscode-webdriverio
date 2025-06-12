import { createBaseConfig } from './wdio.conf.ts'

const specs = [
    './tests/updateConfig.spec.ts',
    './tests/updateSpec.spec.ts',
    './tests/updateErrorSpec.spec.ts',
    './tests/updateErrorConfig.spec.ts',
]

export const config: WebdriverIO.Config = {
    ...createBaseConfig('../samples/smoke/update-config'),
    specs,
    maxInstances: 1,
}
