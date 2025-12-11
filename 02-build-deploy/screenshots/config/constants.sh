#!/bin/bash

#############################################
# Shared Constants for Screenshot Automation
#
# This file centralizes all magic numbers and
# shared constants used across screenshot scripts.
#
# Usage: source automation/screenshots/config/constants.sh
#############################################

# ==================================
# COLORS
# ==================================
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_MAGENTA='\033[0;35m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_NC='\033[0m'  # No Color

# ==================================
# FILE SYSTEM
# ==================================
readonly SCREENSHOT_FIND_MAXDEPTH=1
readonly SCREENSHOT_PATTERN="0*.png"
readonly TEMP_DIR="/tmp"

# ==================================
# TIMING (in seconds)
# ==================================
readonly SIMULATOR_BOOT_WAIT_SECONDS=3
readonly SCREENSHOT_PROCESSING_DELAY=0.5

# ==================================
# DEVICE CHOICES
# ==================================
readonly DEVICE_CHOICE_IPHONE=1
readonly DEVICE_CHOICE_ANDROID=2

# Device names
readonly DEVICE_IPHONE_15_PRO_MAX="iPhone 15 Pro Max"
readonly DEVICE_PIXEL_8_PRO="Pixel 8 Pro"

# ==================================
# GRADIENT CHOICES
# ==================================
readonly GRADIENT_PREMIUM_PURPLE=1
readonly GRADIENT_OCEAN_BLUE=2
readonly GRADIENT_SUNSET_ORANGE=3
readonly GRADIENT_FRESH_GREEN=4
readonly GRADIENT_DARK_PURPLE=5
readonly GRADIENT_BOLD_RED_PINK=6

# ==================================
# ROTATION ANGLES (degrees)
# ==================================
readonly ROTATION_SUBTLE=15
readonly ROTATION_MODERATE=20
readonly ROTATION_PRONOUNCED=25

# Rotation choices
readonly ROTATION_CHOICE_SUBTLE=1
readonly ROTATION_CHOICE_MODERATE=2
readonly ROTATION_CHOICE_PRONOUNCED=3

# ==================================
# CANVAS DIMENSIONS
# ==================================
readonly CANVAS_WIDTH=2000
readonly CANVAS_HEIGHT=3500

# ==================================
# SHADOW SETTINGS
# ==================================
readonly SHADOW_BLUR=70
readonly SHADOW_SPREAD=35
readonly SHADOW_OFFSET_X_ADDITION=10  # Added to rotation angle
readonly SHADOW_OFFSET_Y=40

# ==================================
# PERSPECTIVE TRANSFORM
# ==================================
readonly PERSPECTIVE_TOP_MULTIPLIER=3
readonly PERSPECTIVE_BOTTOM_MULTIPLIER=4

# ==================================
# DEFAULT CHOICES
# ==================================
readonly DEFAULT_PLATFORM="ios"
readonly DEFAULT_GRADIENT_CHOICE=$GRADIENT_PREMIUM_PURPLE
readonly DEFAULT_ROTATION_CHOICE=$ROTATION_CHOICE_MODERATE
readonly DEFAULT_DEVICE_CHOICE=$DEVICE_CHOICE_IPHONE
