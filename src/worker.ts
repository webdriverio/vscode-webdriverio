import serialize from 'serialize-javascript';
import workerpool from 'workerpool';
import { register } from 'ts-node';
import type { Options } from '@wdio/types';

async function loadConfig (modulePath: string) {
    /**
     * register TypeScript compiler if file is a TypeScript file
     */
    if (modulePath.endsWith('.ts')) {
        register({ transpileOnly: true });
    }

    const { config }: { config: Options.Testrunner } = await import(modulePath);
    return serialize(config);
}

// create a worker and register public functions
workerpool.worker({ loadConfig });