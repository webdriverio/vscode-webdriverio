import fss from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { parseArgs } from 'node:util'

import { context } from 'esbuild'

import { esbuildProblemMatcherPlugin } from './plugins.js'

import type { PackageJson } from 'type-fest'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..', '..')

const args = process.argv.slice(2)
const optionsDef = {
    project: {
        type: 'string',
        short: 'p',
    },
    watch: {
        type: 'boolean',
    },
    production: {
        type: 'boolean',
    },
} as const

const { values: options } = parseArgs({ args, options: optionsDef })

if (!options.project) {
    throw new Error('--project or -p is required.')
}

const pkgPath = path.resolve(rootDir, 'packages', options.project, 'package.json')

if (!fss.existsSync(pkgPath)) {
    throw new Error(`The package.json is not found: ${pkgPath}`)
}

const pkg = (await import(url.pathToFileURL(pkgPath).href, { assert: { type: 'json' } })).default

const absWorkingDir = path.dirname(pkgPath)

const exports = (pkg.exports || {}) as PackageJson.ExportConditions

const exportedModules = Object.entries(exports).filter?.(
    ([, exp]) => typeof exp === 'object' && !Array.isArray(exp)
) as [string, PackageJson.ExportConditions][]

const entryPoints: string[] = []
for (const [_, exp] of exportedModules) {
    const source = (exp.import as string | undefined) || (exp.require as string | undefined) || './src/index.ts'
    if (typeof exp.require === 'string') {
        const requireSource = (exp.requireSource as string | undefined) || source
        entryPoints.push(path.resolve(absWorkingDir, requireSource))
    }
}
if (entryPoints.length < 1) {
    throw new Error(`No export module found to build at: ${absWorkingDir}`)
}

const ctx = await context({
    sourceRoot: absWorkingDir,
    entryPoints,
    bundle: true,
    format: 'cjs',
    minify: options.production,
    sourcemap: !options.production,
    sourcesContent: false,
    platform: 'node',
    outdir: path.resolve(absWorkingDir, 'dist'),
    outExtension: { '.js': '.cjs' },
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
        /* add to the end of plugins array */
        esbuildProblemMatcherPlugin,
    ],
})
if (options.watch) {
    await ctx.watch()
} else {
    await ctx.rebuild()
    await ctx.dispose()
}
