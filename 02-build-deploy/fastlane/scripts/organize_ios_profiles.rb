#!/usr/bin/env ruby

# Organize iOS Provisioning Profiles by Client
# This script moves provisioning profiles from Match's default location
# to the client-specific folders in loyalty-credentials

require 'fileutils'
require 'json'
require 'time'

# Configuration
# From: 02-build-deploy/fastlane/scripts/ -> ../../../../loyalty-credentials
LOYALTY_CREDENTIALS_PATH = File.expand_path('../../../../loyalty-credentials', __dir__)
MATCH_PROFILES_PATH = File.join(LOYALTY_CREDENTIALS_PATH, 'profiles')
CLIENTS_PATH = File.expand_path('../../../clients', __dir__)

# Dynamically discover clients and their bundle IDs from config.json files
def discover_client_bundle_ids
  client_bundle_ids = {}

  return client_bundle_ids unless Dir.exist?(CLIENTS_PATH)

  Dir.glob(File.join(CLIENTS_PATH, '*', 'config.json')).each do |config_file|
    begin
      config = JSON.parse(File.read(config_file))
      client_code = config['clientCode']
      bundle_id = config['bundleId']

      if client_code && bundle_id
        client_bundle_ids[client_code] = bundle_id
      end
    rescue => e
      # Skip invalid config files
      puts "⚠️  Warning: Could not parse #{config_file}: #{e.message}"
    end
  end

  client_bundle_ids
end

CLIENT_BUNDLE_IDS = discover_client_bundle_ids

def organize_profiles
  puts "\n📁 Organizing iOS provisioning profiles by client..."
  puts "=" * 50

  # Show discovered clients
  if CLIENT_BUNDLE_IDS.empty?
    puts "⚠️  No clients found in #{CLIENTS_PATH}"
    puts "   Make sure clients have config.json files with clientCode and bundleId"
    return
  end

  puts "✓ Discovered #{CLIENT_BUNDLE_IDS.length} client(s):"
  CLIENT_BUNDLE_IDS.each { |code, id| puts "  - #{code}: #{id}" }
  puts ""

  unless Dir.exist?(MATCH_PROFILES_PATH)
    puts "⚠️  Match profiles directory not found: #{MATCH_PROFILES_PATH}"
    puts "   Run 'fastlane match' first to generate profiles"
    return
  end

  copied_files = []

  # Process each client
  CLIENT_BUNDLE_IDS.each do |client_code, bundle_id|
    client_ios_dir = File.join(LOYALTY_CREDENTIALS_PATH, 'clients', client_code, 'ios')

    # Create client iOS directory if it doesn't exist
    FileUtils.mkdir_p(client_ios_dir) unless Dir.exist?(client_ios_dir)

    puts "\n📱 Processing client: #{client_code}"
    puts "   Bundle ID: #{bundle_id}"

    # Find all profiles for this bundle ID
    profile_pattern = "**/*#{bundle_id}*.mobileprovision"
    profiles = Dir.glob(File.join(MATCH_PROFILES_PATH, profile_pattern))

    if profiles.empty?
      puts "   ⚠️  No profiles found for #{bundle_id}"
      next
    end

    # Copy each profile to client directory
    profiles.each do |profile_path|
      profile_name = File.basename(profile_path)
      dest_path = File.join(client_ios_dir, profile_name)

      FileUtils.cp(profile_path, dest_path)
      puts "   ✅ Copied: #{profile_name}"

      # Track copied file for git commit
      copied_files << {
        client_code: client_code,
        profile_name: profile_name,
        relative_path: "clients/#{client_code}/ios/#{profile_name}"
      }
    end
  end

  puts "\n✅ Profile organization complete!"
  puts "=" * 50

  # Commit organized profiles to git
  commit_profiles(copied_files) unless copied_files.empty?
end

def commit_profiles(copied_files)
  puts "\n🔐 Committing iOS profiles to loyalty-credentials..."
  puts "=" * 50

  begin
    # Check if git is initialized
    unless system("cd #{LOYALTY_CREDENTIALS_PATH} && git rev-parse --git-dir > /dev/null 2>&1")
      puts "⚠️  Git not initialized in loyalty-credentials"
      return
    end

    # Group files by client
    clients = copied_files.group_by { |f| f[:client_code] }

    clients.each do |client_code, files|
      puts "\n📱 Committing profiles for client: #{client_code}"

      # Stage iOS profile files for this client
      ios_path = "clients/#{client_code}/ios"
      system("cd #{LOYALTY_CREDENTIALS_PATH} && git add #{ios_path}/*")

      # Check if there are changes to commit
      # git diff --cached --quiet returns 0 (true) when NO changes, 1 (false) when there ARE changes
      no_changes = system("cd #{LOYALTY_CREDENTIALS_PATH} && git diff --cached --quiet #{ios_path}")

      if no_changes
        puts "   ⚠️  No changes to commit (files already committed)"
        next
      end

      # Get client name from first file (or use client_code as fallback)
      client_name = client_code.split('-').map(&:capitalize).join(' ')

      # Create commit message
      commit_message = "Add iOS provisioning profiles for #{client_name} (#{client_code})

- Generated provisioning profiles via Fastlane Match
- Profiles for bundle ID: #{CLIENT_BUNDLE_IDS[client_code]}
- #{files.length} profile(s) added

Files:
#{files.map { |f| "- #{f[:profile_name]}" }.join("\n")}

Generated: #{Time.now.utc.iso8601}"

      # Escape commit message for shell
      escaped_message = commit_message.gsub('"', '\\"').gsub("\n", "\\n")

      # Create commit
      if system("cd #{LOYALTY_CREDENTIALS_PATH} && git commit -m \"#{escaped_message}\"")
        puts "   ✅ Profiles committed locally"

        # Try to push to remote
        if system("cd #{LOYALTY_CREDENTIALS_PATH} && git remote > /dev/null 2>&1")
          puts "\n   Pushing to remote..."
          if system("cd #{LOYALTY_CREDENTIALS_PATH} && git push")
            puts "   ✅ Profiles pushed to remote"
          else
            puts "   ⚠️  Failed to push to remote"
            puts "      You can push manually later: cd loyalty-credentials && git push"
          end
        else
          puts "\n   ⚠️  No git remote configured"
          puts "      Add remote: cd loyalty-credentials && git remote add origin <url>"
        end
      else
        puts "   ⚠️  Failed to create commit"
      end
    end

    puts "\n✅ iOS profiles committed successfully!"
    puts "=" * 50

  rescue => error
    puts "\n❌ Failed to commit iOS profiles: #{error.message}"
    puts "\n   You can commit manually:"
    puts "   cd #{LOYALTY_CREDENTIALS_PATH}"
    puts "   git add clients/*/ios/"
    puts "   git commit -m \"Add iOS provisioning profiles\""
    puts "   git push"
  end
end

# Run if called directly
if __FILE__ == $0
  organize_profiles
end
