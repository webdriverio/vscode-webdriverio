import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    files: 'tests/**/*.spec.ts',
    mocha: {
        require: ['./tests/setup.ts'],
        ui: 'bdd',
        preload: 'tsx/cjs',
    },
})
