import ts from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';

export default {
    input: 'src/webviews/entry.ts',
    output: {
        file: 'out/assets/webview.bundle.js',
        format: 'esm',
        watch: true
    },
    plugins: [
        ts({
            tsconfig: './tsconfig.rollup.json'
        }),
        resolve()
    ]
};