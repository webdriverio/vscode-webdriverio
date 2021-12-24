import path from 'path';
import ipc from 'node-ipc';
import { Disposable, commands } from 'vscode';
import { Options } from '@wdio/types';
import type Launcher from '@wdio/cli';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { getWDIOPackage } from '../utils';
import type { SuiteItem, ConfigFileItem } from '../provider/configfile';

const serviceId = 'testrunner';
ipc.config.id = 'TestrunnerService';
ipc.config.retry = 1000;

export class Testrunner implements Disposable {
    private log = LoggerService.get();
    
    private constructor() {
        this.log.info('Testrunner created');
    }

    static register (): Disposable[] {
        const disposables: Disposable[] = [];
        const testrunner = new Testrunner();

        disposables.push(
            // commands
            commands.registerCommand(
                `${plugin}.${serviceId}.run`,
                testrunner.run.bind(testrunner)
            )
        );

        return disposables;
    }

    async run(srcTrigger: SuiteItem | ConfigFileItem) {
        ipc.connectTo('vscodeWebdriverIO');

        const args: Partial<Options.Testrunner> = {
            reporters: [`${__dirname}/plugins/reporter.js`]
        };

        if (srcTrigger.contextValue === 'wdioSuite') {
            args.specs = (srcTrigger as SuiteItem).specs;
        }

        const configFileItem = (srcTrigger as SuiteItem).parent || (srcTrigger as ConfigFileItem);
        const LauncherPackage = await getWDIOPackage(configFileItem.path);

        this.log.info(`Run config ${configFileItem.path} with args ${JSON.stringify(args)}`);
        process.chdir(path.dirname(configFileItem.path));

        console.log('START IT!!!');
        ipc.of.vscodeWebdriverIO.emit('start');
        const runner: Launcher = new LauncherPackage(configFileItem.path, args);
        await runner.run().then(
            () => this.log.info('Testrun successful'),
            (err: any) => {
                this.log.error(err);
                this.log.info(`Testrun failed`);
            }
        );
        ipc.of.vscodeWebdriverIO.emit('end');
    }

    dispose(): void {
    }
}