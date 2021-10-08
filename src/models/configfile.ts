import pick from 'lodash.pick';
import pullAt from 'lodash.pullat';
import { createSlice, configureStore, Slice, EnhancedStore } from '@reduxjs/toolkit';
import type { Options } from '@wdio/types';

import {
    SUPPORTED_REPORTER, SUPPORTED_SERVICES, WDIO_DEFAULTS,
    AUTOMATION_PROTOCOL_OPTIONS, FRAMEWORK_OPTIONS, LOGLEVEL_OPTIONS
} from '../editor/constants';

export class ConfigFile {
    private _slice: Slice;
    private _store: EnhancedStore;

    constructor(config: Options.Testrunner) {
        const initialState = pick(config, Object.keys(WDIO_DEFAULTS));
        initialState.services = (initialState.services || []).filter(
            (s: any) => typeof s === 'string');
        initialState.reporters = (initialState.reporters || []).filter(
            (r: any) => typeof r === 'string');
        
        this._slice = createSlice({
            name: 'config',
            initialState,
            reducers: {
                update: (state, action) => {
                    const prop = action.payload.prop as keyof Options.Testrunner;
                    const val = action.payload.value;

                    if (
                        ['string', 'number'].includes(WDIO_DEFAULTS[prop]?.type!) ||
                        prop === 'specs'
                    ) {
                        state[prop] = val;
                    } else if (prop === 'automationProtocol' && val) {
                        state.automationProtocol = AUTOMATION_PROTOCOL_OPTIONS[val].value;
                    } else if (prop === 'framework') {
                        state.framework = FRAMEWORK_OPTIONS[val].value;
                    } else if (prop === 'logLevel') {
                        state.logLevel = LOGLEVEL_OPTIONS[val];
                    } else if (prop === 'reporters') {
                        state.automationProtocol = pullAt(SUPPORTED_REPORTER, val).map((r) => r.value);
                    } else if (prop === 'services') {
                        state.automationProtocol = pullAt(SUPPORTED_SERVICES, val).map((s) => s.value);
                    }
                    return state;
                }
            }
        });

        this._store = configureStore({
            reducer: this._slice.reducer
        });
        this._store.subscribe(this._updateFile.bind(this));
    }

    private _updateFile () {
        const config = this._store.getState();
        console.log('Update', config);
    }

    update (prop: keyof Options.Testrunner, value: any) {
        this._store.dispatch(
            this._slice.actions.update({ prop, value })
        );
    }

    get asObject (): Options.Testrunner {
        return this._store.getState();
    }
}