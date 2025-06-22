#!/usr/bin/env node
/**
 * It seems that Lerna doesn't publish annotated tags to GitHub
 * after the release. This script is a little helper to ensure
 * this happens.
 */
import shell from 'shelljs'

const dryRunArgs = process.env.VSCODE_WDIO_DRY_RUN === 'yes' ? ' --dry-run' : ''

function exec(command: string) {
    console.log(`> ${command}\n`)
    shell.exec(command)
}

console.log('Pushing the commit and tag.\n')
exec(`git push origin --no-verify --follow-tags${dryRunArgs}`)
console.log('\nSuccessfully pushed.\n')
