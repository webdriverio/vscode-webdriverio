import {
    html,
    css,
    LitElement,
    property,
    CSSResult,
    customElement
} from 'lit-element';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { WDIO_DEFAULTS } from '../constants';
import type { DefinitionEntry, Option } from '../../types';
import { Options } from '@wdio/types';

// @ts-ignore
const vscode = acquireVsCodeApi<Options.Testrunner>();
const state = vscode.getState();

@customElement('wdio-config-webview')
export class WdioConfigWebView extends LitElement {
    @property({ type: Object, reflect: true })
    value: Record<string, any> = state || {};

    private get _config () {
        return state || this.value;
    }

    static get styles(): CSSResult {
        return css/*css*/`
        header {
            position: relative;
        }

        header vscode-button {
            position: absolute;
            right: 0;
            top: 0;
        }
        `;
    }

    render () {
        return html/*html*/`
        <header>
            <h1>WebdriverIO Configuration</h1>
            <vscode-button click=${this.openEditor}>View in Editor</vscode-button>
        </header>
        <hr />
        <vscode-form-container responsive>
            ${Object.entries(WDIO_DEFAULTS).map(([property, config]) => html/*html*/`
                <vscode-form-group variant="settings-group">
                    <vscode-label for=${property}>
                        ${config.name}:
                    </vscode-label>
                    <vscode-form-helper>
                        <p>${unsafeHTML(config.description)}</p>
                    </vscode-form-helper>
                    ${this.getInput(property, config)}
                </vscode-form-group>
            `)}
        </vscode-form-container>
        `;
    }

    getInput (property: string, config: DefinitionEntry) {
        if (config.type === 'string') {
            const configValue = this._config[property] || '';
            const input = document.createElement('vscode-inputbox');
            input.addEventListener('vsc-change', this.updateProperty.bind(this));
            input.setAttribute('name', property);
            input.setAttribute('placeholder', config.default || '');
            input.setAttribute('value', Array.isArray(configValue)
                ? configValue.join('\n')
                : configValue
            );
            if (config.multi) {
                input.setAttribute('multiline', '');
            }
            return html/*html*/`${input}`;
        }

        if (config.type === 'number') {
            return html/*html*/`
                <vscode-inputbox
                    name=${property}
                    placeholder=${config.default || ''}
                    value=${this._config[property] || ''}
                    type="number"
                    @vsc-change=${this.updateProperty} 
                ></vscode-inputbox>
            `;
        }

        if (config.type === 'suites') {
            return html/*html*/`
                <br />
                <wdio-suites
                    name=${property}
                    value="${JSON.stringify(this._config.suites || {})}"
                    @vsc-change=${this.updateProperty}
                />
            `;
        }

        if (config.type === 'plugin' && property === 'services') {
            return html/*html*/`
                <br />
                <wdio-plugin
                    name=${property}
                    value="${JSON.stringify(this._config.services)}"
                    @vsc-change=${this.updateProperty}
                    type=${property}
                ></wdio-plugin>
            `;
        }

        if (config.type === 'plugin' && property === 'reporters') {
            return html/*html*/`
                <br />
                <wdio-plugin
                    name=${property}
                    value="${JSON.stringify(this._config.reporters)}"
                    @vsc-change=${this.updateProperty}
                    type=${property}
                ></wdio-plugin>
            `;
        }

        if (config.type === 'option') {
            const isSingle = !config.multi;
            const options = config.options?.map((option) => {
                const val = this._config[property];
                const optionValue = typeof option === 'string'
                    ? option as string
                    : (option as Option).value || '';
                const optionLabel = typeof option === 'string'
                    ? option as string
                    : (option as Option).label;
                const input = document.createElement('vscode-option');
                input.setAttribute('value', optionValue);
                input.setAttribute('name', property);
                input.addEventListener('vsc-change', this.updateProperty.bind(this));
                input.innerHTML = optionLabel;
                const isSelected = isSingle
                    ? (
                        (typeof val === 'undefined' && config.default === option) ||
                        val === option
                    )
                    : (
                        (typeof val === 'undefined' && config.default === (option as Option).value) ||
                        (typeof val === 'string' && val === (option as Option).value) ||
                        (Array.isArray(val) && val.includes((option as Option).value))
                    );
                if (isSelected) {
                    input.setAttribute('selected', '');
                }
                
                return html/*html*/`${input}`;
            });

            if (isSingle) {
                return html/*html*/`
                    <vscode-single-select
                        @vsc-change=${this.updateProperty}
                        name=${property}
                    >
                        ${options}
                    </vscode-single-select>
                `;
            }

            return html/*html*/`
                <vscode-multi-select
                    @vsc-change=${this.updateProperty}
                    name=${property}
                >
                    ${options}
                </vscode-multi-select>
            `;
        }

        if (property === 'capabilities') {
            const val = this._config.capabilities || [];
            const caps = Array.isArray(val)
                // normal set of capabilities
                ? val.reduce((prev, curr) => {
                    let label = curr.browserName;
                    if (curr.platformName) {
                        label += `on ${curr.platformName}`;
                    }
                    prev[label] = curr;
                    return prev;
                }, {})
                // multiremote
                : val;
            const items = Object.entries(caps).map(([label, cap]) => html/*html*/`
                <vscode-collapsible title=${label} class="collapsible">
                    <div slot="body">
                        <p><code>${JSON.stringify(cap, null, 4)}</code></p>
                    </div>
                </vscode-collapsible>`);

            return html/*html*/`<br />${items}`;
        }

        console.error(`No input available for type ${config.type}`);
        return html``;
    }

    updateProperty (ev: Event) {
        const target = (ev.target as HTMLElement);
        const property = target.getAttribute('name') as string;
        let value = target.hasAttribute('multiline')
            ? ((ev as CustomEvent).detail as string).split('\n')
            : (ev as CustomEvent).detail;

        /**
         * modify result for dropdown where `ev.detail` is:
         * {selectedIndex: number, value: string}
         */
        if (typeof value === 'object' && typeof value.selectedIndex === 'number') {
            value = value.value;
        }

        /**
         * delete property if empty
         */
        if (!value || (Array.isArray(value) && value.filter(Boolean).length === 0)) {
            delete this._config[property];
        }

        this._config[property] = value;
        vscode.setState(this._config as any);
        vscode.postMessage({
            type: 'update',
            data: { property, value }
        });
    }

    openEditor () {
        vscode.postMessage({ type: 'viewInEditor' });
    }
}