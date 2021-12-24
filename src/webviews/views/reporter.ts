import {
    html,
    css,
    LitElement,
    CSSResult,
    customElement
} from 'lit-element';
import Channel from 'tangle/webviews';
import type { Client } from 'tangle';

import { acquireVsCodeApi } from '../components';

const vscode = acquireVsCodeApi();

@customElement('wdio-reporter-webview')
export class WdioReporterWebview extends LitElement {
    private _client: Client<any>;
    private _hasStarted = false;
    private _hasEnded = false;

    constructor() {
        super();

        const ch = new Channel('reporter-panel');
        this._client = ch.attach(vscode);
        this._client.on('start', () => {
            this._hasStarted = true;
            this.requestUpdate();
        });
        this._client.on('end', () => {
            this._hasEnded = true;
            this.requestUpdate();
        });
        this._client.on('onRunnerStart', (args: any) => this._onEvent('onRunnerStart', args));
        this._client.on('onRunnerEnd', (args: any) => this._onEvent('onRunnerEnd', args));
        this._client.on('onTestStart', (args: any) => this._onEvent('onTestStart', args));
        this._client.on('onTestEnd', (args: any) => this._onEvent('onTestEnd', args));
        this._client.on('onBeforeCommand', (args: any) => this._onEvent('onBeforeCommand', args));
        this._client.on('onAfterCommand', (args: any) => this._onEvent('onAfterCommand', args));
    }

    private _onEvent (name: string, args: any) {
        console.log(name, args);
    }

    static get styles(): CSSResult {
        return css/*css*/`
        div {
            color: blue;
        }
        `;
    }

    render () {
        const msg = this._hasEnded
            ? 'All done here!'
            : this._hasStarted
                ? 'Testrunner started'
                : 'No testrunner started.';
        return html/*html*/`
            <i>${msg}</i>
        `;
    }
}