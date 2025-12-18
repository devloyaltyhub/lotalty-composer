# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**loyalty-compose** is the standalone automation system for managing Loyalty Hub white-label clients. It handles client setup, Firebase project creation, build automation, and deployment to app stores.

## Project Structure

```
loyalty-compose/
├── 01-client-setup/       # Client creation and configuration
│   ├── cli/               # Interactive CLI tools
│   ├── steps/             # Setup workflow steps
│   ├── templates/         # Client config templates
│   └── shared/            # Shared setup utilities
├── 02-build-deploy/       # Build and deployment automation
│   ├── cli/               # Build/deploy CLI tools
│   ├── fastlane/          # Fastlane configuration (iOS/Android)
│   ├── scripts/           # Shell scripts for builds
│   ├── screenshots/       # Screenshot generation
│   └── metadata_templates/# App store metadata
├── 03-data-management/    # Data export/import tools
│   └── cli/               # Data management CLI
├── cli/                   # Core CLI utilities
│   ├── classes.js         # CLI class definitions
│   └── config.js          # CLI configuration
├── shared/                # Shared utilities
│   ├── shared_assets/     # Animations, images by business type
│   ├── templates/         # Gradle, Firestore rules templates
│   ├── utils/             # Helper utilities
│   └── validators/        # Asset and file validators
└── __tests__/             # Jest test suites
```

## Essential Commands

### Main CLI
```bash
npm run loyalty              # Main interactive CLI
```

### Client Management
```bash
npm run create-client        # Create new white-label client
npm run update-client        # Update existing client
npm run verify-client        # Verify client configuration
npm run rollback-client      # Rollback client changes
npm run start                # Setup white-label for selected client
npm run reset-to-dev         # Reset to demo environment
```

### Build & Deploy
```bash
npm run build-only           # Build without deploying
npm run deploy               # Full build and deploy
npm run screenshots          # Generate app store screenshots (mobile app)
npm run screenshots-admin    # Generate screenshots for Admin (Android)
npm run update-screenshots   # Update existing screenshots
npm run deploy-admin         # Deploy Admin to Google Play Store
npm run build-admin          # Build Admin Android (no deploy)
npm run deploy-admin-web     # Deploy Admin Web to GitHub Pages
```

### Version Management
```bash
npm run increment-build      # Increment build number
npm run bump-patch           # Bump patch version (0.0.X)
npm run bump-minor           # Bump minor version (0.X.0)
npm run bump-major           # Bump major version (X.0.0)
```

### Shorebird OTA Updates
```bash
npm run shorebird            # Interactive Shorebird menu
npm run shorebird:release    # Create new release
npm run shorebird:patch      # Create OTA patch (no store review)
```

### Code Quality
```bash
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint issues
npm run format:check         # Check Prettier formatting
npm run format:write         # Apply Prettier formatting
npm run perfect-code         # Run all quality checks
```

### Testing
```bash
npm test                     # Run all tests
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests only
npm run test:coverage        # Tests with coverage
npm run test:watch           # Watch mode
```

### Asset Optimization
```bash
npm run validate-assets      # Validate client assets
npm run check-unused-files   # Find unused files
npm run optimize:assets      # Optimize Lottie and SVG files
npm run minify:animations    # Minify Lottie animations
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

### Required
- `MASTER_FIREBASE_PROJECT_ID` - Master Firebase project
- `MASTER_FIREBASE_SERVICE_ACCOUNT` - Path to service account JSON
- `GOOGLE_APPLICATION_CREDENTIALS` - GCloud service account for project creation
- `GOOGLE_PLAY_JSON_KEY` - Play Store service account

### iOS Deployment
- `APP_STORE_CONNECT_API_KEY_ID` - App Store Connect API key ID
- `APP_STORE_CONNECT_API_ISSUER_ID` - API issuer ID
- `APP_STORE_CONNECT_API_KEY` - Path to .p8 key file
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `MATCH_GIT_URL` - Git repo for Fastlane Match
- `MATCH_PASSWORD` - Match encryption password

### Optional
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` - Deployment notifications

**Note:** Credential paths are relative to `loyalty-compose/` directory. Credentials are stored in the sibling `loyalty-credentials/` repository.

## Fastlane Integration

Located in `02-build-deploy/fastlane/`:

```bash
# Android
bundle exec fastlane android build
bundle exec fastlane android deploy_internal

# iOS
bundle exec fastlane ios build
bundle exec fastlane ios deploy_testflight

# Both platforms
bundle exec fastlane build_all
```

## Integration with Other Projects

This automation system works with:
- **loyalty-app/white_label_app/** - Target Flutter app for builds
- **loyalty-credentials/** - Certificates and service accounts
- **Master Firebase** - Stores client configurations

## Guidelines

- **Systemic solutions**: Fix root causes in scripts, not just symptoms in files
- **Test changes**: Run `npm run verify-client` after modifications
- **Validate assets**: Run `npm run validate-assets` before builds
- **Keep credentials secure**: Never commit `.env`, use `loyalty-credentials/` repo
