# Intent Chrome Extension

## What it does
Capture why a user saved something, not just the content, via shortcut or quick input, classify with LLM, and display in a popup UI.

## Prerequisites
| Variable | Version |
|----------|---------|
| Node.js | >=18 |
| npm | >=9 |
| Chrome | >=119 (MV3 support) |
| LM Studio (optional) | any recent release |

## Quick start
```bash
# Install dependencies
npm install

# Load unpacked extension in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked" and select this project folder
```

## Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `intentSettings.provider` | `"anthropic"` | LLM provider (`"anthropic"` or `"local"`). |
| `intentSettings.apiKey` | `""` | API key for Anthropic (if provider is Anthropic). |
| `intentSettings.model` | `"claude-sonnet-4-6"` | Model identifier used for classification. |

## Development
```bash
# Lint the source files
npx eslint src/

# Run the extension (manual testing)
# Open chrome://extensions, reload the extension after changes.
```

## Deployment
Package the extension directory and upload via the Chrome Web Store Developer Dashboard. Ensure icons of required sizes are present in the `icons/` folder and bump the `version` in `manifest.json`.
