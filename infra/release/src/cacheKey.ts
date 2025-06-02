#!/usr/bin/env node
import crypto from 'node:crypto'

import * as core from '@actions/core'
import { minVersion } from 'semver'

import pkg from '../../../packages/vscode-webdriverio/package.json' with { type: 'json' }

const VSCODE_RELEASES = 'https://update.code.visualstudio.com/api/releases/stable'

async function resolveStable() {
    try {
        console.log(`Fetch releases from ${VSCODE_RELEASES}`)
        const res = await fetch(VSCODE_RELEASES)
        const availableVersions: string[] = (await res.json()) as string[]
        return availableVersions[0]
    } catch {
        console.log('Failed to fetch.')
        return ''
    }
}

async function generate() {
    console.log('Resolve version of the vscode')
    const isCompatibilityMode = process.env.VSCODE_WDIO_E2E_COMPATIBILITY_MODE === 'yes'

    const version = isCompatibilityMode ? minVersion(pkg.engines.vscode)?.version : await resolveStable()
    if (!version) {
        console.log('Failed to resolve.')
        return ''
    }
    console.log(`Resolved version: ${version}`)
    const os = process.env.RUNNER_OS || process.platform
    const arch = process.arch
    const hash = crypto.createHash('sha256').update(version).digest('hex')
    return `vscode-cache-${os}-${arch}-${hash}`
}

console.log('Generate the cache key for the vscode')
const key = await generate()
console.log(`Generated key: ${key}`)

core.setOutput('vscode-cache-key', key)
