import { dirname, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globSync } from 'glob'
import shell from 'shelljs'

// @ts-ignore
import { files } from '../.vscode-test.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = normalize(join(__dirname, '..'))
// change to root directory
shell.cd(rootDir)

const tempDir = './coverage/tmp'
const dataDir = './coverage/data'

const testFiles = globSync(files, { cwd: rootDir })
const srcFiles = testFiles.map((file) => {
    return join('src', relative('tests', file).replace(/spec.ts$/, 'ts'))
})
console.log('Target files of the vscode-test-cli')
console.log(srcFiles.join('\n'))

const includeOpts = srcFiles.map((file) => {
    return `-n ${file}`
})

const result = shell.exec(
    `pnpm exec nyc report --reporter json ${includeOpts.join(' ')} -t ${tempDir}  --report-dir ${dataDir}`
)

if (result.code !== 0) {
    console.log(`error: ${result.stdout}\n${result.stderr}`)
    process.exit(1)
}

shell.mv(`${dataDir}/coverage-final.json`, `${dataDir}/coverage-mocha.json`)
