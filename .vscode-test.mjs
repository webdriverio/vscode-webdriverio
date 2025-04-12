import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
    files: 'tests/**/*.spec.ts',
    mocha: {
        ui: 'bdd',
        preload: 'tsx/cjs',
    },
})
