import * as vscode from 'vscode'

/**
 * WebDriverIOのテストファイルからテストケースを抽出する関数
 * @param fileContent テストファイルの内容
 * @param document VSCodeのTextDocumentオブジェクト（位置情報の変換に使用）
 * @returns テストケース情報の配列
 */
export function parseTestCases(fileContent: string, document: vscode.TextDocument): TestCaseInfo[] {
    const testCases: TestCaseInfo[] = []

    // 行コメントと複数行コメントを無視するため、一時的に取り除く
    const contentWithoutComments = removeComments(fileContent)

    // describeブロックを検出する
    const describeBlocks = findDescribeBlocks(contentWithoutComments, document)

    // 各describeブロック内のitブロックを検出
    for (const describeBlock of describeBlocks) {
        const describeContent = contentWithoutComments.substring(
            document.offsetAt(describeBlock.range.start),
            document.offsetAt(
                findBlockEnd(contentWithoutComments, document, document.offsetAt(describeBlock.range.start))
            )
        )

        const itBlocks = findItBlocks(describeContent, document, document.offsetAt(describeBlock.range.start))

        // describeブロックをテストケースとして追加
        testCases.push({
            type: 'describe',
            name: describeBlock.name,
            range: describeBlock.range,
            children: itBlocks.map((it) => ({
                type: 'it',
                name: it.name,
                range: it.range,
                children: [],
            })),
        })
    }

    // トップレベルのitブロックを検出
    const topLevelItBlocks = findItBlocks(contentWithoutComments, document, 0)

    // すでに検出されたdescribeブロック内のitブロックと重複していないかチェック
    const itBlocksInDescribes = testCases
        .filter((tc) => tc.type === 'describe')
        .flatMap((describe) => describe.children.map((it) => it.range.start.line))

    // 重複していないトップレベルのitブロックをテストケースとして追加
    for (const itBlock of topLevelItBlocks) {
        if (!itBlocksInDescribes.includes(itBlock.range.start.line)) {
            testCases.push({
                type: 'it',
                name: itBlock.name,
                range: itBlock.range,
                children: [],
            })
        }
    }

    return testCases
}

/**
 * コメントを除去する関数
 * @param content ソースコード
 * @returns コメントが除去されたソースコード
 */
function removeComments(content: string): string {
    // 行コメントを除去
    let result = content.replace(/\/\/.*$/gm, '')

    // 複数行コメントを除去
    result = result.replace(/\/\*[\s\S]*?\*\//gm, '')

    return result
}

/**
 * describeブロックを検出する関数
 * @param content ソースコード
 * @param document VSCodeのTextDocumentオブジェクト
 * @returns describeブロック情報の配列
 */
function findDescribeBlocks(
    content: string,
    document: vscode.TextDocument
): Array<{ name: string; range: vscode.Range }> {
    const describeBlocks: Array<{ name: string; range: vscode.Range }> = []

    // describeブロックのパターン（アロー関数や通常の関数宣言も考慮）
    // 引数は文字列リテラル（シングルクォート、ダブルクォート、バッククォート）のいずれか
    const describeRegex =
        /\bdescribe\s*\(\s*(['"`])((?:(?!\1).|\\.)*)\1\s*,\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)\s*=>))/g

    let match
    while ((match = describeRegex.exec(content)) !== null) {
        const describeName = match[2]
        const startPos = document.positionAt(match.index)
        const endPos = document.positionAt(match.index + match[0].length)

        describeBlocks.push({
            name: describeName,
            range: new vscode.Range(startPos, endPos),
        })
    }

    return describeBlocks
}

/**
 * itブロックを検出する関数
 * @param content ソースコード
 * @param document VSCodeのTextDocumentオブジェクト
 * @param startOffset 検索開始位置のオフセット
 * @returns itブロック情報の配列
 */
function findItBlocks(
    content: string,
    document: vscode.TextDocument,
    startOffset: number = 0
): Array<{ name: string; range: vscode.Range }> {
    const itBlocks: Array<{ name: string; range: vscode.Range }> = []

    // itブロックのパターン（アロー関数や通常の関数宣言も考慮）
    // 引数は文字列リテラル（シングルクォート、ダブルクォート、バッククォート）のいずれか
    const itRegex = /\bit\s*\(\s*(['"`])((?:(?!\1).|\\.)*)\1\s*,\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)\s*=>))/g

    let match
    while ((match = itRegex.exec(content)) !== null) {
        const itName = match[2]
        const startPos = document.positionAt(startOffset + match.index)
        const endPos = document.positionAt(startOffset + match.index + match[0].length)

        itBlocks.push({
            name: itName,
            range: new vscode.Range(startPos, endPos),
        })
    }

    return itBlocks
}

/**
 * ブロックの終了位置を見つける関数
 * @param content ソースコード
 * @param startOffset ブロック開始位置のオフセット
 * @returns ブロック終了位置のオフセット
 */
function findBlockEnd(content: string, document: vscode.TextDocument, startOffset: number): vscode.Position {
    let braceCount = 0
    let inString = false
    let stringChar = ''
    let escaped = false

    // 開始括弧を見つける
    for (let i = startOffset; i < content.length; i++) {
        const char = content[i]

        if (!inString && char === '{') {
            braceCount++
            break
        }

        // 文字列リテラル内の場合は括弧を無視
        if ((char === "'" || char === '"' || char === '`') && !escaped) {
            if (!inString) {
                inString = true
                stringChar = char
            } else if (stringChar === char) {
                inString = false
            }
        }

        escaped = char === '\\' && !escaped
    }

    // 対応する閉じ括弧を見つける
    for (let i = startOffset; i < content.length; i++) {
        const char = content[i]

        if (!inString) {
            if (char === '{') {
                braceCount++
            } else if (char === '}') {
                braceCount--
                if (braceCount === 0) {
                    return document.positionAt(i + 1)
                }
            }
        }

        // 文字列リテラル内の場合は括弧を無視
        if ((char === "'" || char === '"' || char === '`') && !escaped) {
            if (!inString) {
                inString = true
                stringChar = char
            } else if (stringChar === char) {
                inString = false
            }
        }

        escaped = char === '\\' && !escaped
    }

    // 対応する閉じ括弧が見つからない場合は、ファイルの最後を返す
    return document.positionAt(content.length)
}

/**
 * テストケース情報の型定義
 */
interface TestCaseInfo {
    type: 'describe' | 'it'
    name: string
    range: vscode.Range
    children: TestCaseInfo[]
}
