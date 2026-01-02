
import * as vscode from 'vscode';
import * as Diff from 'diff';

// Shared Types

export interface EditorContext {
    editor: vscode.TextEditor;
    config: vscode.WorkspaceConfiguration;
    log: vscode.LogOutputChannel | null;
}

// Text Retrieval

// Description: Gets the selected text, or if empty, the current paragraph.
// Returns null if no text could be retrieved or if text is too short (< 10 chars).
// Handles user feedback if text is missing or too short.

export async function getTargetText(ctx: EditorContext): Promise<{ text: string; range: vscode.Range } | null> {
    const { editor, log } = ctx;
    let selectedText = editor.document.getText(editor.selection);
    let checkRange: vscode.Range = editor.selection;

    if (editor.selection.isEmpty || selectedText === '') {
        const paragraph = getParagraphRange(editor, editor.selection.active.line);
        selectedText = editor.document.getText(paragraph);
        checkRange = paragraph;
    }

    log?.debug(`Captured text length: ${selectedText.length}`);

    if (!selectedText.trim()) {
        const msg = "No text found.";
        log?.info(msg);
        vscode.window.showInformationMessage(msg);
        return null;
    }

    if (selectedText.trim().length < 10) {
        const msg = "Text must be at least 10 characters long.";
        log?.info(msg);
        vscode.window.showInformationMessage(msg);
        return null;
    }

    return { text: selectedText, range: checkRange };
}

// Description: Gets the full paragraph range around a line.
// Parameters: editor - the current text editor, line - the current line number
// Returns: the range of the current paragraph

export function getParagraphRange(editor: vscode.TextEditor, line: number): vscode.Range {
    let paraStart = line;
    let paraEnd = line;

    while (paraStart > 0 && !editor.document.lineAt(paraStart - 1).isEmptyOrWhitespace) {
        paraStart--;
    }
    while (paraEnd < editor.document.lineCount - 1 && !editor.document.lineAt(paraEnd + 1).isEmptyOrWhitespace) {
        paraEnd++;
    }

    const startPos = new vscode.Position(paraStart, 0);
    const endPos = editor.document.lineAt(paraEnd).range.end;
    return new vscode.Range(startPos, endPos);
}

// Description: Calculates diffs between original and new text, and applies decorations.
// Parameters: editor - the current text editor, originalText - the original text, newText - the new text, range - the range of the text, removedType - the type of decoration to apply
// Returns: the decorations to be added to the editor's tracking.

export function visualizeDiff(
    editor: vscode.TextEditor,
    originalText: string,
    newText: string,
    range: vscode.Range,
    removedType: vscode.TextEditorDecorationType
): { removed: vscode.DecorationOptions[], dynamic: vscode.TextEditorDecorationType[] } {

    const diffs = Diff.diffWordsWithSpace(originalText, newText);
    const removed: vscode.DecorationOptions[] = [];
    const dynamic: vscode.TextEditorDecorationType[] = [];

    const baseOffset = editor.document.offsetAt(range.start);
    let offset = 0;

    for (let i = 0; i < diffs.length; i++) {
        const part = diffs[i];
        if (part.removed) {
            const start = editor.document.positionAt(baseOffset + offset);
            const end = editor.document.positionAt(baseOffset + offset + part.value.length);
            const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

            if (nextPart && nextPart.added) {
                // Replacement
                const dynamicType = vscode.window.createTextEditorDecorationType({
                    after: {
                        contentText: ` → ${nextPart.value.trim()}`,
                        color: new vscode.ThemeColor('editorGhostText.foreground'),
                        fontStyle: 'italic',
                        margin: '0 0 0 0.2em'
                    }
                });
                dynamic.push(dynamicType);
                editor.setDecorations(dynamicType, [{ range: new vscode.Range(start, end) }]);
                i++; // skip next added part as we handled it here
            } else {
                // Deletion
                removed.push({ range: new vscode.Range(start, end) });
            }
            offset += part.value.length;
        } else if (part.added) {
            // pure addition
            const anchor = editor.document.positionAt(baseOffset + offset);
            const dynamicType = vscode.window.createTextEditorDecorationType({
                after: {
                    contentText: ` [+] ${part.value.trim()}`,
                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                    fontStyle: 'italic',
                    margin: '0 0 0 0.2em'
                }
            });
            dynamic.push(dynamicType);
            editor.setDecorations(dynamicType, [{ range: new vscode.Range(anchor, anchor) }]);
        } else {
            // unchanged
            offset += part.value.length;
        }
    }

    editor.setDecorations(removedType, removed);
    return { removed, dynamic };
}