import wdioEslint from '@wdio/eslint'

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
        },
    },
])
