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
        coverage: {
            enabled: false,
            provider: 'v8',
            exclude: ['**/__mocks__/**', '**/dist/**', '**/cjs/*.ts', '**/*.spec.ts'],
            watermarks: {
                statements: [85, 90],
                functions: [83, 88],
                branches: [85, 90],
                lines: [85, 90],
            },
        },
    },
})
