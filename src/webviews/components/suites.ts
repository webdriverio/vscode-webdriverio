import { Options } from '@wdio/types';
import {
    html,
    css,
    CSSResult,
    LitElement,
    property,
    customElement
} from 'lit-element';
import { ComponentEvent } from '../../types';

@customElement('wdio-suites')
export class WdioSuites extends LitElement {
    @property({ type: Object, reflect: true })
    value: Required<Options.Testrunner>['suites'] = {};

    static get styles(): CSSResult {
        return css/*css*/`
        vscode-table vscode-table-body vscode-table-cell {
            vertical-align: top;
            padding: 10px;
        }

        :host > vscode-button {
            margin-top: 10px;
        }
        `;
    }

    render() {
        const suites = Object.keys(this.value);
        if (suites.length === 0) {
            return this.addSuiteBtn;
        }

        /**
         * 35px = table header
         * 65px = suite row
         */
        const tableHeight = (suites.length * 65) + 35;
        return html/* html */`
        <vscode-table
            class="suitesTable"
            zebra
            style="height: ${tableHeight}px"
            columns='["auto", "auto", "100px"]'
        >
            <vscode-table-header slot="header">
                <vscode-table-header-cell>Suite Name</vscode-table-header-cell>
                <vscode-table-header-cell>Specs</vscode-table-header-cell>
                <vscode-table-header-cell></vscode-table-header-cell>
            </vscode-table-header>
            <vscode-table-body slot="body">
                ${Object.entries(this.value).map(([suiteName, specs], i) => html/*html*/`
                <vscode-table-row>
                    <vscode-table-cell>
                        <vscode-inputbox
                            value=${suiteName}
                            data-index=${i}
                            @vsc-change=${this.onNameChange}
                        ></vscode-inputbox>
                    </vscode-table-cell>
                    <vscode-table-cell>
                        <vscode-inputbox
                            value=${specs.join('\n')}
                            multiline
                            data-suite=${suiteName}
                            @vsc-change=${this.onSpecChange}
                        ></vscode-inputbox><br />
                    </vscode-table-cell>
                    <vscode-table-cell>
                        <vscode-button
                            @click="${this.deleteSuite}"
                            data-suiteName=${suiteName}
                        >
                            Remove
                        </vscode-button>
                    </vscode-table-cell>
                </vscode-table-row>
                `)}
            </vscode-table-body>
        </vscode-table>
        ${this.addSuiteBtn}
        `;
    }

    onNameChange (ev: ComponentEvent) {
        ev.stopPropagation();

        const oldVal = this.suiteCopy;
        const input = ev.path[0] as HTMLElement;
        const index = parseInt(input.getAttribute('data-index') as string, 10);
        const value = ev.detail as string;
        
        const oldSuiteName = Object.keys(this.value)[index];
        this.value[value] = this.value[oldSuiteName];
        delete this.value[oldSuiteName];
        this.requestUpdate('value', oldVal);
        this.dispatchUpdate();
    }

    onSpecChange (ev: ComponentEvent) {
        ev.stopPropagation();

        const oldVal = this.suiteCopy;
        const input = ev.path[0] as HTMLElement;
        const suiteName = input.getAttribute('data-suite') as string;
        this.value[suiteName] = ev.detail.split('\n');
        this.requestUpdate('value', oldVal);
        this.dispatchUpdate();
    }

    addNewSuite () {
        let oldVal = this.suiteCopy;
        this.value[''] = [];
        this.requestUpdate('value', oldVal);
        this.dispatchUpdate();
    }

    deleteSuite (ev: ComponentEvent) {
        ev.stopPropagation();
        let oldVal = this.suiteCopy;
        const btn = ev.path.find((el) => (
            (el as HTMLElement).tagName &&
            (el as HTMLElement).tagName.toLowerCase() === 'vscode-button'
        )) as HTMLElement;
        const suiteToDelete = btn.getAttribute('data-suiteName') as string;
        delete this.value[suiteToDelete];
        this.requestUpdate('value', oldVal);
        this.dispatchUpdate();
    }

    dispatchUpdate () {
        this.dispatchEvent(
            new CustomEvent('vsc-change', { detail: this.value })
        );
    }

    get suiteCopy () {
        return JSON.parse(JSON.stringify(this.value));
    }

    get addSuiteBtn () {
        return html/*html*/`
            <vscode-button @click="${this.addNewSuite}">New Suite</vscode-button>
        `;
    }
}