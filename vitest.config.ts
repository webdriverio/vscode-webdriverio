import { defineConfig, defaultExclude } from 'vitest/config'

export default defineConfig({
    // https://github.com/vitest-dev/vitest/discussions/6662
    server: {
        watch: {
            ignored: ['**/dist/**'],
        },
    },

    test: {
        projects: ['packages/*'],
        dangerouslyIgnoreUnhandledErrors: true,
        include: ['packages/**/*.test.ts'],
        /**
         * not to ESM ported packages
         */
        exclude: [...defaultExclude, '**/coverage/**', '.vscode-test'],
        env: {
            WDIO_UNIT_TESTING: '1',
        },
        coverage: {
            enabled: false,
            clean: false,
            include: ['packages/*/src/**'],
            provider: 'v8',
            reportOnFailure: true,
            exclude: [...defaultExclude, 'packages/wdio-vscode-types/src/**'],
            watermarks: {
                statements: [85, 90],
                functions: [83, 88],
                branches: [85, 90],
                lines: [85, 90],
            },
        },
    },
})
