import workerpool from 'workerpool';
import pick from 'lodash.pick';
import { EventEmitter } from 'events';
import { createSlice, configureStore, Slice, EnhancedStore } from '@reduxjs/toolkit';
import type { Options } from '@wdio/types';

import { LoggerService } from '../services/logger';
import { WDIO_DEFAULTS } from '../editor/constants';

export class ConfigFile extends EventEmitter {
    private _slice: Slice;
    private _store: EnhancedStore;

    public log = LoggerService.get();

    constructor(config: Options.Testrunner) {
        super();
        const initialState = pick(config, Object.keys(WDIO_DEFAULTS));
        initialState.services = (initialState.services || []).filter(
            (s: any) => typeof s === 'string');
        initialState.reporters = (initialState.reporters || []).filter(
            (r: any) => typeof r === 'string');
        
        this._slice = createSlice({
            name: 'config',
            initialState,
            reducers: {
                update: (...args) => this._update(...args)
            }
        });

        this._store = configureStore({ reducer: this._slice.reducer });
        this._store.subscribe(this._onUpdate.bind(this));
    }

    static async load (modulePath: string) {
        const pool = workerpool.pool(__dirname + '/../worker.js');
        const content = await pool.exec('loadConfig', [modulePath]) as string;
        const config = eval('(' + content + ')');
        return new ConfigFile(config);
    }

    private _update (state: Partial<Options.Testrunner>, action: { payload: { property: string, value: any }, type: string }) {
        this.log.info('Update model state', action);

        /**
         * delete if
         */
        if (
            /**
             * value is empty string
             */
            (typeof action.payload.value === 'string' && action.payload.value.length === 0) ||
            /**
             * or value is the default value
             */
            (action.payload.value === WDIO_DEFAULTS[action.payload.property as keyof typeof WDIO_DEFAULTS]?.default)
        ) {
            // @ts-ignore
            delete state[action.payload.property];
            return state;
        }

        // @ts-ignore
        state[action.payload.property] = action.payload.value;
        return state;
    }

    private _onUpdate () {
        const config = this._store.getState();
        this.emit('update', config);
    }

    update (property: keyof Options.Testrunner, value: any) {
        this._store.dispatch(
            this._slice.actions.update({ property, value })
        );
    }

    get asObject (): Options.Testrunner {
        return this._store.getState();
    }
}