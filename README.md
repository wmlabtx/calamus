# Calamus - AI Text Assistant for VSCode

A powerful VSCode extension that brings AI-powered text manipulation functions directly to your text documents.

## Features

Calamus provides the following AI-powered commands that work on selected text:

- **Summarize Text**: Get a concise summary of selected content
- **Improve Text**: Enhance writing clarity, conciseness, and quality
- **Translate Text**: Translate to multiple languages (Spanish, French, German, Italian, Portuguese, Russian, Japanese, Chinese, Korean, Arabic, English)
- **Explain Code/Text**: Get detailed explanations of code or complex text

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 in VSCode to launch the extension in a new Extension Development Host window

## Configuration

Before using Calamus, you need to configure your OpenAI API key:

1. Open VSCode Settings (File > Preferences > Settings or Cmd/Ctrl + ,)
2. Search for "Calamus"
3. Enter your OpenAI API Key in the `Calamus: Api Key` field
   - Get an API key at [OpenAI Platform](https://platform.openai.com/api-keys)

### Available Settings

- **Calamus: Api Key** - Your OpenAI API key (required)
- **Calamus: Model** - Choose the AI model (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo)
  - Default: `gpt-4o-mini`
- **Calamus: Max Tokens** - Maximum tokens in the response
  - Default: `2000`
- **Calamus: Temperature** - Sampling temperature (0 = focused, 2 = creative)
  - Default: `0.7`

## Usage

### Via Command Palette

1. Select text in any document
2. Open the Command Palette (Cmd/Ctrl + Shift + P)
3. Type "Calamus" to see available commands
4. Choose the desired action

### Via Context Menu

1. Select text in any document
2. Right-click on the selection
3. Choose one of the Calamus commands from the context menu

## Commands

- `Calamus: Summarize Text` - Summarizes the selected text
- `Calamus: Improve Text` - Rewrites text to be clearer and better
- `Calamus: Translate Text` - Translates text to your chosen language
- `Calamus: Explain Code/Text` - Provides a detailed explanation

## Requirements

- VSCode version 1.85.0 or higher
- An OpenAI API key
- Internet connection for API calls

## Development

### Building

```bash
npm install
npm run compile
```

### Packaging

```bash
npm run package
```

This creates a `.vsix` file that can be installed in VSCode.

## Privacy & Security

- Your API key is stored in VSCode settings and never transmitted anywhere except to OpenAI's API
- Selected text is sent to OpenAI's API for processing
- Review OpenAI's [privacy policy](https://openai.com/policies/privacy-policy) for details on data handling

## License

MIT

## Support

For issues or feature requests, please visit the [GitHub repository](https://github.com/wmlabtx/calamus).

