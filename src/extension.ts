import { ExtensionContext } from 'vscode';
import { ExtensionManager } from './manager';

let manager: ExtensionManager;

export function activate(ctx: ExtensionContext) {
	manager = new ExtensionManager(ctx);
	manager.activate();
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (!manager) {
		return;
	}
	return manager.deactivate();
}
