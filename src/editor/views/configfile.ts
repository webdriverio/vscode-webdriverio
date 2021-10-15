import { Options } from '@wdio/types';
import {
    html,
    css,
    LitElement,
    property,
    CSSResult,
    customElement
} from 'lit-element';
import { WDIO_DEFAULTS } from '../constants';
import type { DefinitionEntry, Option } from '../../types';

// @ts-ignore
const vscode = acquireVsCodeApi();

@customElement('wdio-config-webview')
export class WdioConfigWebView extends LitElement {
    @property({ type: Object, reflect: true })
    value: Record<string, any> = {};

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
                        <p>${html`${config.description}`}</p>
                    </vscode-form-helper>
                    ${this.getInput(property, config)}
                </vscode-form-group>
            `)}
            <vscode-form-group>
                <vscode-button>Save</vscode-button>
                <vscode-button secondary>Cancel</vscode-button>
            </vscode-form-group>
        </vscode-form-container>
        `;
    }

    getInput (property: string, config: DefinitionEntry) {
        console.log(config);
        
        if (config.type === 'string') {
            const configValue = this.value[property] || '';
            const input = document.createElement('vscode-inputbox');
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
                    value=${this.value[property] || ''}
                    type="number"
                ></vscode-inputbox>
            `;
        }

        if (config.type === 'suites') {
            return html/*html*/`
                <br />
                <wdio-suites value="${JSON.stringify(this.value.suites || {})}" />
            `;
        }

        if (config.type === 'plugin' && property === 'services') {
            return html/*html*/`
                <br />
                <wdio-plugin
                    value="${JSON.stringify(this.value.services)}"
                    type=${property}
                ></wdio-plugin>
            `;
        }

        if (config.type === 'plugin' && property === 'reporters') {
            return html/*html*/`
                <br />
                <wdio-plugin
                    value="${JSON.stringify(this.value.reporters)}"
                    type=${property}
                ></wdio-plugin>
            `;
        }

        if (config.type === 'option') {
            const isSingle = !config.multi;
            const options = config.options?.map((option) => {
                const val = this.value[property];
                const optionValue = typeof option === 'string'
                    ? option as string
                    : (option as Option).value || '';
                const optionLabel = typeof option === 'string'
                    ? option as string
                    : (option as Option).label;
                const input = document.createElement('vscode-option');
                input.setAttribute('value', optionValue);
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
                    <vscode-single-select name=${property}>${options}</vscode-single-select>
                `;
            }

            return html/*html*/`
                <vscode-multi-select name=${property}>${options}</vscode-multi-select>
            `;
        }

        if (property === 'capabilities') {
            const val = this.value.capabilities || [];
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

    openEditor () {
        vscode.postMessage({ type: 'viewInEditor' });
    }
}