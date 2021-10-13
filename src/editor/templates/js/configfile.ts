import type { LitElement } from 'lit-element';
import type { VscodeInputbox, VscodeMultiSelect, VscodeSingleSelect } from '@bendera/vscode-webview-elements';
import type { VscChangeEvent, IndexedValue } from '../../../types';
import { Options } from '@wdio/types';

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

    return { property, value };
};

const setInputValue = (elem: LitElement, value: any) => {
    const singleSelect = elem as VscodeSingleSelect;
    const multiSelect = elem as VscodeMultiSelect;
    const inputBox = elem as VscodeInputbox;
    
    if (typeof singleSelect.selectedIndex !== 'undefined') {
        singleSelect.selectedIndex = value;
    } else if (typeof multiSelect.selectedIndexes !== 'undefined') {
        multiSelect.selectedIndexes = value;
    } else if (elem.hasAttribute('multiline') && Array.isArray(value)) {
        inputBox.value = value.join('\n');
    } else if (typeof value.index === 'number') {
        elem.setAttribute('data-index', value.index);
        inputBox.value = value.value;
    } else {
        inputBox.value = value;
    }
};

/**
 * Input listener to propagate changed data outside
 * @param {VscChangeEvent} event 
 */
const onChangeListener = (event: VscChangeEvent) => {
    const state: Options.Testrunner = vscode.getState();
    const { property, value } = getInputValue(event.srcElement);
    let newProperty = property;
    let newValue: any = value;

    // @ts-ignore
    state[newProperty as any] = newValue;
    console.log('Update property', newProperty, 'to', newValue);
    vscode.setState(state);
    vscode.postMessage({
        type: 'update',
        data: { property: newProperty, value: newValue }
    });
};

const registerListener = (formFields: (VscodeInputbox | VscodeMultiSelect | VscodeSingleSelect)[]) => {
    for (const input of formFields) {
        const name = input.getAttribute('name');
    
        if (!name) {
            console.error(`Couldn't initiate input ${input}`);
            continue;
        }
    
        initialJson[name] = getInputValue(input).value;
        input.addEventListener('vsc-change', onChangeListener as any);
    }
};

const reininitiateState = () => {
    const state = vscode.getState();
    for (const [key, val] of Object.entries(state)) {
        const formElem = document.querySelector(`*[name="${key}"]`) as LitElement;
        if (!formElem) {
            console.error(`Couldn't find elem with selector "*[name="${key}"]"`);
            continue;
        }
        setInputValue(formElem, val);
    }
};

registerListener(formFields);
const state = vscode.getState();
if (!state) {
    vscode.setState(initialJson);
} else {
    reininitiateState();
}
