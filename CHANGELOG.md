# Changelog

All notable changes to the Calamus extension will be documented in this file.

## [0.0.2] - 2025-01-XX

### Changed
- Updated version to 0.0.2

## [0.1.0] - 2025-01-XX

### Changed
- **BREAKING**: Replaced OpenAI API with Google Gemini API
- Complete rewrite of extension architecture
- Removed manual commands (Summarize, Improve, Translate, Explain)
- Changed from command-based to automatic real-time features

### Added
- **Real-time Diagnostics**: Automatic spell check, grammar check, and style suggestions with visual underlines
- **Code Actions**: Quick fix suggestions with lightbulb icon (💡) - press `Ctrl+.` to see fixes
- **Inline Completions**: Ghost text suggestions that appear as you type (like GitHub Copilot)
- **Intelligent Caching**: SHA-256 based caching system to avoid redundant API calls
- **Debouncing**: Configurable delay to prevent excessive API requests during typing
- **Paragraph-based Analysis**: Only analyzes changed paragraphs, not entire documents
- **Configurable Prompts**: Customize both diagnostic and completion prompts
- **Token Optimization**: Multiple strategies to minimize API costs

### Configuration Changes
- `calamus.apiKey`: Now requires Gemini API key (not OpenAI)
- `calamus.model`: Changed to Gemini models (gemini-1.5-pro, gemini-1.5-flash, gemini-pro)
- Removed: `calamus.maxTokens`, `calamus.temperature`
- Added: `calamus.checkPrompt`, `calamus.completionPrompt`, `calamus.debounceDelay`, `calamus.enableDiagnostics`, `calamus.enableCompletions`, `calamus.maxContextLength`

### Technical Improvements
- TypeScript modules: `geminiManager.ts`, `diagnosticsProvider.ts`, `codeActionsProvider.ts`, `inlineCompletionProvider.ts`
- Better error handling and user feedback
- Automatic cache invalidation on text changes
- Support for all file types (configurable via patterns)

## [0.0.1] - 2025-12-30

### Added
- Initial release of Calamus AI Text Assistant
- Four main AI-powered commands:
  - Summarize Text: Create concise summaries
  - Improve Text: Enhance writing quality and clarity
  - Translate Text: Translate to 11 languages
  - Explain Code/Text: Get detailed explanations
- OpenAI API integration with configurable models
- Context menu integration for selected text
- Command Palette commands
- Configurable settings:
  - API Key
  - AI Model selection (gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo)
  - Max Tokens
  - Temperature
- Comprehensive documentation
- MIT License
