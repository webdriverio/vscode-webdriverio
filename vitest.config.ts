import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        dangerouslyIgnoreUnhandledErrors: true,
        include: ['tests/**/*.test.ts'],
        /**
         * not to ESM ported packages
         */
        //['.vscode-test', 'dist', 'out', 'node_modules', 'coverage', '**/*.d.ts']
        exclude: ['dist', 'out', 'coverage', '.idea', '.git', '.vscode-test', '.cache', '**/node_modules/**'],
        env: {
            WDIO_UNIT_TESTING: '1',
        },
        coverage: {
            enabled: false,
            clean: false,
            provider: 'v8',
            include: ['src'],
            reporter: [['json', { file: 'coverage-vitest.json' }]],
            reportsDirectory: './coverage/data',
            reportOnFailure: true,
            exclude: ['**/node_modules/**', '**/__mocks__/**', '**/dist/**', '**/cjs/*.ts', '**/*.spec.ts'],
            watermarks: {
                statements: [85, 90],
                functions: [83, 88],
                branches: [85, 90],
                lines: [85, 90],
            },
        },
    },
})
