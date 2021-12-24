import {
    window,
    WebviewView,
    WebviewViewProvider,
    ExtensionContext,
    Disposable,
} from 'vscode';
import ipc from 'node-ipc';
import Channel from 'tangle/webviews';
import type { Bus } from 'tangle';

import MainWebview from './main';
import { plugin } from '../constants';

ipc.config.id = 'vscodeWebdriverIO';
ipc.config.retry = 1500;
ipc.config.logger = () => {};

const PROPAGATED_EVENTS = [
    'start', 'onRunnerStart', 'onRunnerEnd', 'onTestStart',
    'onTestEnd', 'onBeforeCommand', 'onAfterCommand', 'end'
];

export default class ReporterPanel extends MainWebview implements WebviewViewProvider {
    static viewId = 'reporter-panel';

    private _client?: Bus<any>;
    private _channel = new Channel(ReporterPanel.viewId);

    static register (context: ExtensionContext) {
        const view = new ReporterPanel(context);
        const disposables: Disposable[] = [
            window.registerWebviewViewProvider(`${plugin}.${ReporterPanel.viewId}`, view)
        ];

        return disposables;
    }

    async resolveWebviewView(webviewView: WebviewView): Promise<void> {
        this._client = await this._channel.registerPromise([webviewView.webview]);
        webviewView.webview.html = await this._getHtmlForWebview(webviewView.webview, {
            title: 'WebdriverIO Reporter Editor',
            rootElem: 'wdio-reporter-webview'
        });
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._context.extensionUri],
        };

        ipc.serve(this._onConnect.bind(this));
        ipc.server.start();

        this.log.info('ReporterPanel webview resolved');
    }

    private _onConnect () {
        this.log.info('Register IPC events');
        for (const ev of PROPAGATED_EVENTS) {
            ipc.server.on(ev, (args: any) => {
                console.log('EMIT', ev);
                this._client?.emit(ev, args || {});
            });
        }
    }
}