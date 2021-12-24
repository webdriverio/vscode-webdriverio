import {
    window,
    WebviewView,
    WebviewViewProvider,
    ExtensionContext,
    Disposable,
} from 'vscode';

import MainWebview from './main';
import { plugin } from '../constants';

export default class ReporterPanel extends MainWebview implements WebviewViewProvider {
    static viewId = 'reporter-panel';

    static register (context: ExtensionContext) {
        const view = new ReporterPanel(context);
        const disposables: Disposable[] = [
            window.registerWebviewViewProvider(`${plugin}.${ReporterPanel.viewId}`, view)
        ];

        return disposables;
    }

    async resolveWebviewView(webviewView: WebviewView): Promise<void> {
        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview, {
            title: 'WebdriverIO Reporter Editor',
            rootElem: 'wdio-reporter-webview'
        });
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };
        this.log.info('ReporterPanel webview resolved');
    }
}