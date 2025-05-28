import 'expect-webdriverio'

declare global {
    namespace ExpectWebdriverIO {
        interface Matchers<R, T> {
            toMatchTreeStructure(expectedStructure: ExpectedTreeItem[]): R
        }
    }
}
