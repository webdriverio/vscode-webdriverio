import { Options } from '@wdio/types';
import { Transform, JSCodeshift, ObjectProperty } from "jscodeshift";

import { WDIO_DEFAULTS } from '../editor/constants';

const getObjectProperty = (j: JSCodeshift, property: string, val: any) => {
    console.log('Update', property, 'with', val);

    let newVal;
    if (typeof val === 'string') {
        newVal = j.stringLiteral(val);
    } else if (typeof val === 'number') {
        newVal = j.literal(val);
    } else if (['specs', 'exclude'].includes(property)) {
        newVal = j.arrayExpression(val.map((v: string) => j.stringLiteral(v)));
    } else if (property === 'suites') {
        newVal = j.objectExpression(Object.entries(val as Record<string, string[]>).map(
            ([key, val]) => j.objectProperty(
                key ? j.identifier(key) : j.stringLiteral(''),
                j.arrayExpression(val.map((v) => j.stringLiteral(v)))
            ))
        );
    }

    return newVal;
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
            nodes.replaceWith((node) => {
                if (node.node.key.type !== 'Identifier') {
                    return node;
                }

                const newVal = getObjectProperty(j, node.node.key.name as any as string, val);
                if (!newVal) {
                    console.log(`No replacement available for ${key}`);
                    return node.node;
                }
                const object = { ...node.node, key: node.node.key, value: newVal };
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

    return root.toSource();
};

export default transform;