import { normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

export function normalizePath(p: string) {
    const _specPath = p.startsWith('file://') ? fileURLToPath(p) : p
    return normalize(_specPath)
}
