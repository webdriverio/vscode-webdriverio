import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import * as emoji from 'node-emoji'
import shell from 'shelljs'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..', '..')
const targetFiles = [
    path.resolve(rootDir, 'README.md'),
    path.resolve(rootDir, 'CHANGELOG.md'),
    path.resolve(rootDir, 'LICENSE'),
]
const destDir = path.resolve(rootDir, 'packages/vscode-webdriverio')

const result = shell.cp('-f', targetFiles, destDir)

if (result.stdout) {
    console.log(result.stdout)
}
if (result.stderr) {
    console.error(result.stderr)
}
if (result.code === 0) {
    console.log(
        `All files were copied: \n${targetFiles
            .map((file) => {
                const from = path.relative(rootDir, file)
                const to = path.relative(rootDir, `${destDir}/${path.basename(file)}`)
                return `  ${from} -> ${to}`
            })
            .join('\n')}`
    )
} else {
    process.exit(result.code)
}

const changelog = path.join(destDir, 'CHANGELOG.md')

try {
    console.log(`\nReplace emoji of markdown to real character: ${changelog}\n`)
    const content = fs.readFileSync(changelog, { encoding: 'utf8' })
    fs.writeFileSync(changelog, emoji.emojify(content), { encoding: 'utf8' })
} catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log(`Error: ${msg}\n`)
    process.exit(1)
}
console.log('Completed!!\n')
process.exit(0)
