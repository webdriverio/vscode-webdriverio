import fs from 'fs';
import path from 'path';

import crypto from 'crypto';
import { render } from 'eta';
import { Disposable, ExtensionContext, Uri, Webview, window } from "vscode";

import { LoggerService } from '../services/logger';

const ROOT = path.join(__dirname, '..', '..');
const TPL_ROOT = path.join(ROOT, 'src', 'webviews', 'templates');
const TEMPLATE = fs.readFileSync(path.join(TPL_ROOT, 'main.tpl.html')).toString();

export default class MainWebview implements Disposable {
    protected disposables: Disposable[] = [];
    protected log: LoggerService = LoggerService.get();

    constructor(protected _context: ExtensionContext) {}

    protected _assetUri (webview: Webview, pathSegments: string[]) {
        return webview.asWebviewUri(
            Uri.joinPath(this._context.extensionUri, ...pathSegments)
        );
    }

    protected async _getHtmlForWebview(webview: Webview, opts: Record<string, any>) {
        const { cspSource } = webview;
        const nonce = crypto.randomBytes(16).toString('base64');
        const scripts = [{
            src: this._assetUri(webview, ['out', 'assets', 'webview.bundle.js']),
            defer: true
        }];
        const stylesheets = [{
            id: 'vscode-codicon-stylesheet',
            href: this._assetUri(webview, ['node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'])
        }];

        try {
            const html = await render(TEMPLATE, {
                scripts, stylesheets, nonce, cspSource,
                title: 'WebdriverIO Webview',
                ...opts
            });
            return html!;
        } catch (err: any) {
            window.showErrorMessage(`Couldn't open WebdriverIO configuration file: ${err.message}`);
            return '';
        }
    }
    
    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }
}