import ts from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import ejs from 'rollup-plugin-ejs';

export default {
    input: 'src/editor/entry.ts',
    output: {
        file: 'out/assets/webview.bundle.js',
        format: 'esm',
        watch: true
    },
    plugins: [
        ejs({
            localsName: 'o',
            include: ['src/**/*.ejs', 'src/**/*.html'], // optional, '**/*.ejs' by default
            compilerOptions: {
                client: true,
                localsName: 'self'
            }
        }),
        ts({
            tsconfig: __dirname + '/tsconfig.rollup.json'
        }),
        resolve()
    ]
};