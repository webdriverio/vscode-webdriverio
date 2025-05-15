import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        dangerouslyIgnoreUnhandledErrors: true,
        include: ['packages/**/*.test.ts'],
        /**
         * not to ESM ported packages
         */
        exclude: ['dist', 'out', 'coverage', '.idea', '.git', '.vscode-test', '.cache', '**/node_modules/**'],
        env: {
            WDIO_UNIT_TESTING: '1',
        },
        coverage: {
            enabled: false,
            clean: false,
            include: ['packages/*/src/**'],
            provider: 'v8',
            reportOnFailure: true,
            exclude: ['**/node_modules/**', 'packages/wdio-vscode-types/src/**'],
            watermarks: {
                statements: [85, 90],
                functions: [83, 88],
                branches: [85, 90],
                lines: [85, 90],
            },
        },
    },
})
