#!/usr/bin/env node

/**
 * script to auto update CHANGELOG.md file
 */
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import * as core from '@actions/core'
import * as dotenv from 'dotenv'
import shell from 'shelljs'

import { createPreReleaseVer, getCurrentDate } from './utils.js'
import pkg from '../../../lerna.json' with { type: 'json' }

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..', '..')
const changelogPath = path.join(root, 'CHANGELOG.md')

dotenv.config({ path: path.join(root, '.env') })

if (!process.env.GITHUB_AUTH) {
    shell.exec('git checkout -- .')
    console.error(
        'Please export a "GITHUB_AUTH" access token to generate the changelog.\n' +
            'See also https://github.com/webdriverio/vscode-webdriverio/blob/main/CONTRIBUTION.md#release-new-version'
    )
    process.exit(1)
}

const createInitial = (version: string) => {
    return `## v${version} (${getCurrentDate()})

#### :rocket: New Feature
* All packages
    * Initial release

`
}

const createChangelog = (version: string, changelog: string) => {
    if (changelog) {
        return changelog
    }
    return `## v${version} (${getCurrentDate()})

No updates!
`
}

console.log('Start generating changelog...')
const result = shell.exec('pnpm exec lerna-changelog --next-version-from-metadata', { silent: true })

const isNoGitTags = result.stdout.match(new RegExp('fatal: No names found'))

if (result.code !== 0 && !isNoGitTags) {
    console.log('ERROR: Failed to generate changelog.')
    process.exit(1)
}

/**
 * update local tags
 */
const BANNER = `
#######################
###                 ###
###    CHANGELOG    ###
###                 ###
#######################`

const orgNewChangelog = isNoGitTags ? createInitial(pkg.version) : createChangelog(pkg.version, result.stdout.trim())

const isPreRelease = Boolean(process.env.VSCODE_WDIO_PRE_RELEASE_PATCH_NUMBER || '')

const newChangelog = !isPreRelease
    ? orgNewChangelog
    : orgNewChangelog + `\n\n> Package as v${createPreReleaseVer(pkg.version)} `

let changelogContent = fs.readFileSync(changelogPath, 'utf8')
changelogContent = changelogContent.replace('---', '---\n' + newChangelog)
fs.writeFileSync(changelogPath, changelogContent, 'utf8')

console.log(BANNER)
console.log(newChangelog)
core.setOutput('changelog', newChangelog)
