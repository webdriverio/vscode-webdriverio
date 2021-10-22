import { Options } from '@wdio/types';
import { Transform, JSCodeshift, Collection, Expression, ArrayExpression } from "jscodeshift";

import { WDIO_DEFAULTS } from '../editor/constants';
import { ServiceEntryStringExpression } from './constants';

const getObjectProperty = (j: JSCodeshift, property: string, val: any, currentProp?: Expression) => {
    console.log('Update', property, 'with', val);

    if (typeof val === 'string') {
        return j.stringLiteral(val);
    } 
    if (typeof val === 'number') {
        return j.literal(val);
    }
    if (['specs', 'exclude'].includes(property)) {
        return j.arrayExpression(val.map((v: string) => j.stringLiteral(v)));
    }
    if (property === 'suites') {
        return j.objectExpression(Object.entries(val as Record<string, string[]>).map(
            ([key, val]) => j.objectProperty(
                key ? j.identifier(key) : j.stringLiteral(''),
                j.arrayExpression(val.map((v) => j.stringLiteral(v)))
            ))
        );
    }
    if ((property === 'reporters' || property === 'services') && Array.isArray(val)) {
        const prop = (currentProp as ArrayExpression) || j.arrayExpression([]);
        prop.elements = val.map((v: string, i) => {
            /**
             * if currentProp is empty we are adding a new plugin
             * which can only be a string allowed by the webView
             */
            if (!currentProp || currentProp.type !== 'ArrayExpression') {
                return j.stringLiteral(v);
            }
            const foundElem = (currentProp as ArrayExpression).elements.find((elem, j) => (
                /**
                 * plugin is represented by a string
                 */
                (elem?.type ===  'StringLiteral' && v === elem.value) ||
                /**
                 * plugin is represented by a class
                 */
                (elem?.type === 'Identifier' && v === elem.name) ||
                /**
                 * plugin is an object, e.g. inline services: { onPrepare: ... }
                 * Given we can't represent whats in the object we check if the list
                 * index is the same.
                 */
                (elem?.type === 'ObjectExpression' && v === ServiceEntryStringExpression && i === j) ||
                /**
                 * plugin is [PluginEntry, PluginOptions]
                 */
                (
                    elem?.type === 'ArrayExpression' &&
                    (
                        elem.elements[0]?.type === 'StringLiteral' && v.startsWith(elem.elements[0].value) ||
                        elem.elements[0]?.type === 'Identifier' && v.startsWith(elem.elements[0].name)
                    )
                )
            ));

            /**
             * if element can't be found a new was added
             */
            if (!foundElem) {
                return j.stringLiteral(v);
            }

            return foundElem;
        });
        return prop;
    }

    console.warn(`Unknown value to transform: ${property}: ${val}`);
};

const getQuotationStyle = (j: JSCodeshift, root: Collection<any>): 'single' | 'double' => {
    let single = 0;
    let double = 0;
    root.find(j.StringLiteral).forEach(({ node }) => {
        // @ts-expect-error
        if (node.extra && typeof node.extra.raw === 'string' && node.extra.raw.startsWith("'")) {
            single++;
            return;
        }
        double++;
    });
    return single > double ? 'single' : 'double';
};

/**
 * The custom transform adhering to the jscodeshift API.
 */
const transform: Transform = (file, api, options) => {
    // Alias the jscodeshift API for ease of use.
    const j = api.jscodeshift;
  
    // Convert the entire file source into a collection of nodes paths.
    const root = j(file.source);
    const configNodes = root.find(j.ObjectExpression).filter(
        (nodePath) => nodePath.node.properties
            .filter((prop) => (
                prop.type === 'ObjectProperty' &&
                prop.key.type === 'Identifier' &&
                Object.keys(WDIO_DEFAULTS).includes(prop.key.name)
            ))
            .length > 0
    );
    
    if (configNodes.length === 0) {
        console.log('No config file found, skipping...');
        return null;
    }
    
    const configNode = configNodes.at(0);
    const missingProps = [];
    for (const [key, val] of Object.entries(options.config as Options.Testrunner)) {
        const nodes = configNode.find(j.ObjectProperty, { key: { name: key }});
        if (nodes.length > 0) {
            nodes.replaceWith(({ node }) => {
                const key = node.key.type === 'Identifier'
                    ? node.key.name 
                    : node.key.type === 'Literal'
                        ? node.key.value 
                        : null;
                
                if (!key) {
                    console.log(`Property with unknown key: ${node.key}`);
                    return node;
                }

                const newVal = getObjectProperty(j, key.toString(), val, node.value);
                if (!newVal) {
                    return node;
                }
                const object = { ...node, key: node.key, value: newVal };
                return j.objectProperty.from(object);
            });
            continue;
        }

        missingProps.push({ key, val });
    }

    for (const { key, val } of missingProps) {
        console.log('Adding new property to config', key);
        const prop = getObjectProperty(j, key, val);

        if (!prop) {
            continue;
        }

        configNode.nodes()[0].properties.push(j.objectProperty(
            j.identifier(key),
            prop
        ));
    }

    return root.toSource({
        quote: getQuotationStyle(j, root)
    });
};

export default transform;