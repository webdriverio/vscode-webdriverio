import { Octokit } from '@octokit/rest'

import pkg from '../../../lerna.json' with { type: 'json' }
/**
 * make GitHub release for machine readable changelog
 */

const api = new Octokit({ auth: process.env.GITHUB_AUTH })

const isGithubActions = Boolean(process.env.GITHUB_ACTIONS)
if (!isGithubActions) {
    console.log('\nSkip creating the Github Release because this is not running on the Github Actions.')
    process.exit(0)
}
const newChangelog = process.env.VSCODE_WDIO_RELEASE_NOTE
if (!newChangelog) {
    console.error('The release note is not set. please set as environment variable `VSCODE_WDIO_RELEASE_NOTE`')
    process.exit(1)
}

api.repos.createRelease({
    owner: 'webdriverio',
    repo: 'vscode-webdriverio',
    tag_name: `v${pkg.version}`,
    name: `v${pkg.version}`,
    body: newChangelog,
})
