fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

### build_all

```sh
[bundle exec] fastlane build_all
```

Build both Android and iOS

### deploy_all_testing

```sh
[bundle exec] fastlane deploy_all_testing
```

Deploy to internal/testing tracks for both platforms

### release_all_testing

```sh
[bundle exec] fastlane release_all_testing
```

Build and deploy to testing tracks for both platforms

### increment_build

```sh
[bundle exec] fastlane increment_build
```

Increment build number

### validate_assets

```sh
[bundle exec] fastlane validate_assets
```

Validate assets

### clean

```sh
[bundle exec] fastlane clean
```

Clean project

### screenshots

```sh
[bundle exec] fastlane screenshots
```

Generate screenshots for app stores

### frameit_screenshots

```sh
[bundle exec] fastlane frameit_screenshots
```

Apply device frames to screenshots

### screenshots_complete

```sh
[bundle exec] fastlane screenshots_complete
```

Generate and frame screenshots in one command

### shorebird_release

```sh
[bundle exec] fastlane shorebird_release
```

Criar release Shorebird (para submissão na store)

### shorebird_patch

```sh
[bundle exec] fastlane shorebird_patch
```

Criar patch Shorebird (correção OTA sem passar pela store)

### shorebird_releases

```sh
[bundle exec] fastlane shorebird_releases
```

Listar releases Shorebird

### shorebird_patches

```sh
[bundle exec] fastlane shorebird_patches
```

Listar patches de um release Shorebird

### create_apns_key

```sh
[bundle exec] fastlane create_apns_key
```

Create APNs Authentication Key (.p8) for push notifications

### list_apns_keys

```sh
[bundle exec] fastlane list_apns_keys
```

List existing APNs keys in Apple Developer account

### revoke_apns_key

```sh
[bundle exec] fastlane revoke_apns_key
```

Revoke an APNs key

----


## Android

### android build

```sh
[bundle exec] fastlane android build
```

Build Android release AAB (uses Shorebird if configured)

### android deploy_internal

```sh
[bundle exec] fastlane android deploy_internal
```

Deploy Android app to Play Store (Internal Testing)

### android deploy_production

```sh
[bundle exec] fastlane android deploy_production
```

Deploy Android app to Play Store (Production)

### android release_internal

```sh
[bundle exec] fastlane android release_internal
```

Build and deploy Android to Internal Testing

### android release_production

```sh
[bundle exec] fastlane android release_production
```

Build and deploy Android to Production

### android upload_metadata_only

```sh
[bundle exec] fastlane android upload_metadata_only
```

Upload apenas metadata/screenshots para Play Store (sem build)

### android promote_to_production

```sh
[bundle exec] fastlane android promote_to_production client:na-rede version_code:5
```

Promover build existente do Internal Testing para Production (sem nova build)

----


## iOS

### ios register_app

```sh
[bundle exec] fastlane ios register_app
```

Register app in Apple Developer Portal and App Store Connect

### ios sync_certificates_dev

```sh
[bundle exec] fastlane ios sync_certificates_dev
```

Sync iOS certificates and provisioning profiles (Development)

### ios sync_certificates_appstore

```sh
[bundle exec] fastlane ios sync_certificates_appstore
```

Sync iOS certificates and provisioning profiles (App Store)

### ios add_device

```sh
[bundle exec] fastlane ios add_device
```

Register a new device for development

### ios setup_signing

```sh
[bundle exec] fastlane ios setup_signing
```

Setup code signing for build

### ios build

```sh
[bundle exec] fastlane ios build
```

Build iOS release IPA (uses Shorebird if configured)

### ios deploy_testflight

```sh
[bundle exec] fastlane ios deploy_testflight
```

Deploy iOS app to TestFlight

### ios deploy_appstore

```sh
[bundle exec] fastlane ios deploy_appstore
```

Deploy iOS app to App Store

### ios release_testflight

```sh
[bundle exec] fastlane ios release_testflight
```

Build and deploy iOS to TestFlight

### ios release_appstore

```sh
[bundle exec] fastlane ios release_appstore
```

Build and deploy iOS to App Store

### ios upload_metadata_only

```sh
[bundle exec] fastlane ios upload_metadata_only
```

Upload apenas metadata/screenshots para App Store (sem build)

### ios submit_existing_build

```sh
[bundle exec] fastlane ios submit_existing_build
```

Submeter build existente do TestFlight para App Store (sem nova build)

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
