import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const filePath = path.join(rootDir, 'node_modules', 'xvfb-maybe', 'src', 'xvfb-maybe.js')

const args = process.argv.slice(2)
const optionsDef = {
    width: {
        type: 'string',
        short: 'w',
    },
    height: {
        type: 'string',
        short: 'h',
    },
} as const

const { values: options } = parseArgs({ args, options: optionsDef })

console.log('Adjust screen resolution')
console.log(`  Width : ${options.width}`)
console.log(`  Height: ${options.height}`)

const insertBefore = "const dblDashPos = args.indexOf('--'),"
const codeToInsert = `  args.unshift('--server-args=-screen 0 ${options.width}x${options.height}x24', '--');`

const sourceCode = fs.readFileSync(filePath, 'utf-8')

if (sourceCode.includes(codeToInsert)) {
    console.log('🔧 xvfb-maybe is already patched')
    process.exit(0)
}

const lines = sourceCode.split('\n')
const index = lines.findIndex((line) => line.includes(insertBefore))

if (index !== -1) {
    lines.splice(index, 0, codeToInsert)
    const newCode = lines.join('\n')
    fs.writeFileSync(filePath, newCode, 'utf-8')
    console.log('\n✅ xvfb-maybe is patched successfully\n\n')
} else {
    console.log('\n💥 could not find the target line.\n\n')
}
