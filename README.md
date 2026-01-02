# Calamus - AI Text Assistant for VS Code

Calamus is a powerful VS Code extension that brings AI-powered text editing features directly to your text documents using Google Gemini. It provides tools for text checking, completion, translation, and improvement, all integrated seamlessly into your editing workflow.

## Features

### Check Text (F4)
Automatically proofread your text for grammar, spelling, punctuation, and style issues.
- **How it works**: Analyzes the current paragraph (or selected text) and visualizes changes.
- **Visualization**: Deletions are shown as red strike-throughs, and additions/corrections appear as ghost text.
- **Accept**: Press `Tab` to apply the corrections.

### Complete Text (F5)
Stuck on a sentence? Let Calamus finish it for you.
- **Context-Aware**: Analyzes up to 1000 characters of preceding text (including previous paragraphs) to generate natural continuations.
- **Ghost Text**: The suggestion appears as gray ghost text at your cursor.
- **Accept**: Press `Tab` to insert the completion.

### Translate Text (F6)
Instantly translate text between English and your configured second language.
- **Bi-directional**: Automatically detects if the text is English (translates to target language) or the target language (translates to English).
- **Preserves Nuance**: Designed to maintain tone, style, and formatting.
- **Configurable**: Set your preferred `Second Language` in settings (default: Spanish).

### Improve Text (F7)
Enhance the quality of your writing with a single keystroke.
- **Professional Polish**: Makes text clearer, more professional, and "native-sounding".
- **Customizable**: Uses a set of predefined instructions (configurable in settings) to guide the improvement process (e.g., maintaining tone, removing ambiguity).

## Installation

1. Install the extension from the VS Code Marketplace or via VSIX.
2. Get a **Google Gemini API Key** from [Google AI Studio](https://makersuite.google.com/app/apikey).
3. Open VS Code Settings (`Ctrl+,`), search for `calamus`, and enter your API key.

## Usage

### Workflow
1. **Open a text document** (Markdown, txt, etc.).
2. **Place your cursor** in the paragraph you want to modify, or make a selection.
3. **Trigger a command**:
   - `F4`: Check for errors
   - `F5`: Generate text completion
   - `F6`: Translate
   - `F7`: Improve text
4. **Review**: The extension will show a diff (for edits) or ghost text (for completions).
5. **Accept**: Press `Tab` to confirm the changes.
   - If you move your cursor before accepting, the suggestions will disappear.

### Commands
- **Calamus: Check Text** (`F4`) - Proofread and fix grammar/spelling
- **Calamus: Complete Text** (`F5`) - Generate text continuation
- **Calamus: Translate Text** (`F6`) - Translate between English and Second Language
- **Calamus: Improve Text** (`F7`) - Rewrite text for better style and clarity
- **Calamus: Accept Completion** (`Tab`) - Apply the current suggestion/fix
- **Calamus: Clear Decorations** - Remove all current suggestion highlights

## Configuration

Customise Calamus in your VS Code Settings (`Ctrl+,` > `Calamus`):

- **`calamus.apiKey`**: Your Google Gemini API Key.
- **`calamus.model`**: The Gemini model to use (default: `gemini-2.0-flash-lite`).
- **`calamus.secondLanguage`**: The target language for the Translation feature (default: "Spanish").
- **`calamus.completionPrompt`**: Custom instructions for text completion.
- **`calamus.improveTextInstructions`**: A list of rules for the "Improve Text" feature (e.g., "Make it sound professional", "Use American English").

## Requirements

- VS Code v1.104.0 or higher.
- A valid Google Gemini API Key.

## License

MIT