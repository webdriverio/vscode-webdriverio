import { window, Disposable, commands } from 'vscode';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';

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

    run(): void {
        window.showInformationMessage('Run config file');
    }

    dispose(): void {
    }
}