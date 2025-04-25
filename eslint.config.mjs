import vitest from '@vitest/eslint-plugin'
import wdioEslint from '@wdio/eslint'
import * as pluginImportX from 'eslint-plugin-import-x'

export default wdioEslint.config([
    {
        /**
         * Eslint ignore patterns for the whole project
         */
        ignores: ['.vscode-test', 'dist', 'out', 'node_modules', 'coverage', '**/*.d.ts'],
    },
    {
        files: ['**/*.ts'],
    },
    {
        plugins: {
            'import-x': pluginImportX,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            'no-throw-literal': 'warn',
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', ['sibling', 'parent'], 'type'],
                    alphabetize: { order: 'asc' },
                    sortTypesGroup: true,
                    'newlines-between': 'always',
                    'newlines-between-types': 'ignore',
                },
            ],
        },
    },
    {
        files: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-unused-expressions': 'off',
        },
    },
    {
        /**
         * Eslint configuration for the vitest test files
         */
        files: ['tests/**/*.test.ts'],
        plugins: {
            vitest,
        },
        rules: {
            ...vitest.configs.recommended.rules,
            'vitest/max-nested-describe': ['error', { max: 3 }],
            'vitest/padding-around-describe-blocks': 'error',
            'vitest/padding-around-test-blocks': 'error',
        },
    },
])
