# Changelog

All notable changes to the Calamus extension will be documented in this file.

## [0.0.2] - 2025-01-02 - Reworked release

### Architecture & Philosophy
- **Complete Refactor**: The codebase was completely restructured from the initial "vibe-coded" prototype to a robust, maintainable architecture.
- **Development Approach**: AI was strictly utilized as a tool for solving specific isolated problems, debugging, and mechanical refactoring tasks. The core architecture and logic were manually designed to ensure reliability.

### Changed
- **Engine**: Fully migrated from OpenAI to Google Gemini API.
- **Workflow**: Replaced generic menu commands with a streamlined, keyboard-first workflow (`F4`-`F7`).
- **Interaction**: Introduced a non-intrusive "Diff View" (Ghost Text + Strikethrough) allowing users to review changes before accepting them with `Tab`.

## [0.0.1] - 2025-12-30 - Initial Vibe-coding release

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
