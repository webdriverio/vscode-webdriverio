import { Options } from '@wdio/types';
import { Transform } from "jscodeshift";

import { WDIO_DEFAULTS } from '../editor/constants';

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
    for (const [key, val] of Object.entries(options.config as Options.Testrunner)) {
        configNode.find(j.ObjectProperty, { key: { name: key }}).replaceWith((node) => {
            let newVal = node.node.value;

            if (typeof val === 'string') {
                newVal = j.stringLiteral(val);
            } else if (typeof val === 'number') {
                newVal = j.literal(val);
            }

            return j.objectProperty(node.node.key, newVal);
        });
    }

    return root.toSource();
};

export default transform;