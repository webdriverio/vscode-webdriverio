import wdioEslint from '@wdio/eslint'

export default wdioEslint.config([
    {
        /**
         * Eslint ignore patterns for the whole project
         */
        ignores: ['dist', 'node_modules', 'coverage', '**/*.d.ts'],
    },
    {
        files: ['**/*.ts'],
    },
    {
        rules: {
            '@typescript-eslint/naming-convention': [
                'warn',
                {
                    selector: 'import',
                    format: ['camelCase', 'PascalCase'],
                },
            ],
            '@stylistic/indent': ['error', 4, { SwitchCase: 1 }],
            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',
            semi: 'off',
        },
    },
])
