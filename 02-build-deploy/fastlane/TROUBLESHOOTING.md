# Fastlane Troubleshooting Guide

## iOS Certificate & Provisioning Profile Issues

### Problem: Certificates not being saved to git repository

**Symptoms:**
- Fastlane Match downloads certificates and installs them locally
- Output shows "✅ iOS profiles committed successfully!"
- But `loyalty-credentials` repository has empty directories:
  - `profiles/appstore/` - empty
  - `profiles/development/` - empty
  - `shared/ios/certs/` - empty
  - `clients/{client-code}/ios/` - doesn't exist

**Root Cause:**
Fastlane cannot access environment variables from `loyalty-compose/.env` because it runs from `loyalty-compose/02-build-deploy/fastlane/`. Without `MATCH_PASSWORD`, Match only downloads/installs locally but doesn't encrypt and commit to git.

**Solution:**
A symbolic link has been created to make `.env` accessible:
```bash
cd loyalty-compose/02-build-deploy/fastlane
ln -sf ../../.env .env
```

**Verification:**
After running `fastlane ios sync_certificates_appstore client:{client-name}`, check:
```bash
cd loyalty-credentials
git log -1  # Should show "Add iOS provisioning profiles"
ls clients/{client-name}/ios/  # Should contain .mobileprovision files
ls profiles/appstore/  # Should contain .mobileprovision files
ls certs/distribution/  # Should contain .cer and .p12 files
```

### Problem: Ruby encoding error with JSON files

**Symptoms:**
```
❌ Error in lane 'sync_certificates_appstore':
"\xC3" on US-ASCII
```

**Root Cause:**
Client `config.json` files contain UTF-8 characters (like "manutenção" with ã/ç), but Ruby defaults to US-ASCII locale.

**Solution:**
Set UTF-8 locale before running Fastlane:
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
fastlane ios sync_certificates_appstore client:final-client
```

**Permanent Fix (optional):**
Add to your `~/.zshrc` or `~/.bash_profile`:
```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
```

### Problem: organize_ios_profiles.rb not committing files

**Symptoms:**
- Script output shows "✅ Copied: {profile-name}"
- But then shows "⚠️ No changes to commit (files already committed)"
- Files were just copied, so there SHOULD be changes

**Root Cause:**
Bug in script logic - `git diff --cached --quiet` returns:
- Exit code 0 (true) when NO changes exist
- Exit code 1 (false) when changes exist

The original code had inverted logic:
```ruby
# WRONG (inverted logic)
has_changes = system("git diff --cached --quiet")
unless has_changes  # This skips when there ARE changes!
```

**Solution:**
Fixed in commit on 2025-11-25:
```ruby
# CORRECT
no_changes = system("git diff --cached --quiet")
if no_changes  # Only skip when there are NO changes
```

## Environment Variables Reference

Required variables in `loyalty-compose/.env`:

```bash
# Match Configuration
MATCH_GIT_URL=git@github.com:devloyaltyhub/loyalty-credentials.git
MATCH_PASSWORD=<your-password>
MATCH_KEYCHAIN_PASSWORD=<your-keychain-password>

# Apple Developer
APPLE_TEAM_ID=<your-team-id>
APPLE_DEVELOPER_EMAIL=<your-email>

# App Store Connect API
APP_STORE_CONNECT_API_KEY_ID=<key-id>
APP_STORE_CONNECT_API_ISSUER_ID=<issuer-id>
APP_STORE_CONNECT_API_KEY=<path-to-AuthKey.p8>

# Fastlane
FASTLANE_USER=<your-email>
FASTLANE_PASSWORD=<app-specific-password>
```

## How .env Loading Works

### Node.js Scripts
Scripts in `loyalty-compose/01-client-setup/cli/` automatically load `.env` via:
```javascript
const { loadEnvWithExpansion } = require('../shared/env-loader');
loadEnvWithExpansion(__dirname);
```

This resolves paths relative to `automation/.env`.

### Fastlane
Fastlane loads `.env` from its working directory. Since Fastlane runs from `fastlane/` subdirectory, a symbolic link provides access:
```
loyalty-compose/02-build-deploy/fastlane/.env -> ../../.env
```

### Shell Scripts
Currently no shell scripts require these environment variables. If needed in future, source manually:
```bash
# In your script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../.env"
```

## Debugging Tips

### Check if .env is loaded
```bash
cd loyalty-compose/02-build-deploy/fastlane
env | grep MATCH_PASSWORD  # Should show the password
```

### Check Match repository status
```bash
cd loyalty-credentials
git status
git log -5  # Recent commits
find . -name "*.mobileprovision"  # All profiles
find . -name "*.p12"  # All certificates
```

### Verbose Fastlane output
```bash
fastlane ios sync_certificates_appstore client:demo --verbose
```

### Test organize script standalone
```bash
cd loyalty-compose/02-build-deploy/fastlane
ruby scripts/organize_ios_profiles.rb
```

## Common Workflow

### First-time setup for a client
```bash
# 1. Set UTF-8 locale
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 2. Sync App Store certificates
cd loyalty-compose/02-build-deploy/fastlane
fastlane ios sync_certificates_appstore client:your-client-name

# 3. Verify in git repository
cd ../../../../loyalty-credentials
git log -1
ls clients/your-client-name/ios/
```

### Re-sync existing certificates
If you need to re-download certificates (e.g., on a new machine):
```bash
# Match readonly mode (just download, don't modify git)
cd loyalty-compose/02-build-deploy/fastlane
fastlane match appstore --readonly

# Or use the sync lane which auto-discovers bundle IDs
fastlane ios sync_certificates_appstore client:your-client-name
```

## Related Files

- [loyalty-compose/.env](../../.env) - Environment variables
- [loyalty-compose/02-build-deploy/fastlane/Matchfile](./Matchfile) - Match configuration
- [loyalty-compose/02-build-deploy/fastlane/Fastfile](./Fastfile) - Lane definitions
- [loyalty-compose/02-build-deploy/fastlane/scripts/organize_ios_profiles.rb](./scripts/organize_ios_profiles.rb) - Profile organization script
- [loyalty-compose/01-client-setup/shared/env-loader.js](../../01-client-setup/shared/env-loader.js) - Node.js env loader

## Support

If you encounter issues not covered here, check:
1. Fastlane logs in `~/Library/Logs/fastlane/`
2. Match documentation: https://docs.fastlane.tools/actions/match/
3. Git status in `loyalty-credentials` repository
