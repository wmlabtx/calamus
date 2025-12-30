import * as vscode from 'vscode';
import OpenAI from 'openai';

let openai: OpenAI | null = null;
let currentApiKey: string | null = null;

function getOpenAIClient(): OpenAI {
    const config = vscode.workspace.getConfiguration('calamus');
    const apiKey = config.get<string>('apiKey');

    if (!apiKey) {
        throw new Error('OpenAI API key is not configured. Please set it in the extension settings.');
    }

    if (!openai || currentApiKey !== apiKey) {
        openai = new OpenAI({ apiKey });
        currentApiKey = apiKey;
    }

    return openai;
}

async function callOpenAI(prompt: string, userText: string): Promise<string> {
    const config = vscode.workspace.getConfiguration('calamus');
    const model = config.get<string>('model') || 'gpt-4o-mini';
    const maxTokens = config.get<number>('maxTokens') || 2000;
    const temperature = config.get<number>('temperature') || 0.7;

    try {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: userText }
            ],
            max_tokens: maxTokens,
            temperature
        });

        return response.choices[0]?.message?.content || 'No response from AI';
    } catch (error: any) {
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

async function processSelectedText(
    editor: vscode.TextEditor,
    prompt: string,
    actionName: string
): Promise<void> {
    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showWarningMessage('Please select some text first.');
        return;
    }

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Calamus: ${actionName}...`,
                cancellable: false
            },
            async () => {
                const result = await callOpenAI(prompt, selectedText);
                
                // Replace the selected text with the AI result
                await editor.edit(editBuilder => {
                    editBuilder.replace(selection, result);
                });

                vscode.window.showInformationMessage(`${actionName} completed!`);
            }
        );
    } catch (error: any) {
        vscode.window.showErrorMessage(`${actionName} failed: ${error.message}`);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Calamus AI extension is now active!');

    // Summarize command
    const summarizeCommand = vscode.commands.registerTextEditorCommand(
        'calamus.summarize',
        async (editor) => {
            await processSelectedText(
                editor,
                'You are a helpful assistant that summarizes text. Provide a concise summary of the following text:',
                'Summarize'
            );
        }
    );

    // Improve command
    const improveCommand = vscode.commands.registerTextEditorCommand(
        'calamus.improve',
        async (editor) => {
            await processSelectedText(
                editor,
                'You are a helpful writing assistant. Improve the following text by making it clearer, more concise, and better written while preserving its original meaning:',
                'Improve'
            );
        }
    );

    // Translate command
    const translateCommand = vscode.commands.registerTextEditorCommand(
        'calamus.translate',
        async (editor) => {
            const languages = [
                'Spanish', 'French', 'German', 'Italian', 'Portuguese',
                'Russian', 'Japanese', 'Chinese', 'Korean', 'Arabic',
                'English'
            ];

            const targetLanguage = await vscode.window.showQuickPick(languages, {
                placeHolder: 'Select target language'
            });

            if (!targetLanguage) {
                return;
            }

            await processSelectedText(
                editor,
                `You are a professional translator. Translate the following text to ${targetLanguage}. Only provide the translation, no explanations:`,
                `Translate to ${targetLanguage}`
            );
        }
    );

    // Explain command
    const explainCommand = vscode.commands.registerTextEditorCommand(
        'calamus.explain',
        async (editor) => {
            await processSelectedText(
                editor,
                'You are a helpful assistant that explains code and text. Provide a clear and detailed explanation of the following:',
                'Explain'
            );
        }
    );

    context.subscriptions.push(
        summarizeCommand,
        improveCommand,
        translateCommand,
        explainCommand
    );

    // Watch for configuration changes to reset the OpenAI client
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('calamus.apiKey')) {
                openai = null;
                currentApiKey = null;
            }
        })
    );
}

export function deactivate() {
    openai = null;
    currentApiKey = null;
}
