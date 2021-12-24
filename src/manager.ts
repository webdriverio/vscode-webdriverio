import { ExtensionContext, Disposable, commands } from "vscode";

import { showOutput } from './commands/show-output';
import { LoggerService } from './services/logger';
import { Testrunner } from './services/testrunner';
import { ConfigFileProvider } from './provider/configfile';
import { ReporterProvider } from './provider/reporter';
import { ConfigfileEditorProvider } from './webviews/configfile';

export class ExtensionManager implements Disposable {
    private _disposables: Disposable[] = [];
    private _log: LoggerService;

    constructor (
        private _ctx: ExtensionContext
    ) {
        this._ctx.subscriptions.push(this);
        this._log = LoggerService.get(this._ctx);
    }

    activate(): void {
        this._disposables.push(
            this._log,
            // general plugin commands
            commands.registerCommand(showOutput.command, () => showOutput()),
            // views
            ...ConfigFileProvider.register(),
            ...ReporterProvider.register(),
            // services
            ...Testrunner.register(),
            // editors
            ...ConfigfileEditorProvider.register(this._ctx),
        );
        this._log.info('Activated %s from %s', this._ctx.extension.id, this._ctx.extensionPath);
    }

    /**
     * Deactivate the controller
     */
    deactivate(): void {
        this.dispose();
        console.log('[ExtensionController] extension deactivated');
    }

    dispose () {
        this._disposables.forEach((disposable) => disposable.dispose());
        console.log(`[ExtensionController] ${this._disposables.length} items disposed`);
    }
}