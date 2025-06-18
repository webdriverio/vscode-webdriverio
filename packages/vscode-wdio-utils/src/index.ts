import { EventEmitter } from 'node:events'

import type { ITypedEventEmitter } from '@vscode-wdio/types'

export * from './normalize.js'
export * from './watcher.js'
export * from './env.js'

export class TypedEventEmitter<Events extends Record<string | symbol, any>>
    extends EventEmitter
    implements ITypedEventEmitter<Events> {
    emit<K extends keyof Events>(event: K, data: Events[K]): boolean {
        return super.emit(event as string, data)
    }

    on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void | Promise<void>): this {
        return super.on(event as string, listener) as this
    }
}
