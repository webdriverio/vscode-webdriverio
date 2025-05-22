import 'expect-webdriverio'

declare global {
    namespace ExpectWebdriverIO {
        interface Matchers<R, T> {
            toBeWithinRange(floor: number, ceiling: number): R
            toMatchTreeStructure(expectedStructure: ExpectedTreeItem[]): R
        }
    }
}
