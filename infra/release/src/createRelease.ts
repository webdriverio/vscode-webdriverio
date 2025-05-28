import path from 'node:path'
import url from 'node:url'

import { Octokit } from '@octokit/rest'
import * as dotenv from 'dotenv'

import pkg from '../../../lerna.json' with { type: 'json' }

/**
 * make GitHub release for machine readable changelog
 */
const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..', '..')
dotenv.config({ path: path.join(root, '.env') })

const api = new Octokit({ auth: process.env.GITHUB_AUTH })
const newChangelog = process.env.VSCODE_WDIO_RELEASE_NOTE
if (!newChangelog) {
    console.error('The release note is not set. please set as environment variable `VSCODE_WDIO_RELEASE_NOTE`')
    process.exit(1)
}

const repo = process.env.GITHUB_REPOSITORY || ''
const [owner, repoName] = repo.split('/')
if (owner !=='webdriverio' || repoName !== 'vscode-webdriverio'){
    console.error(`This repository is not correct repository. (Current: ${repo})`)
    process.exit(1)
}

if (process.env.VSCODE_WDIO_DRY_RUN === 'yes') {
    console.log('*---- DRY RUN ----*')
    console.log(`tag_name: v${pkg.version}`)
    console.log(`name:     v${pkg.version}`)
    console.log(newChangelog)
    process.exit(0)
}
console.log(`Creating Github Release: v${pkg.version}`)
api.repos.createRelease({
    owner: 'webdriverio',
    repo: 'vscode-webdriverio',
    tag_name: `v${pkg.version}`,
    name: `v${pkg.version}`,
    body: newChangelog,
})
console.log(`Created Github Release: v${pkg.version}`)
