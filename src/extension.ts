import * as vscode from 'vscode';
import { GoogleGenAI } from "@google/genai";
import * as Diff from 'diff';

// variables

let log: vscode.LogOutputChannel | null = null;
let cachedAiClient: GoogleGenAI | null = null;
let lastUsedApiKey: string | null = null;
let lastManualCompletion: string | null = null;
let completionPosition: vscode.Position | null = null;
let lastDiagnosticFix: string | null = null;
let lastDiagnosticRange: vscode.Range | null = null;

const ghostTextDecorationType = vscode.window.createTextEditorDecorationType({
    after: {
        color: new vscode.ThemeColor('editorGhostText.foreground'),
        fontStyle: 'italic',
    }
});

const diagnosticRemovedType = vscode.window.createTextEditorDecorationType({
    textDecoration: 'line-through',
    color: new vscode.ThemeColor('errorForeground'),
});

// For replacement arrows, we need a way to store dynamic decoration types to dispose them later
let dynamicDecorations: vscode.TextEditorDecorationType[] = [];

function clearGhostText(editor: vscode.TextEditor | undefined) {
    if (editor) {
        editor.setDecorations(ghostTextDecorationType, []);
    }
    lastManualCompletion = null;
    completionPosition = null;
    vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', false);
}

function clearAllDiagnostics(editor: vscode.TextEditor | undefined) {
    if (editor) {
        editor.setDecorations(diagnosticRemovedType, []);
        dynamicDecorations.forEach(d => d.dispose());
        dynamicDecorations = [];
    }
    lastDiagnosticFix = null;
    lastDiagnosticRange = null;
    if (!lastManualCompletion) {
        vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', false);
    }
}

// Description: Get the range of the current paragraph
// Parameters: editor - the current text editor, line - the current line number
// Returns: the range of the current paragraph

function getParagraphRange(editor: vscode.TextEditor, line: number) {
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

// Description: Get the response from Gemini
// Parameters: contents - the text to analyze, prompt - the prompt to use
// Returns: the response from Gemini

async function getGeminiResponse(contents: string, prompt: string): Promise<any> {
    const config = vscode.workspace.getConfiguration('calamus');
    const apiKey = config.get<string>('apiKey');
    if (!apiKey || apiKey.trim().length === 0) {
        const message = "Gemini API key is not configured. Please set it in the extension settings.";
        log?.error(message);
        vscode.window.showErrorMessage(message);
        return null;
    }

    const model = config.get<string>('model');
    if (!model || model.trim().length === 0) {
        const message = "Gemini model is not configured. Please set it in the extension settings.";
        log?.error(message);
        vscode.window.showErrorMessage(message);
        return null;
    }

    log?.debug(`contents (length: ${contents.length}):`);
    log?.debug(contents);
    log?.debug(`prompt (length: ${prompt.length}):`);
    log?.debug(prompt);

    if (!cachedAiClient || lastUsedApiKey !== apiKey) {
        cachedAiClient = new GoogleGenAI({ apiKey: apiKey });
        lastUsedApiKey = apiKey;
        log?.debug('Gemini client initialized/updated');
    }

    const ai = cachedAiClient;
    const result = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
            systemInstruction: prompt,
        },
    }).catch((e: any) => {
        log?.error(`name: ${e.name}`);
        log?.error(`message: ${e.message}`);
        log?.error(`status: ${e.status}`);
        vscode.window.showErrorMessage(e.message);
    });

    if (!result) {
        return null;
    }

    log?.debug('JSON response from Gemini:');
    log?.debug(JSON.stringify(result, null, 2));

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (responseText) {
        return responseText.trim();
    } else {
        const reason = result.candidates?.[0]?.finishReason || 'UNKNOWN';
        const message = `No text in response. Reason: ${reason}`;
        log?.error(message);
        vscode.window.showErrorMessage(message);
        return null;
    }
}

