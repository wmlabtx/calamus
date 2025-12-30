# Contributing to Calamus

Thank you for your interest in contributing to Calamus!

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open the project in VSCode
4. Press F5 to launch the Extension Development Host

## Building

To compile the TypeScript code:
```bash
npm run compile
```

To watch for changes:
```bash
npm run watch
```

## Testing

Currently, the extension doesn't have automated tests. Manual testing is performed by:
1. Running the extension in Development Host (F5)
2. Testing each command with various text selections
3. Verifying configuration changes take effect

## Packaging

To create a VSIX package:
```bash
npm run package
```

## Code Style

- Use TypeScript strict mode
- Follow existing code formatting
- Add comments for complex logic
- Keep functions focused and small

## Pull Request Process

1. Update the CHANGELOG.md with your changes
2. Update documentation if needed
3. Ensure the code compiles without errors
4. Test your changes thoroughly
5. Create a pull request with a clear description

## Ideas for Contributions

- Add more AI commands (fix grammar, make formal/casual, etc.)
- Support for other AI providers (Anthropic, Google, etc.)
- Add automated tests
- Improve error handling
- Add inline diff view for changes
- Add undo/redo functionality
- Support for streaming responses
- Add rate limiting and caching

## Questions?

Feel free to open an issue for any questions or discussions.
