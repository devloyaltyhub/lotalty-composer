#!/bin/bash

#############################################
# Shared Bash Utilities for Screenshot Automation
#
# This file contains reusable functions used across
# multiple screenshot automation scripts.
#
# Usage: source automation/screenshots/core/bash_utils.sh
#############################################

# Source constants
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../config/constants.sh"

# ==================================
# DISPLAY FUNCTIONS
# ==================================

print_banner() {
    local title="${1:-App Store Screenshot Automation}"
    local subtitle="${2:-Fully Automated Workflow}"

    echo ""
    echo -e "${COLOR_MAGENTA}╔════════════════════════════════════════════╗${COLOR_NC}"
    echo -e "${COLOR_MAGENTA}║   📱  $title  📱   ║${COLOR_NC}"
    echo -e "${COLOR_MAGENTA}║          $subtitle          ║${COLOR_NC}"
    echo -e "${COLOR_MAGENTA}╚════════════════════════════════════════════╝${COLOR_NC}"
    echo ""
}

print_section() {
    local title="$1"
    echo ""
    echo -e "${COLOR_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR_NC}"
    echo -e "${COLOR_BLUE}$title${COLOR_NC}"
    echo -e "${COLOR_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLOR_NC}"
    echo ""
}

print_success() {
    echo -e "${COLOR_GREEN}✅ $1${COLOR_NC}"
}

print_error() {
    echo -e "${COLOR_RED}❌ $1${COLOR_NC}"
}

print_warning() {
    echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_NC}"
}

print_info() {
    echo -e "${COLOR_CYAN}ℹ️  $1${COLOR_NC}"
}

print_step() {
    local current=$1
    local total=$2
    local description=$3
    echo -e "${COLOR_YELLOW}[$current/$total]${COLOR_NC} $description"
}

# ==================================
# FILE SYSTEM FUNCTIONS
# ==================================

count_screenshots() {
    local directory="$1"
    local pattern="${2:-$SCREENSHOT_PATTERN}"

    find "$directory" -maxdepth "$SCREENSHOT_FIND_MAXDEPTH" -name "$pattern" 2>/dev/null | wc -l | tr -d ' '
}

list_screenshots() {
    local directory="$1"
    local pattern="${2:-$SCREENSHOT_PATTERN}"

    find "$directory" -maxdepth "$SCREENSHOT_FIND_MAXDEPTH" -name "$pattern" 2>/dev/null | sort
}

ensure_directory() {
    local directory="$1"

    if [ ! -d "$directory" ]; then
        mkdir -p "$directory"
        print_success "Created directory: $directory"
    fi
}

clean_directory() {
    local directory="$1"
    local pattern="${2:-*}"

    if [ -d "$directory" ]; then
        rm -f "$directory"/$pattern
        print_success "Cleaned directory: $directory"
    fi
}

# ==================================
# VALIDATION FUNCTIONS
# ==================================

check_command_exists() {
    local command="$1"
    local install_hint="${2:-}"

    if ! command -v "$command" &> /dev/null; then
        print_error "$command not found!"
        if [ -n "$install_hint" ]; then
            print_info "Install: $install_hint"
        fi
        return 1
    fi
    return 0
}

check_file_exists() {
    local file_path="$1"
    local error_message="${2:-File not found: $file_path}"

    if [ ! -f "$file_path" ]; then
        print_error "$error_message"
        return 1
    fi
    return 0
}

check_directory_exists() {
    local directory="$1"
    local error_message="${2:-Directory not found: $directory}"

    if [ ! -d "$directory" ]; then
        print_error "$error_message"
        return 1
    fi
    return 0
}

# ==================================
# USER INPUT FUNCTIONS
# ==================================

get_user_choice() {
    local prompt="$1"
    local default_value="$2"
    local env_var="${3:-}"

    # Check if choice provided via environment variable
    if [ -n "$env_var" ] && [ -n "${!env_var}" ]; then
        echo "${!env_var}"
        return 0
    fi

    # Check if running in interactive mode
    if [ -t 0 ]; then
        read -p "$prompt [$default_value]: " choice
        echo "${choice:-$default_value}"
    else
        # Non-interactive mode, use default
        echo "$default_value"
    fi
}

confirm_action() {
    local prompt="$1"
    local default="${2:-n}"

    # If not interactive, use default
    if [ ! -t 0 ]; then
        [ "$default" = "y" ] || [ "$default" = "Y" ]
        return $?
    fi

    read -p "$prompt [y/N]: " response
    response="${response:-$default}"

    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# ==================================
# PROGRESS FUNCTIONS
# ==================================

print_progress() {
    local current=$1
    local total=$2
    local item_name="$3"
    local percentage=$((current * 100 / total))

    printf "\r${COLOR_CYAN}Progress: [%-50s] %d%% (%d/%d) - %s${COLOR_NC}" \
        "$(printf '#%.0s' $(seq 1 $((percentage / 2))))" \
        "$percentage" \
        "$current" \
        "$total" \
        "$item_name"
}

clear_progress() {
    printf "\r%80s\r" " "
}

# ==================================
# ERROR HANDLING
# ==================================

exit_on_error() {
    local exit_code=$1
    local error_message="$2"

    if [ $exit_code -ne 0 ]; then
        print_error "$error_message"
        exit $exit_code
    fi
}

trap_error() {
    local line_number=$1
    print_error "Error occurred in script at line: $line_number"
    exit 1
}

# Set up error trap
# Usage: trap 'trap_error ${LINENO}' ERR

# ==================================
# TIME FUNCTIONS
# ==================================

get_timestamp() {
    date +"%Y-%m-%d %H:%M:%S"
}

get_duration() {
    local start_time=$1
    local end_time=$2
    echo $((end_time - start_time))
}

format_duration() {
    local total_seconds=$1
    local minutes=$((total_seconds / 60))
    local seconds=$((total_seconds % 60))

    if [ $minutes -gt 0 ]; then
        echo "${minutes}m ${seconds}s"
    else
        echo "${seconds}s"
    fi
}

# ==================================
# LOGGING FUNCTIONS
# ==================================

log_info() {
    echo "[$(get_timestamp)] INFO: $1"
}

log_warn() {
    echo "[$(get_timestamp)] WARN: $1" >&2
}

log_error() {
    echo "[$(get_timestamp)] ERROR: $1" >&2
}

log_debug() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo "[$(get_timestamp)] DEBUG: $1"
    fi
}
