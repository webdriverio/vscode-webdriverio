import { Disposable, ExtensionContext, workspace, window, commands } from 'vscode';

import { showOutput } from './commands/show-output';
import { LoggerService } from './services/logger';
import { Testrunner } from './services/testrunner';
import { ConfigFileProvider } from './provider/config-file';
import { ConfigfileEditorProvider } from './editor/configfile';
import { NodeDependenciesProvider } from './TreeDataProvider';

const disposables: Disposable[] = [];
let log: LoggerService;

export function activate(ctx: ExtensionContext) {
	log = LoggerService.get(ctx);
	log.info('Activated %s from %s', ctx.extension.id, ctx.extensionPath);

	disposables.push(
		log,
		// general plugin commands
		commands.registerCommand(showOutput.command, () => showOutput()),
		// views
		...ConfigFileProvider.register(),
		// services
		...Testrunner.register(),
		// editors
		...ConfigfileEditorProvider.register(ctx),
	);

	const nodeDependenciesProvider = new NodeDependenciesProvider(workspace.workspaceFolders![0].uri.path);
	window.registerTreeDataProvider('webdriverio-config-treeview', nodeDependenciesProvider);
	window.createTreeView('webdriverio-config-treeview', {
		treeDataProvider: nodeDependenciesProvider
	});
	commands.registerCommand('webdriverio.refreshEntry', () => nodeDependenciesProvider.refresh());

	ctx.subscriptions.push(...disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {
	log.info('Disposing Appium extension. Bye!');
  	disposables.forEach((disposable) => disposable.dispose());
}
