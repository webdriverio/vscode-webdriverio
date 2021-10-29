import path from 'path';
import { Disposable, commands } from 'vscode';
import { Options } from '@wdio/types';
import type Launcher from '@wdio/cli';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { getWDIOPackage } from '../utils';
import type { SuiteItem, ConfigFileItem } from '../provider/configfile';

const serviceId = 'testrunner';

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
        const args: Partial<Options.Testrunner> = {};

        if (srcTrigger.contextValue === 'wdioSuite') {
            args.specs = (srcTrigger as SuiteItem).specs;
        }

        const configFileItem = (srcTrigger as SuiteItem).parent || (srcTrigger as ConfigFileItem);
        const LauncherPackage = await getWDIOPackage(configFileItem.path);

        this.log.info(`Run config ${configFileItem.path} with args ${JSON.stringify(args)}`);
        process.chdir(path.dirname(configFileItem.path));
        const runner: Launcher = new LauncherPackage(configFileItem.path, args);
        return runner.run().then(
            () => this.log.info('Testrun successful'),
            (err: any) => {
                this.log.error(err);
                this.log.info(`Testrun failed`);
            }
        );
    }

    dispose(): void {
    }
}