// description: activation function
// parameters: context - the extension context
// returns: none

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('calamus');

    // create output channel

    log = vscode.window.createOutputChannel('Calamus', { log: true });
    log.info('Calamus extension is now active');

    // register Check Text command

    const checkTextCommand = vscode.commands.registerCommand('calamus.runTextDiagnostic', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            clearAllDiagnostics(editor);
            let selectedText = editor.document.getText(editor.selection);
            if (editor.selection.isEmpty || selectedText === '') {
                const range = getParagraphRange(editor, editor.selection.active.line);
                selectedText = editor.document.getText(range);
            }

            log?.debug(`Text to check (length: ${selectedText.length})`);
            log?.debug(selectedText);

            if (!selectedText.trim()) {
                const message = "No text found to check";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            if (selectedText.trim().length < 10) {
                const message = "Text to check must be at least 10 characters long";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            const prompt = [
                "You are a professional editor and expert proofreader.",
                "Analyze the text for the following issues:",
                "1. Grammar, spelling, and punctuation errors.",
                "2. Semantic inconsistencies and logical errors (e.g., questions that end as statements).",
                "3. Inconsistent verb tenses or conflicting writing styles.",
                "4. Awkward phrasing and poor sentence flow (e.g., run-on sentences or choppy text).",
                "5. Redundancy, wordiness, and tautology (eliminate unnecessary fillers).",
                "6. Vague word choices (replace general terms with more precise, context-aware vocabulary).",
                "7. Ambiguous pronoun references (ensure it is clear what 'it', 'this', or 'they' refers to).",
                "Your goal is to make the text coherent, professional, and correct while preserving the original intent.",
                "Fix all identified issues. Return only the corrected text without any explanations or meta-talk."
            ].join('\n');

            const response = await getGeminiResponse(selectedText, prompt);
            if (response && response !== selectedText) {
                const diffs = Diff.diffWordsWithSpace(selectedText, response);
                const removed: vscode.DecorationOptions[] = [];

                let offset = 0;

                let checkRange: vscode.Range;
                if (editor.selection.isEmpty) {
                    checkRange = getParagraphRange(editor, editor.selection.active.line);
                } else {
                    checkRange = editor.selection;
                }
                const baseOffset = editor.document.offsetAt(checkRange.start);

                for (let i = 0; i < diffs.length; i++) {
                    const part = diffs[i];
                    if (part.removed) {
                        const start = editor.document.positionAt(baseOffset + offset);
                        const end = editor.document.positionAt(baseOffset + offset + part.value.length);
                        const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

                        if (nextPart && nextPart.added) {
                            const dynamicType = vscode.window.createTextEditorDecorationType({
                                after: {
                                    contentText: ` → ${nextPart.value.trim()}`,
                                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                                    fontStyle: 'italic',
                                    margin: '0 0 0 0.2em'
                                }
                            });
                            dynamicDecorations.push(dynamicType);
                            editor.setDecorations(dynamicType, [{ range: new vscode.Range(start, end) }]);
                            i++; // skip addition
                        } else {
                            removed.push({ range: new vscode.Range(start, end) });
                        }
                        offset += part.value.length;
                    } else if (part.added) {
                        const anchor = editor.document.positionAt(baseOffset + offset);
                        const dynamicType = vscode.window.createTextEditorDecorationType({
                            after: {
                                contentText: ` [+] ${part.value.trim()}`,
                                color: new vscode.ThemeColor('editorGhostText.foreground'),
                                fontStyle: 'italic',
                                margin: '0 0 0 0.2em'
                            }
                        });
                        dynamicDecorations.push(dynamicType);
                        editor.setDecorations(dynamicType, [{ range: new vscode.Range(anchor, anchor) }]);
                    } else {
                        offset += part.value.length;
                    }
                }
                editor.setDecorations(diagnosticRemovedType, removed);

                lastDiagnosticFix = response;
                lastDiagnosticRange = checkRange;
                vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
                log?.debug('Diagnostic fix stored and context set for Tab accept');
            } else if (response === selectedText) {
                vscode.window.showInformationMessage("No issues found!");
            }
        }
    });

    context.subscriptions.push(checkTextCommand);

    // register Translate Text command

    const translateTextCommand = vscode.commands.registerCommand('calamus.runTranslateText', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            clearAllDiagnostics(editor);
            let selectedText = editor.document.getText(editor.selection);
            if (editor.selection.isEmpty || selectedText === '') {
                const range = getParagraphRange(editor, editor.selection.active.line);
                selectedText = editor.document.getText(range);
            }

            log?.debug(`Text to translate (length: ${selectedText.length})`);
            log?.debug(selectedText);

            if (!selectedText.trim()) {
                const message = "No text found to check";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            if (selectedText.trim().length < 10) {
                const message = "Text to translate must be at least 10 characters long";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            const secondLanguage = vscode.workspace.getConfiguration('calamus').get('secondLanguage');

            const prompt = [
                `You are a professional bi-lingual translator fluent in English and ${secondLanguage}.`,
                "Task: Detect limits language of the input text.",
                `1. If the text is primarily in English, translate it to natural, high-quality ${secondLanguage}.`,
                `2. If the text is in ${secondLanguage} or in a mix of English and ${secondLanguage} or any other language, translate it to English.`,
                "Requirements:",
                "1. Maintain the original tone, style, volume, and formatting.",
                "2. Preserve the user's intent and nuance (e.g., formal vs. casual).",
                "3. Do not add explanations, notes, or meta-text.",
                "4. Return only the direct translation."
            ].join('\n');

            const response = await getGeminiResponse(selectedText, prompt);
            if (response) {
                const diffs = Diff.diffWordsWithSpace(selectedText, response);
                const removed: vscode.DecorationOptions[] = [];

                let offset = 0;

                let checkRange: vscode.Range;
                if (editor.selection.isEmpty) {
                    checkRange = getParagraphRange(editor, editor.selection.active.line);
                } else {
                    checkRange = editor.selection;
                }
                const baseOffset = editor.document.offsetAt(checkRange.start);

                for (let i = 0; i < diffs.length; i++) {
                    const part = diffs[i];
                    if (part.removed) {
                        const start = editor.document.positionAt(baseOffset + offset);
                        const end = editor.document.positionAt(baseOffset + offset + part.value.length);
                        const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

                        if (nextPart && nextPart.added) {
                            const dynamicType = vscode.window.createTextEditorDecorationType({
                                after: {
                                    contentText: ` → ${nextPart.value.trim()}`,
                                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                                    fontStyle: 'italic',
                                    margin: '0 0 0 0.2em'
                                }
                            });
                            dynamicDecorations.push(dynamicType);
                            editor.setDecorations(dynamicType, [{ range: new vscode.Range(start, end) }]);
                            i++; // skip addition
                        } else {
                            removed.push({ range: new vscode.Range(start, end) });
                        }
                        offset += part.value.length;
                    } else if (part.added) {
                        const anchor = editor.document.positionAt(baseOffset + offset);
                        const dynamicType = vscode.window.createTextEditorDecorationType({
                            after: {
                                contentText: ` [+] ${part.value.trim()}`,
                                color: new vscode.ThemeColor('editorGhostText.foreground'),
                                fontStyle: 'italic',
                                margin: '0 0 0 0.2em'
                            }
                        });
                        dynamicDecorations.push(dynamicType);
                        editor.setDecorations(dynamicType, [{ range: new vscode.Range(anchor, anchor) }]);
                    } else {
                        offset += part.value.length;
                    }
                }
                editor.setDecorations(diagnosticRemovedType, removed);

                lastDiagnosticFix = response;
                lastDiagnosticRange = checkRange;
                vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
                log?.debug('Diagnostic fix stored and context set for Tab accept');
            } else if (response === selectedText) {
                vscode.window.showInformationMessage("No issues found!");
            }
        }
    });

    context.subscriptions.push(translateTextCommand);

    // register Improve Text command

    const improveTextCommand = vscode.commands.registerCommand('calamus.runImproveText', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            clearAllDiagnostics(editor);
            let selectedText = editor.document.getText(editor.selection);
            if (editor.selection.isEmpty || selectedText === '') {
                const range = getParagraphRange(editor, editor.selection.active.line);
                selectedText = editor.document.getText(range);
            }

            log?.debug(`Text to improve (length: ${selectedText.length})`);
            log?.debug(selectedText);

            if (!selectedText.trim()) {
                const message = "No text found to improve";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            if (selectedText.trim().length < 10) {
                const message = "Text to improve must be at least 10 characters long";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            const defaultPrompt = [
                "1. Maintain the original tone and approximate length",
                "2. Ensure the output looks naturally typed (no special typography, icons, bullets, lists or line breaks)",
                "3. Suggested text must be: ",
                "  - grammatically correct",
                "  - friendly and professional",
                "  - free from ambiguous statements",
                "  - free from personal criticism or negativity",
                "  - free from offensive content",
                "  - appropriate for US workplace communication",
                "4. Use modern American English",
                "5. Allow professional IT/AWS slang: AWS, org, IP, UDP, tofu, etc. (only if present in original)",
                "6. Allow abbreviations and contractions",
                "7. Make it look quickly typed by a human, not formally composed",
                "8. Error Correction The input text may contain:",
                "  - syntax/grammar errors",
                "  - stylistic issues",
                "  - factual inaccuracies",
                "  - ambiguous statements",
                "  - unintentional negativity",
                "Always correct these issues",
                "9. If the text is not in English or contains non-English words: translate it to English"
            ].join('\n');

            const instructions = config.get<string[]>("improveTextInstructions");
            const prompt = instructions ? instructions.join('\n') : defaultPrompt;

            const response = await getGeminiResponse(selectedText, prompt);
            if (response) {
                const diffs = Diff.diffWordsWithSpace(selectedText, response);
                const removed: vscode.DecorationOptions[] = [];

                let offset = 0;

                let checkRange: vscode.Range;
                if (editor.selection.isEmpty) {
                    checkRange = getParagraphRange(editor, editor.selection.active.line);
                } else {
                    checkRange = editor.selection;
                }
                const baseOffset = editor.document.offsetAt(checkRange.start);

                for (let i = 0; i < diffs.length; i++) {
                    const part = diffs[i];
                    if (part.removed) {
                        const start = editor.document.positionAt(baseOffset + offset);
                        const end = editor.document.positionAt(baseOffset + offset + part.value.length);
                        const nextPart = i + 1 < diffs.length ? diffs[i + 1] : null;

                        if (nextPart && nextPart.added) {
                            const dynamicType = vscode.window.createTextEditorDecorationType({
                                after: {
                                    contentText: ` → ${nextPart.value.trim()}`,
                                    color: new vscode.ThemeColor('editorGhostText.foreground'),
                                    fontStyle: 'italic',
                                    margin: '0 0 0 0.2em'
                                }
                            });
                            dynamicDecorations.push(dynamicType);
                            editor.setDecorations(dynamicType, [{ range: new vscode.Range(start, end) }]);
                            i++; // skip addition
                        } else {
                            removed.push({ range: new vscode.Range(start, end) });
                        }
                        offset += part.value.length;
                    } else if (part.added) {
                        const anchor = editor.document.positionAt(baseOffset + offset);
                        const dynamicType = vscode.window.createTextEditorDecorationType({
                            after: {
                                contentText: ` [+] ${part.value.trim()}`,
                                color: new vscode.ThemeColor('editorGhostText.foreground'),
                                fontStyle: 'italic',
                                margin: '0 0 0 0.2em'
                            }
                        });
                        dynamicDecorations.push(dynamicType);
                        editor.setDecorations(dynamicType, [{ range: new vscode.Range(anchor, anchor) }]);
                    } else {
                        offset += part.value.length;
                    }
                }
                editor.setDecorations(diagnosticRemovedType, removed);

                lastDiagnosticFix = response;
                lastDiagnosticRange = checkRange;
                vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
                log?.debug('Diagnostic fix stored and context set for Tab accept');
            } else if (response === selectedText) {
                vscode.window.showInformationMessage("No improvements found!");
            }
        }
    });

    context.subscriptions.push(improveTextCommand);

    // register Accept Completion command 

    const acceptCompletionCommand = vscode.commands.registerCommand('calamus.acceptCompletion', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (lastManualCompletion && completionPosition) {
                // Handle ghost text completion
                await editor.edit(editBuilder => {
                    editBuilder.insert(completionPosition!, lastManualCompletion!);
                });
                clearGhostText(editor);
            } else if (lastDiagnosticFix && lastDiagnosticRange) {
                // Handle diagnostic grammar fix
                await editor.edit(editBuilder => {
                    editBuilder.replace(lastDiagnosticRange!, lastDiagnosticFix!);
                });
                clearAllDiagnostics(editor);
            }
        }
    });
    context.subscriptions.push(acceptCompletionCommand);

    const clearAllDiagnosticsCommand = vscode.commands.registerCommand('calamus.clearDecorations', () => {
        clearAllDiagnostics(vscode.window.activeTextEditor);
    });
    context.subscriptions.push(clearAllDiagnosticsCommand);

    // register Complete Text command

    const completionCommand = vscode.commands.registerCommand('calamus.runTextCompletion', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            let currentParaRange = getParagraphRange(editor, editor.selection.active.line);
            let selectedText = editor.document.getText(currentParaRange);
            let currentStartLine = currentParaRange.start.line;

            const trailingRange = new vscode.Range(editor.selection.active, currentParaRange.end);
            const trailingText = editor.document.getText(trailingRange);

            if (trailingText.trim().length !== 0) {
                const message = "Cursor should be at the end of the paragraph";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            while (selectedText.length < 1000 && currentStartLine > 0) {
                let prevLine = currentStartLine - 1;
                while (prevLine >= 0 && editor.document.lineAt(prevLine).isEmptyOrWhitespace) {
                    prevLine--;
                }

                if (prevLine >= 0) {
                    const prevParaRange = getParagraphRange(editor, prevLine);
                    const prevText = editor.document.getText(prevParaRange);
                    selectedText = prevText + "\n\n" + selectedText;
                    currentStartLine = prevParaRange.start.line;
                } else {
                    break;
                }
            }

            log?.debug(`Text to complete (length: ${selectedText.length})`);
            log?.debug(selectedText);

            if (!selectedText.trim()) {
                const message = "No text found to complete";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            if (selectedText.trim().length < 10) {
                const message = "Text to complete must be at least 10 characters long";
                log?.info(message);
                vscode.window.showInformationMessage(message);
                return;
            }

            const completionPrompt = config.get<string>("completionPrompt");
            const prompt = [
                "You are a text continuation engine, not a chatbot or proofreader.",
                "The user is writing and paused.",
                "Continue their text naturally from where they stopped, preserving the style, tone, and mood.",
                "Return only the new continuation words.",
                "Do not repeat any of the user's text.",
                "Do not correct or modify the user's text - only add new words after it.",
                "If the text ends mid-word, complete that word first, then continue.",
                completionPrompt
            ].join('\n');

            const response = await getGeminiResponse(selectedText, prompt);
            if (response) {
                log?.debug(`Response (length: ${response.length})`);
                log?.debug(response);

                let finalResponse = response;
                const lastChar = selectedText.charAt(selectedText.length - 1);
                if (lastChar !== ' ' && !finalResponse.startsWith(' ') && !/^[.,!?;]/.test(finalResponse)) {
                    finalResponse = ' ' + finalResponse;
                }

                lastManualCompletion = finalResponse;
                completionPosition = editor.selection.active;

                editor.setDecorations(ghostTextDecorationType, [{
                    range: new vscode.Range(completionPosition, completionPosition),
                    renderOptions: {
                        after: { contentText: finalResponse }
                    }
                }]);

                vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
                log?.debug(`Ghost text decoration applied at ${completionPosition.line}:${completionPosition.character}`);
            }
        }
    });

    context.subscriptions.push(completionCommand);

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((e) => {
            const pos = e.selections[0].active;
            if (lastManualCompletion && completionPosition) {
                if (pos.line !== completionPosition.line || pos.character !== completionPosition.character) {
                    log?.debug('Cursor moved, clearing decoration');
                    clearGhostText(vscode.window.activeTextEditor);
                }
            }

            if (lastDiagnosticFix && lastDiagnosticRange) {
                log?.debug('Selection changed, clearing diagnostics');
                clearAllDiagnostics(vscode.window.activeTextEditor);
            }
        })
    );
}

// description: deactivation function
// parameters: none
// returns: none

export function deactivate() {
    if (log) {
        log.dispose();
        log = null;
    }

    cachedAiClient = null;
    lastUsedApiKey = null;
    lastManualCompletion = null;
    completionPosition = null;
    lastDiagnosticFix = null;
    lastDiagnosticRange = null;
}