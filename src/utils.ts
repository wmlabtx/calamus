
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

    // Decoration types for tracking
    // We apply specific styles in the renderOptions for each item to target the 'after' content specifically
    const replacementType = vscode.window.createTextEditorDecorationType({});
    const insertionType = vscode.window.createTextEditorDecorationType({});

    dynamic.push(replacementType, insertionType);

    const replacementOptions: vscode.DecorationOptions[] = [];
    const insertionOptions: vscode.DecorationOptions[] = [];

    const baseOffset = editor.document.offsetAt(range.start);
    let offset = 0;

    for (let i = 0; i < diffs.length; i++) {
        const part = diffs[i];
        if (part.removed) {
            const start = editor.document.positionAt(baseOffset + offset);
            const end = editor.document.positionAt(baseOffset + offset + part.value.length);
            const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

            // Always strikethrough the removed text
            removed.push({ range: new vscode.Range(start, end) });

            if (nextPart && nextPart.added) {
                // Replacement (removed -> added match)
                replacementOptions.push({
                    range: new vscode.Range(start, end),
                    renderOptions: {
                        after: {
                            contentText: nextPart.value,
                            margin: '0 0 0 0.3em', // Small margin to separate from struck-through text
                            color: new vscode.ThemeColor('editor.foreground'),
                            backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground')
                        }
                    }
                });

                i++; // skip next added part as it is consumed
                offset += part.value.length; // Advance offset ONLY by the removed part. Added part is not in original text.
            } else {
                // Pure Deletion
                offset += part.value.length;
            }
        } else if (part.added) {
            // Pure Insertion (no preceding removed part)
            const anchor = editor.document.positionAt(baseOffset + offset);
            insertionOptions.push({
                range: new vscode.Range(anchor, anchor),
                renderOptions: {
                    after: {
                        contentText: part.value,
                        color: new vscode.ThemeColor('editor.foreground'),
                        backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground')
                    }
                }
            });
            // Added text does not advance offset in original document
        } else {
            // Unchanged
            offset += part.value.length;
        }
    }

    editor.setDecorations(removedType, removed);
    editor.setDecorations(replacementType, replacementOptions);
    editor.setDecorations(insertionType, insertionOptions);

    return { removed, dynamic };
}