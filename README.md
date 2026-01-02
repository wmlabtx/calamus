# Calamus - AI Text Assistant for VS Code & Cursor

A powerful VS Code and Cursor extension that brings AI-powered text editing features directly to your text documents using Google Gemini. Features real-time spell checking, grammar correction, style suggestions, and intelligent text completions.

## Features

### Real-time Diagnostics
- **Spell Check**: Automatically detects spelling errors with red underlines
- **Grammar Check**: Identifies grammatical mistakes and style issues
- **Style Suggestions**: Highlights awkward phrases and suggests improvements

### Quick Fixes
- **Code Actions**: Click the lightbulb icon (💡) or press `Ctrl+.` to see suggested fixes
- **One-click Fixes**: Apply corrections instantly with a single click

### Intelligent Completions
- **Ghost Text**: See gray text suggestions that complete your thoughts as you type
- **Context-aware**: Understands the context of your writing for better suggestions
- **Debounced**: Smart request throttling to save API tokens

### Token Optimization
- **Caching**: Remembers analyzed text to avoid redundant API calls
- **Paragraph-based Analysis**: Only checks changed paragraphs, not entire documents
- **Configurable Delays**: Adjust debounce timing to balance responsiveness and cost

## Installation

### Prerequisites
- Node.js (v16 or higher)
- Visual Studio Code (v1.105.0 or higher) or Cursor
- Google Gemini API Key ([Get one here](https://makersuite.google.com/app/apikey))

### Development Setup

1. **Clone the repository**
```powershell
git clone https://github.com/wmlabtx/calamus.git
cd calamus
```

2. **Install dependencies**
```powershell
npm install
```

3. **Build the extension**
```powershell
npm run compile
```

4. **Test the extension**
   - Press `F5` in VSCode to launch the Extension Development Host
   - Open a text file (`.txt`, `.md`, etc.)
   - Start typing to see diagnostics and completions in action

### Package and Install

1. **Package the extension**
```powershell
npm run package
```
This creates a `.vsix` file in the `vsix` subfolder.

2. **Install the packaged extension**

**For VS Code:**
```powershell
code --install-extension vsix\calamus-0.0.2.vsix
```

**For Cursor:**
```powershell
cursor --install-extension vsix\calamus-0.0.2.vsix
```

**Or manually (works for both VS Code and Cursor):**
- Open VS Code or Cursor
- Open Command Palette (`Ctrl+Shift+P` or `F1`)
- Type "Install from VSIX..." and select it
- Choose the `.vsix` file from the `vsix` folder

## Configuration

Before using Calamus, configure your Gemini API key:

1. Open VSCode Settings (`File > Preferences > Settings` or `Ctrl+,`)
2. Search for "Calamus"
3. Enter your Gemini API Key in the `Calamus: Api Key` field
   - Get an API key at [Google AI Studio](https://makersuite.google.com/app/apikey)

### Available Settings

- **Calamus: Api Key** - Your Google Gemini API key (required)
- **Calamus: Model** - Choose the AI model
  - Options: `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-pro`
  - Default: `gemini-1.5-flash`
- **Calamus: Check Prompt** - Custom prompt for text checking
  - Default: Analyzes text for spelling, grammar, and style errors
- **Calamus: Completion Prompt** - Custom prompt for text completions
  - Default: Provides natural text continuation
- **Calamus: Debounce Delay** - Delay in milliseconds before sending request after typing stops
  - Range: 300-3000ms
  - Default: `800ms`
- **Calamus: Enable Diagnostics** - Enable/disable real-time text diagnostics
  - Default: `true`
- **Calamus: Enable Completions** - Enable/disable inline text completions
  - Default: `true`
- **Calamus: Max Context Length** - Maximum characters of context to send for completions
  - Range: 100-5000 characters
  - Default: `1000`

## Usage

### Automatic Features

Once configured, Calamus works automatically:

1. **Open any text file** (`.txt`, `.md`, `.rst`, etc.)
2. **Start typing** - Diagnostics appear automatically with red/yellow underlines
3. **Hover over underlined text** - See the error message in a tooltip
4. **Apply fixes** - Use one of these methods:
   - **Method 1 (Recommended)**: Right-click on the underlined word → Select "Apply Fix" from the context menu
   - **Method 2**: Open Command Palette (`Ctrl+Shift+P`) → Type "Calamus: Quick Fix" → Press Enter
   - **Method 3**: Use VS Code's built-in Quick Fix:
     - Place cursor on the error
     - Press `F8` to see problems, then `Ctrl+.` for Quick Fix menu
     - Or use Command Palette → "Quick Fix" (`Ctrl+Shift+P` → "Quick Fix")
5. **See the suggestion** - You'll see options like "Replace 'discusss' with 'discuss'"
6. **Apply the fix** - Click on the suggestion or press Enter to apply it automatically
7. **Continue typing** - See gray ghost text suggestions for completions
8. **Press `Tab`** - Accept the ghost text suggestion

### Manual Commands

- `Calamus: Fix Issue` - Manually trigger fix for current diagnostic (available in context menu)

## How It Works

### Diagnostics Flow
1. User types in a document
2. Extension waits for typing to stop (debounce delay)
3. Text is split into paragraphs
4. Each paragraph is checked against cache (SHA-256 hash)
5. Uncached paragraphs are sent to Gemini API
6. Results are parsed and displayed as diagnostics
7. Cache is updated for future use

### Completions Flow
1. User pauses while typing
2. Extension captures context (last 1000 characters by default)
3. Context is checked against cache
4. If not cached, request is sent to Gemini
5. Ghost text appears showing continuation
6. User can accept with `Tab` or ignore

### Caching Strategy
- Uses SHA-256 hashing of text + prompt type
- Cache persists for the session
- Automatically invalidated when text changes
- Separate caches for diagnostics and completions

## Development

### Project Structure
```
calamus/
├── src/
│   ├── extension.ts              # Main extension entry point
│   ├── geminiManager.ts          # Gemini API client with caching
│   ├── diagnosticsProvider.ts    # Real-time diagnostics
│   ├── codeActionsProvider.ts    # Quick fix actions
│   └── inlineCompletionProvider.ts # Ghost text completions
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # This file
```

### Building

```powershell
npm run compile
```

### Watching for Changes

```powershell
npm run watch
```

### Packaging

```powershell
npm run package
```

## Requirements

- VS Code version 1.105.0 or higher, or Cursor
- A Google Gemini API key
- Internet connection for API calls

## Privacy & Security

- Your API key is stored in VS Code/Cursor settings and never transmitted anywhere except to Google's Gemini API
- Text is sent to Gemini API for processing
- Caching is done locally in memory (not persisted to disk)
- Review Google's [privacy policy](https://policies.google.com/privacy) for details on data handling

## Token Usage & Cost Optimization

Calamus is designed to minimize API costs:

- **Caching**: Identical text blocks are never analyzed twice in the same session
- **Paragraph-based**: Only changed paragraphs are re-analyzed
- **Debouncing**: Prevents excessive API calls during rapid typing
- **Context Limiting**: Completions use only the last N characters (configurable)

For free tier Gemini API:
- 15 requests per minute limit
- With caching and debouncing, this is typically sufficient for normal writing

## Troubleshooting

### Viewing Debug Output

Calamus includes comprehensive debug logging. To view debug information, use one of these methods:

**Method 1: Command Palette (Recommended)**
1. Press `Ctrl+Shift+P` (or `F1`) to open Command Palette
2. Type "Calamus: Show Calamus Output" and select it
3. The Output panel will open with Calamus logs

**Method 2: Output Panel**
1. Open the Output panel: `View > Output` or press `Ctrl+Shift+U`
2. Look for "Calamus" in the dropdown at the top right of the Output panel
   - **Note**: The Output Channel appears in the dropdown only after the extension has been activated and written to it
   - If you don't see "Calamus" in the list, try:
     - Typing something in a text file (this activates the extension)
     - Using Method 1 (Command Palette) - this will create/show the channel
     - Reloading the window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. The panel will show:
   - Extension activation status
   - Document change events
   - API requests and responses
   - Cache hits/misses
   - Error messages with stack traces
   - Diagnostic processing steps

The debug output is automatically shown when the extension activates, but you can always open it manually to troubleshoot issues.

### Diagnostics not appearing
- Check that `Calamus: Enable Diagnostics` is set to `true`
- Verify your API key is configured correctly in settings
- Check the Output panel (select "Calamus") for error messages
- Ensure you're editing a file (not untitled document)
- Wait for the debounce delay (default 800ms) after typing stops
- Check if the document scheme is "file" (not "untitled" or other schemes)

### Completions not working
- Check that `Calamus: Enable Completions` is set to `true`
- Ensure you're typing in a text file (not a code file, unless configured)
- Try increasing `Calamus: Debounce Delay` if requests are being throttled
- Check the Output panel for completion-related messages
- Make sure you've typed at least 5 characters on the current line

### API Errors
- Verify your API key is valid and has quota remaining
- Check your internet connection
- Review the Output panel for detailed error messages and stack traces
- Common errors:
  - **"Gemini API key is not configured"** - Set `calamus.apiKey` in settings
  - **"API quota exceeded" (429 error)** - Your free tier quota has been exceeded
    - Check your quota at: https://ai.dev/usage?tab=rate-limit
    - Free tier has limited requests per day/minute
    - The extension will automatically retry when quota resets
    - Consider upgrading your API plan for higher limits
    - Reduce usage by increasing `debounceDelay` or disabling features temporarily
  - **Network errors** - Check your internet connection
  - **Model not found (404)** - The selected model may not be available, try a different model

## License

MIT

## Support

For issues or feature requests, please visit the [GitHub repository](https://github.com/wmlabtx/calamus).
