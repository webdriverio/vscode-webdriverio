import { window, Disposable, commands } from 'vscode';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import type { SuiteItem, ConfigFileItem } from '../provider/configfile';
import { Options } from '@wdio/types';

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

    run(srcTrigger: SuiteItem | ConfigFileItem): void {
        const args: Partial<Options.Testrunner> = {};

        if (srcTrigger.contextValue === 'wdioSuite') {
            args.specs = (srcTrigger as SuiteItem).specs;
        }

        window.showInformationMessage(`Run config file ${srcTrigger.path} with args ${JSON.stringify(args)}`);
    }

    dispose(): void {
    }
}