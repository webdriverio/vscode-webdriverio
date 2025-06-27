import shell from 'shelljs'

import pkg from '../../samples/e2e/mocha/package.json' with { type: 'json' }

const targetPkg = '@vscode-wdio/e2e-mocha'
const targetWdioVersion = '9.15.0'

const wdioPkgs = Object.keys(pkg.devDependencies).filter((pkg) => pkg.startsWith('@wdio/'))

const targetWdioPkgs = wdioPkgs.map((pkg) => `${pkg}@${targetWdioVersion}`)

const cmd = `pnpm --filter ${targetPkg} install -D ${targetWdioPkgs.join(' ')}`

console.log(`\n>${cmd}\n`)

shell.exec(cmd)
