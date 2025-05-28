#!/usr/bin/env node
import shell from 'shelljs'

if (process.env.VSCODE_WDIO_DRY_RUN === 'yes') {
    console.log('dryRun is `yes`. Skip the publish.')
    process.exit(0)
}

const args = process.argv.slice(2)
const command = `vsce publish ${args.join(' ')}`

console.log(`Running: ${command}`)
shell.exec(command)
console.log('Successfully published.')
