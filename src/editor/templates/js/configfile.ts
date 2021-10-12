import type { LitElement } from 'lit-element';
import type { VscodeInputbox, VscodeMultiSelect, VscodeSingleSelect } from '@bendera/vscode-webview-elements';
import type { VscChangeEvent, IndexedValue } from '../../../types';

// @ts-expect-error
const vscode = acquireVsCodeApi();
const initialJson: Record<string, any> = {};

/**
 * capture all form fields
 */
const formFields = [
    ...document.getElementsByTagName('vscode-inputbox'),
    ...document.getElementsByTagName('vscode-multi-select'),
    ...document.getElementsByTagName('vscode-single-select')
];

/**
 * "View in Editor" command listener
 */
const viewInEditorBtn: HTMLElement | null = document.getElementById('btnEditor');
if (viewInEditorBtn) {
    viewInEditorBtn.onclick = () => vscode.postMessage({ type: 'viewInEditor' });
}

/**
 * "New Site" command listener
 */
const newSuiteBtn: HTMLElement | null = document.getElementById('newSuite');
const suiteTableBody: HTMLElement | null = document.querySelector('.suitesTable > vscode-table-body');
if (newSuiteBtn) {
    const existingSuites = document.querySelectorAll('*[name^="suiteName"]').length;
    newSuiteBtn.onclick = () => {
        vscode.postMessage({
            type: 'update',
            data: { property: `suiteName[${existingSuites}]`, value: [] }
        });
        window.location.reload();
    };
}

const getInputValue = (elem: LitElement) => {
    const property = elem.getAttribute('name');

    if (!property) {
        throw new Error(`Element ${elem} has no name and can't be identified`);
    }

    const singleSelect = elem as VscodeSingleSelect;
    const multiSelect = elem as VscodeMultiSelect;
    const inputBox = elem as VscodeInputbox;

    let value: string | string[] | number | number[] | IndexedValue | undefined;
    if (typeof singleSelect.selectedIndex !== 'undefined') {
        value = singleSelect.selectedIndex;
    } else if (typeof multiSelect.selectedIndexes !== 'undefined') {
        value = multiSelect.selectedIndexes;
    } else if (elem.getAttribute('type') === 'number') {
        value = parseInt(inputBox.value, 10);
        if (isNaN(value)) {
            value = undefined;
        }
    } else if (elem.hasAttribute('data-index')) {
        const val = inputBox.value;
        value = {
            index: parseInt(elem.getAttribute('data-index') || ''),
            value: val.includes('\n') ? val.split('\n') : (val || '')
        } as IndexedValue;
    } else if (elem.hasAttribute('multiline')) {
        value = inputBox.value.split('\n').filter((l) => l.length > 0);
    } else if (typeof inputBox.value !== 'undefined') {
        value = inputBox.value;
    }

    if (value === null) {
        throw new Error(`Couldn't get value for element ${elem}`);
    }

    console.log('YOO', elem, property, value);
    return { property, value };
};

const setInputValue = (elem: LitElement, value: any) => {
    console.log(`Set value`, elem, value);
    const singleSelect = elem as VscodeSingleSelect;
    const multiSelect = elem as VscodeMultiSelect;
    const inputBox = elem as VscodeInputbox;
    
    if (typeof singleSelect.selectedIndex !== 'undefined') {
        singleSelect.selectedIndex = value;
    } else if (typeof multiSelect.selectedIndexes !== 'undefined') {
        multiSelect.selectedIndexes = value;
    } else if (elem.hasAttribute('multiline')) {
        inputBox.value = value.join('\n');
    } else if (typeof value.index === 'number') {
        const val = Array.isArray(value) ? value.join('\n') : value;
        elem.setAttribute('data-index', value.index);
        inputBox.value = val;
    } else {
        inputBox.value = value;
    }
};

/**
 * Input listener to propagate changed data outside
 * @param {VscChangeEvent} event 
 */
const onChangeListener = (event: VscChangeEvent) => {
    const { property, value } = getInputValue(event.srcElement);
    initialJson[property] = value;

    console.log('Update state', initialJson);
    vscode.setState({ json: initialJson });
    vscode.postMessage({
        type: 'update',
        data: { property, value }
    });
};

for (const input of formFields) {
    const name = input.getAttribute('name');

    if (!name) {
        console.error(`Couldn't initiate input ${input}`);
        continue;
    }

    initialJson[name] = getInputValue(input).value;
    input.addEventListener('vsc-change', onChangeListener as any);
}

const state = vscode.getState();
if (!state) {
    console.log(`Initiate state`, initialJson);
    vscode.setState({ json: initialJson });
} else {
    console.log(`Reinstantiate state`, state.json);
    for (const [key, val] of Object.entries(state.json)) {
        const formElem = document.querySelector(`*[name="${key}"]`) as LitElement;
        if (!formElem) {
            console.error(`Couldn't find elem with selector "*[name="${key}"]"`);
            continue;
        }

        setInputValue(formElem, val);
    }
}
