#!/usr/bin/env node
import { pathToFileURL } from 'node:url'

import shell from 'shelljs'

export function publish(args = process.argv.slice(2), env = process.env) {
    if (env.VSCODE_WDIO_DRY_RUN === 'yes') {
        console.log('dryRun is `yes`. Skip the publish.')
        return
    }

    const argSuffix = args.length > 0 ? ` ${args.join(' ')}` : ''
    const vsceCommand = `vsce publish${argSuffix}`

    console.log(`Running: ${vsceCommand}`)
    const vsceResult = shell.exec(vsceCommand)
    if (vsceResult.code !== 0) {
        process.exit(vsceResult.code)
    }

    if (env.OVSX_PAT) {
        const ovsxCommand = `npx ovsx publish${argSuffix}`
        console.log(`Running: ${ovsxCommand}`)
        const ovsxResult = shell.exec(ovsxCommand)
        if (ovsxResult.code !== 0) {
            process.exit(ovsxResult.code)
        }
    }

    console.log('Successfully published.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    publish()
}
