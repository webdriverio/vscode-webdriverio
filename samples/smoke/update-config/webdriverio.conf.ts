import '@wdio/types'
import { config as baseConfig } from './wdio.conf.ts'

export const config = {
    ...baseConfig,
    specs: ['tests/*.test.ts'],
}
