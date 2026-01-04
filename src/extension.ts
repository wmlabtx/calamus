import * as vscode from 'vscode';
import { GoogleGenAI } from "@google/genai";
import { getTargetText, visualizeDiff, getParagraphRange } from './utils';

// Variables

let log: vscode.LogOutputChannel | null = null;
let cachedAiClient: GoogleGenAI | null = null;
let lastUsedApiKey: string | null = null;
let lastManualCompletion: string | null = null;
let completionRange: vscode.Range | null = null;
let isInternalOperation = false;
let lastDiagnosticFix: string | null = null;
let lastDiagnosticRange: vscode.Range | null = null;

// Decoration types

const ghostTextDecorationType = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('editorGhostText.foreground'),
    fontStyle: 'italic'
});

const diagnosticRemovedType = vscode.window.createTextEditorDecorationType({
    textDecoration: 'line-through',
    color: new vscode.ThemeColor('errorForeground'),
});

let dynamicDecorations: vscode.TextEditorDecorationType[] = [];

// Description: clear ghost text
// Parameters: editor - the current text editor
// Returns: none

// Description: clear ghost text state and remove inserted text
// Parameters: editor
// Returns: none

async function clearGhostText(editor: vscode.TextEditor | undefined) {
    if (editor && completionRange) {
        if (!isInternalOperation) {
            isInternalOperation = true;
            try {
                await editor.edit(editBuilder => {
                    editBuilder.delete(completionRange!);
                });
            } catch (e) {
                console.error(e);
            }
            isInternalOperation = false;
        }
        editor.setDecorations(ghostTextDecorationType, []);
    }
    completionRange = null;
    lastManualCompletion = null;
    vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', false);
}

// Description: clear all diagnostics
// Parameters: editor - the current text editor
// Returns: none

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

// getParagraphRange moved to utils.ts

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
        let message = e.message;
        try {
            const parsed = JSON.parse(e.message);
            if (parsed.error && parsed.error.message) {
                message = parsed.error.message;
            }
        } catch (err) {
            // ignore
        }
        vscode.window.showErrorMessage(message);
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

