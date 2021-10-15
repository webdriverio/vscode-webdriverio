import * as Elements from '@bendera/vscode-webview-elements';
import * as WdioElements from './components';
import * as WdioViews from './views';

/**
 * assign to var so rollup imports them
 * @todo(Christian): there must be a neater solution to this
 */
const a = { Elements, WdioElements, WdioViews };
