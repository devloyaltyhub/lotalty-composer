#!/usr/local/opt/ruby/bin/ruby
# frozen_string_literal: true

# Script to create APNs Authentication Key (.p8) for push notifications
# This script includes a workaround for the 'scope' parameter issue
# See: https://github.com/fastlane/fastlane/issues/29450
#
# USAGE:
#   APPLE_DEVELOPER_EMAIL=your@email.com ./scripts/create_apns_key.rb
#
# Or with wrapper script:
#   ./scripts/run_apns_script.sh

# Setup gem path to use fastlane's gems
ENV['GEM_HOME'] ||= "#{ENV['HOME']}/.local/share/fastlane/3.4.0"
ENV['GEM_PATH'] = "#{ENV['GEM_HOME']}:/usr/local/Cellar/fastlane/2.229.0/libexec"

require 'spaceship'
require 'fileutils'
require 'json'

# Configuration
KEY_NAME = ENV['APNS_KEY_NAME'] || 'LoyaltyHub Push Key'
# loyalty-credentials is a sibling repo to loyalty-compose, not inside it
# From: 02-build-deploy/scripts/ -> ../../../loyalty-credentials/shared/apns
OUTPUT_DIR = ENV['APNS_OUTPUT_DIR'] || File.expand_path('../../../loyalty-credentials/shared/apns', __dir__)
USERNAME = ENV['APPLE_DEVELOPER_EMAIL']

unless USERNAME
  puts "❌ Error: APPLE_DEVELOPER_EMAIL environment variable is required"
  puts "   Usage: APPLE_DEVELOPER_EMAIL=your@email.com ruby #{$PROGRAM_NAME}"
  exit 1
end

puts "🔔 Creating APNs Authentication Key..."
puts "   Key Name: #{KEY_NAME}"
puts "   Output: #{OUTPUT_DIR}"
puts ""
puts "⚠️  NOTE: APNs Key management requires Apple ID authentication"
puts "   You will be prompted for password and 2FA code"
puts ""

# Login to Apple Developer Portal
puts "   Authenticating as: #{USERNAME}"
Spaceship::Portal.login(USERNAME)

# Get Team ID
team_id = Spaceship::Portal.client.team_id
puts "   Team ID: #{team_id}"

# Check existing keys
puts "   Checking existing APNs keys..."
all_keys = Spaceship::Portal::Key.all
apns_keys = all_keys.select { |k| (k.services rescue []).include?('APNS') }

puts "   Found #{all_keys.length} total key(s), #{apns_keys.length} APNs key(s)"

if apns_keys.length >= 2
  puts ""
  puts "⚠️  You already have #{apns_keys.length} APNs keys (Apple limit is 2)"
  apns_keys.each do |k|
    puts "   - #{k.name} (ID: #{k.id})"
  end
  puts ""
  puts "   To create a new key, you must revoke an existing one first."
  puts "   Use: fastlane revoke_apns_key key_id:XXXXXXXXXX"
  exit 1
end

# Create new APNs key with scope fix
puts ""
puts "   Creating new APNs key: #{KEY_NAME}..."

begin
  # Apple Service IDs (from PR #29458)
  APNS_ID = 'U27F4V844T'

  # Build service config with v2 API format (fix from PR #29458)
  # The v2 API uses serviceConfigurationsRequests array with isNew flag
  service_configs_requests = [
    {
      'isNew' => true,
      'serviceId' => APNS_ID,
      'identifiers' => {},
      'environment' => 'all',
      'scope' => 'team'
    }
  ]

  # Create key using v2 API endpoint directly (bypassing broken spaceship method)
  client = Spaceship::Portal.client

  # Fetch CSRF token first (required for key operations)
  client.send(:fetch_csrf_token_for_keys)

  params = {
    name: KEY_NAME,
    serviceConfigurationsRequests: service_configs_requests,
    teamId: client.team_id
  }

  # Use v2 endpoint
  response = client.send(:request, :post, 'account/auth/key/v2/create') do |req|
    req.headers['Content-Type'] = 'application/json'
    req.body = params.to_json
  end

  parsed = client.send(:parse_response, response, 'keys').first
  new_key = Spaceship::Portal::Key.new(parsed)

  # Download the key (can only be done once!)
  key_content = new_key.download
  key_id = new_key.id

  # Ensure output directory exists
  FileUtils.mkdir_p(OUTPUT_DIR)

  # Save the .p8 file
  key_filename = "AuthKey_#{key_id}.p8"
  key_path = File.join(OUTPUT_DIR, key_filename)
  File.write(key_path, key_content)

  # Update APNS_KEY_INFO.md if it exists
  info_path = File.join(OUTPUT_DIR, 'APNS_KEY_INFO.md')
  if File.exist?(info_path)
    info_content = File.read(info_path)
    info_content.gsub!(/\| \*\*Key File\*\* \| `[^`]*` \|/, "| **Key File** | `#{key_filename}` |")
    info_content.gsub!(/\| \*\*Key ID\*\* \| `[^`]*` \|/, "| **Key ID** | `#{key_id}` |")
    info_content.gsub!(/\| \*\*Team ID\*\* \| `[^`]*` \|/, "| **Team ID** | `#{team_id}` |")
    info_content.gsub!(/\| \*\*Created\*\* \| [^\|]* \|/, "| **Created** | #{Time.now.strftime('%Y-%m-%d')} |")
    info_content.gsub!(/\| \*\*Uploaded to Firebase\*\* \| \[.\] [^\|]* \|/, "| **Uploaded to Firebase** | [ ] Not yet |")
    File.write(info_path, info_content)
    puts "   ✓ Updated APNS_KEY_INFO.md"
  end

  puts ""
  puts "✅ APNs Key created successfully!"
  puts ""
  puts "   📁 Key File: #{key_path}"
  puts "   🔑 Key ID: #{key_id}"
  puts "   👥 Team ID: #{team_id}"
  puts ""
  puts "⚠️  IMPORTANT: This key can only be downloaded ONCE!"
  puts "   Make sure to backup the .p8 file securely."
  puts ""
  puts "📋 Next step: Upload to Firebase Console"
  puts "   https://console.firebase.google.com/project/loyalty-hub-1f47c/settings/cloudmessaging"
  puts ""
  puts "   When uploading, use:"
  puts "   - Key ID: #{key_id}"
  puts "   - Team ID: #{team_id}"

rescue => e
  puts ""
  puts "❌ Failed to create APNs key: #{e.message}"

  if e.message.include?("maximum number")
    puts "   Apple allows maximum 2 APNs keys per account"
    puts "   Revoke an existing key first"
  end

  puts ""
  puts "Debug info:"
  puts e.backtrace.first(5).join("\n")
  exit 1
end
