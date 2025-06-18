import * as dotenv from 'dotenv'
import type { EnvOptions, WorkerMetaContext } from '@vscode-wdio/types'

export interface Hook {
    before(): void | Promise<void>
    after(): void | Promise<void>
}

export class EnvHook implements Hook {
    private parsed: NodeJS.ProcessEnv | undefined
    private orgEnv: NodeJS.ProcessEnv
    constructor(
        private context: WorkerMetaContext,
        private env: EnvOptions
    ) {
        this.orgEnv = structuredClone(process.env)
    }

    before(): void | Promise<void> {
        if (this.env.paths.length > 0) {
            this.context.log.debug(`Load env files with override=${this.env.override}: ${this.env.paths.join(', ')}`)
            const result = dotenv.config({ path: this.env.paths, override: this.env.override })
            this.parsed = result.parsed
            if (result.error) {
                this.context.log.error(`Failed to load env: ${JSON.stringify(this.env.paths, null, 2)}`)
            } else {
                this.context.log.debug(`Successfully loaded env: ${JSON.stringify(this.parsed, null, 2)}`)
            }
        }
    }
    after(): void | Promise<void> {
        if (this.parsed) {
            for (const key in this.parsed) {
                if (!(key in this.orgEnv)) {
                    this.context.log.debug(`Remove env: ${key}: ${this.parsed[key]}`)
                    delete process.env[key]
                } else if (this.orgEnv[key] !== this.parsed[key]) {
                    this.context.log.debug(`Restore env: ${key}: ${process.env[key]} -> ${this.orgEnv[key]}`)
                    process.env[key] = this.orgEnv[key]
                }
            }
        }
    }
}