// Description: activation function
// Parameters: context - the extension context
// Returns: none

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('calamus');

    // create output channel

    log = vscode.window.createOutputChannel('Calamus', { log: true });
    log.info('Calamus extension is now active');

    // register Check Text command

    const checkTextCommand = vscode.commands.registerCommand('calamus.runTextDiagnostic', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        clearAllDiagnostics(editor);
        const target = await getTargetText({ editor, config, log });
        if (!target) return;

        const instruction = config.get<string[]>("proofreadingInstructions");
        const prompt = instruction ? instruction.join('\n') : [
            "You are a strict proofreading engine. Your mission is to fix every objective mechanical error while leaving the style untouched.",
            "Correct the following strictly:",
            "1. Spelling and Typos (fix all typos like 'wil' -> 'will', 'teh' -> 'the').",
            "2. Grammar (syntax, agreement, tense consistency).",
            "3. Punctuation.",
            "4. Word Usage (homophones, wrong words).",
            "CONSTRAINTS (Adhere strictly):",
            "- YOU MUST FIX all spelling mistakes and typos.",
            "- DO NOT change the style, tone, choice of words (unless wrong), or sentence structure.",
            "- DO NOT 'polish' or 'improve' the writing.",
            "- DO NOT paraphrase.",
            "- If a sentence is awkward but grammatically correct, LEAVE IT ALONE.",
            "Return only the corrected text with no markdown or explanations."
        ].join('\n');

        const response = await getGeminiResponse(target.text, prompt);
        if (response && response !== target.text) {
            const results = visualizeDiff(editor, target.text, response, target.range, diagnosticRemovedType);
            dynamicDecorations.push(...results.dynamic);

            lastDiagnosticFix = response;
            lastDiagnosticRange = target.range;
            vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
            log?.debug('Diagnostic fix stored and context set for Tab accept');
        } else if (response === target.text) {
            vscode.window.showInformationMessage("No issues found!");
        }
    });

    context.subscriptions.push(checkTextCommand);

    // register Translate Text command

    const translateTextCommand = vscode.commands.registerCommand('calamus.runTranslateText', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        clearAllDiagnostics(editor);
        const target = await getTargetText({ editor, config, log });
        if (!target) return;

        const secondLanguage = config.get<string>('secondLanguage');
        const prompt = [
            `You are a professional bi-lingual translator fluent in English and ${secondLanguage}.`,
            "Task: Detect the language of the input text.",
            `1. If the text is primarily in English, translate it to natural, high-quality ${secondLanguage}.`,
            `2. If the text is in ${secondLanguage} or in a mix of English and ${secondLanguage} or any other language, translate it to English.`,
            "Requirements:",
            "1. Maintain the original tone, style, volume, and formatting.",
            "2. Preserve the user's intent and nuance (e.g., formal vs. casual).",
            "3. Do not add explanations, notes, or meta-text.",
            "4. Return only the direct translation."
        ].join('\n');

        const response = await getGeminiResponse(target.text, prompt);
        if (response && response !== target.text) {
            const results = visualizeDiff(editor, target.text, response, target.range, diagnosticRemovedType);
            dynamicDecorations.push(...results.dynamic);

            lastDiagnosticFix = response;
            lastDiagnosticRange = target.range;
            vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
        } else if (response === target.text) {
            vscode.window.showInformationMessage("No issues found!");
        }
    });

    context.subscriptions.push(translateTextCommand);

    // register Improve Text command

    const improveTextCommand = vscode.commands.registerCommand('calamus.runImproveText', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        clearAllDiagnostics(editor);
        const target = await getTargetText({ editor, config, log });
        if (!target) return;

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
            "Always correct these issues",
            "If the text is not in English or contains non-English words: translate it to English"
        ].join('\n');

        const instructions = config.get<string>("improveTextInstructions");
        const prompt = instructions || defaultPrompt;

        const response = await getGeminiResponse(target.text, prompt);
        if (response && response !== target.text) {
            const results = visualizeDiff(editor, target.text, response, target.range, diagnosticRemovedType);
            dynamicDecorations.push(...results.dynamic);

            lastDiagnosticFix = response;
            lastDiagnosticRange = target.range;
            vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
            log?.debug('Diagnostic fix stored and context set for Tab accept');
        } else if (response === target.text) {
            vscode.window.showInformationMessage("No improvements found!");
        }
    });

    context.subscriptions.push(improveTextCommand);

    // register Accept Completion command 

    const acceptCompletionCommand = vscode.commands.registerCommand('calamus.acceptCompletion', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            if (completionRange) {
                // Ghost text is already in document, just clear decoration and context
                editor.setDecorations(ghostTextDecorationType, []);

                // Move cursor to end of completion
                editor.selection = new vscode.Selection(completionRange.end, completionRange.end);

                completionRange = null;
                lastManualCompletion = null;
                vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', false);
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
                "Your output will be appended DIRECTLY to the end of the user's text. Include any necessary leading whitespace.",
                "Do not repeat any of the user's text.",
                "Do not correct or modify the user's text - only add new characters after it.",
                "If the text ends mid-word, complete that word first, then continue.",
                "If the text ends with a complete word, START your response with a space.",
                completionPrompt
            ].join('\n');

            const response = await getGeminiResponse(selectedText, prompt);
            if (response) {
                log?.debug(`Response (length: ${response.length})`);
                log?.debug(response);

                let finalResponse = response;
                if (!selectedText.endsWith(' ') && !finalResponse.startsWith(' ')) {
                    finalResponse = ' ' + finalResponse;
                }

                lastManualCompletion = finalResponse;
                const startPos = editor.selection.active;

                // Insert text directly to support wrapper
                isInternalOperation = true;
                await editor.edit(editBuilder => {
                    editBuilder.insert(startPos, finalResponse);
                });
                isInternalOperation = false;

                // Calculate range of inserted text
                const endPos = editor.document.positionAt(editor.document.offsetAt(startPos) + finalResponse.length);
                completionRange = new vscode.Range(startPos, endPos);

                // Apply decoration
                editor.setDecorations(ghostTextDecorationType, [completionRange]);

                // Reset cursor to start so it feels like ghost text
                editor.selection = new vscode.Selection(startPos, startPos);

                vscode.commands.executeCommand('setContext', 'calamus.hasCompletion', true);
                log?.debug(`Ghost text inserted and decorated at ${startPos.line}:${startPos.character}`);
            }
        }
    });

    context.subscriptions.push(completionCommand);

    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection((e) => {
            if (e.textEditor !== vscode.window.activeTextEditor) {
                return;
            }
            const pos = e.selections[0].active;

            // If we have a completion and the cursor moves away from the start position (unless it's to the end which we handle in accept),
            // we should probably clear. But user might be inspecting. 
            // Better policy: If cursor moves OUT of the range or user clicks elsewhere, clear.
            // But simplify: If cursor moves at all, we clear, UNLESS we just accepted.
            // Wait, acceptCompletion moves cursor. We need to be careful.

            // Actually, if user strictly moves cursor manually, we should clear (reject).
            // But detecting "manual move" vs "programmatic move" is hard.
            // For now, rely on `acceptCompletion` clearing the state `completionRange = null` BEFORE moving cursor.

            if (completionRange) {
                // User requirement: only clear if cursor moves outside the paragraph
                const currentParaRange = getParagraphRange(vscode.window.activeTextEditor!, completionRange.start.line);
                if (!currentParaRange.contains(pos)) {
                    log?.debug('Cursor moved outside paragraph, removing ghost text');
                    clearGhostText(vscode.window.activeTextEditor);
                }
            }

            if (lastDiagnosticFix && lastDiagnosticRange) {
                if (!lastDiagnosticRange.contains(pos)) {
                    log?.debug('Cursor moved outside diagnostic range, clearing diagnostics');
                    clearAllDiagnostics(vscode.window.activeTextEditor);
                }
            }
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (completionRange && !isInternalOperation && e.document === vscode.window.activeTextEditor?.document) {
                if (e.contentChanges.length === 0) {
                    return;
                }
                // User typed something or edited the document.
                // We should remove the ghost text immediately to avoid corruption.
                log?.debug('Document changed externally (user edit), removing ghost text');
                clearGhostText(vscode.window.activeTextEditor);
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
}