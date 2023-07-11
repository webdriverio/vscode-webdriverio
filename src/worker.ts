import serialize from 'serialize-javascript';
import workerpool from 'workerpool';
import { register } from 'ts-node';
import type { Options, Reporters, Services } from '@wdio/types';

import { ServiceEntryStringExpression } from './transforms/constants';

function getPluginType (plugin: Reporters.ReporterClass | Services.ServiceClass) {
    if (plugin.toString().startsWith('class')) {
        return plugin.name;
    }
    return 'Function';
}

function serializePlugin (plugin: Reporters.ReporterEntry | Services.ServiceEntry) {
    if (typeof plugin === 'string') {
        return plugin;
    } else if (typeof plugin === 'function') {
        return getPluginType(plugin);
    } else if (Array.isArray(plugin)) {
        if (typeof plugin[0] === 'string') {
            return `${plugin[0]}<{...args}>`;
        } else if (typeof plugin[0] === 'function') {
            return `${getPluginType(plugin[0])}<{...args}>`;
        }
    } else if (typeof plugin === 'object') {
        return ServiceEntryStringExpression;
    }

    return 'unknown';
}

async function loadConfig (modulePath: string) {
    /**
     * register TypeScript compiler if file is a TypeScript file
     */
    if (modulePath.endsWith('.ts')) {
        register({ transpileOnly: true });
    }

    /**
     * importing doesn't work anymore given that VS Code runs in a CJS environment
     */    
    const { config }: { config: Options.Testrunner } = await import(modulePath);
    config.reporters = config.reporters?.map(serializePlugin);
    config.services = config.services?.map(serializePlugin);
    return serialize(config, {
        ignoreFunction: true
    });
}

// create a worker and register public functions
workerpool.worker({ loadConfig });