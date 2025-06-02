#!/usr/bin/env node
/**
 * It seems that Lerna doesn't publish annotated tags to GitHub
 * after the release. This script is a little helper to ensure
 * this happens.
 */
import shell from 'shelljs'

import pkg from '../../../lerna.json' with { type: 'json' }

if (process.env.VSCODE_WDIO_DRY_RUN === 'yes') {
    console.log('dryRun is `yes`. Skip the push.')
    process.exit(0)
}

console.log('Pushing the commit and tag.')
shell.exec('git push origin --no-verify')
shell.exec(`git push origin refs/tags/v${pkg.version} -f --no-verify`)
console.log('Successfully pushed.')
