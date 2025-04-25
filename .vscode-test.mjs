import { defineConfig } from '@vscode/test-cli'

export const files = 'tests/**/*.spec.ts'

export default defineConfig({
    tests: [
        {
            files,
            srcDir: './src',
            mocha: {
                require: ['./tests/setup.ts'],
                ui: 'bdd',
                preload: 'tsx/cjs',
            },
        },
    ],
    coverage: {
        reporter: { json: { file: 'coverage-mocha.json' } },
    },
})
