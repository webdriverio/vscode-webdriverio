#!/usr/bin/env node
/**
 * It seems that Lerna doesn't publish annotated tags to GitHub
 * after the release. This script is a little helper to ensure
 * this happens.
 */
import shell from 'shelljs'

import pkg from '../../../lerna.json' with { type: 'json' }

const isGithubActions = Boolean(process.env.GITHUB_ACTIONS)

console.log('\nPushing release tag...')
if (!isGithubActions) {
    console.log('\nSkip pushing because this is not running on the Github Actions.')
    process.exit(0)
}
shell.exec('git push origin --no-verify')
shell.exec(`git push origin refs/tags/v${pkg.version} -f --no-verify`)
