#!/usr/bin/env python3
"""
Screenshot Automation CLI

Professional command-line interface for screenshot automation.

Commands:
  capture   - Capture screenshots via Flutter integration tests
  mockups   - Generate mockups from screenshots
  pipeline  - Run complete workflow (capture + mockups)

Usage:
  python3 main.py capture --device "iPhone 15 Pro Max"
  python3 main.py mockups
  python3 main.py pipeline --device-choice 1 --gradient-choice 3
"""

import sys
import os
import argparse
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(__file__))

from commands.capture import ScreenshotCapture, main as capture_main
from commands.generate_mockups import MockupGenerator, main as mockups_main
from commands.pipeline import ScreenshotPipeline, main as pipeline_main


# Console colors
MAGENTA = '\033[0;35m'
CYAN = '\033[0;36m'
YELLOW = '\033[1;33m'
GREEN = '\033[0;32m'
NC = '\033[0m'


def print_banner() -> None:
    """Print CLI banner"""
    print()
    print(f"{MAGENTA}╔════════════════════════════════════════════╗{NC}")
    print(f"{MAGENTA}║     📱  Screenshot Automation CLI  📱     ║{NC}")
    print(f"{MAGENTA}║        Python + OpenCV + ImageMagick       ║{NC}")
    print(f"{MAGENTA}╚════════════════════════════════════════════╝{NC}")
    print()


def create_parser() -> argparse.ArgumentParser:
    """Create argument parser with subcommands"""
    parser = argparse.ArgumentParser(
        description="Screenshot automation CLI for Flutter apps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  capture   Capture screenshots via Flutter integration tests
  mockups   Generate mockups from screenshots
  pipeline  Run complete workflow (capture + mockups)

Examples:
  # Capture screenshots only:
  %(prog)s capture --device "iPhone 15 Pro Max" --platform ios

  # Generate mockups only (interactive):
  %(prog)s mockups

  # Complete pipeline (fully automated):
  %(prog)s pipeline --device-choice 1 --gradient-choice 0

For command-specific help:
  %(prog)s capture --help
  %(prog)s mockups --help
  %(prog)s pipeline --help
        """
    )

    # Global options
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    parser.add_argument(
        '--version',
        action='version',
        version='Screenshot Automation CLI'
    )

    # Create subcommands
    subparsers = parser.add_subparsers(
        dest='command',
        help='Command to execute',
        required=True
    )

    # =====================================
    # CAPTURE SUBCOMMAND
    # =====================================
    capture_parser = subparsers.add_parser(
        'capture',
        help='Capture screenshots via Flutter integration tests',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description='Capture app screenshots using Flutter integration tests',
        epilog="""
Examples:
  # Capture iOS screenshots:
  %(prog)s --device "iPhone 15 Pro Max" --platform ios

  # Capture Android screenshots:
  %(prog)s --platform android

  # Skip test execution:
  %(prog)s --skip-tests
        """
    )

    capture_parser.add_argument(
        '--device',
        default=ScreenshotCapture.DEFAULT_DEVICE,
        help=f'Device name (default: {ScreenshotCapture.DEFAULT_DEVICE})'
    )

    capture_parser.add_argument(
        '--platform',
        choices=['ios', 'android'],
        default=ScreenshotCapture.DEFAULT_PLATFORM,
        help=f'Platform (default: {ScreenshotCapture.DEFAULT_PLATFORM})'
    )

    capture_parser.add_argument(
        '--skip-tests',
        action='store_true',
        help='Skip test execution (use existing screenshots)'
    )

    capture_parser.add_argument(
        '--screenshots-dir',
        type=Path,
        help='Screenshots directory'
    )

    capture_parser.add_argument(
        '--white-label-dir',
        type=Path,
        help='Flutter project directory'
    )

    # =====================================
    # MOCKUPS SUBCOMMAND
    # =====================================
    mockups_parser = subparsers.add_parser(
        'mockups',
        help='Generate mockups from screenshots',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description='Generate mockups with gradient backgrounds',
        epilog="""
Examples:
  # Interactive mode (prompts for choices):
  %(prog)s

  # Automated mode:
  %(prog)s --device-choice 1 --gradient-choice 0

Device Choices:
  1 - iPhone 15 Pro Max
  2 - Pixel 8 Pro

Gradient Choices:
  0 - Client Primary (from config.json)
  1 - Premium Purple/Pink
  2 - Ocean Blue
  3 - Sunset Orange
  4 - Fresh Green
  5 - Dark Purple
  6 - Bold Red/Pink
        """
    )

    mockups_parser.add_argument(
        '--device-choice',
        type=int,
        choices=[1, 2],
        help='Device: 1=iPhone 15 Pro Max, 2=Pixel 8 Pro'
    )

    mockups_parser.add_argument(
        '--gradient-choice',
        type=int,
        choices=[0, 1, 2, 3, 4, 5, 6],
        help='Gradient: 0=Client Primary, 1=Purple, 2=Blue, 3=Orange, 4=Green, 5=Dark, 6=Red'
    )

    mockups_parser.add_argument(
        '--screenshots-dir',
        type=Path,
        help='Screenshots directory'
    )

    mockups_parser.add_argument(
        '--output-dir',
        type=Path,
        help='Output directory for mockups'
    )

    mockups_parser.add_argument(
        '--templates-dir',
        type=Path,
        help='Device templates directory'
    )

    mockups_parser.add_argument(
        '--no-ipad',
        action='store_true',
        help='Skip iPad screenshot generation'
    )

    mockups_parser.add_argument(
        '--no-gplay',
        action='store_true',
        help='Skip Google Play screenshot generation'
    )

    mockups_parser.add_argument(
        '--apple-only',
        action='store_true',
        help='Generate only Apple App Store screenshots (same as --no-gplay)'
    )

    mockups_parser.add_argument(
        '--gplay-only',
        action='store_true',
        help='Generate only Google Play Store screenshots (same as --no-ipad)'
    )

    mockups_parser.add_argument(
        '--with-logo',
        action='store_true',
        dest='add_logo',
        default=None,
        help='Add transparent-logo.png to bottom-right of mockups'
    )

    mockups_parser.add_argument(
        '--no-logo',
        action='store_false',
        dest='add_logo',
        help='Skip adding logo to mockups'
    )

    # =====================================
    # PIPELINE SUBCOMMAND
    # =====================================
    pipeline_parser = subparsers.add_parser(
        'pipeline',
        help='Run complete workflow (capture + mockups)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description='Complete screenshot automation pipeline',
        epilog="""
Examples:
  # Interactive mode:
  %(prog)s

  # Fully automated:
  %(prog)s --device-choice 1 --gradient-choice 0

  # Skip tests + automated mockups:
  %(prog)s --skip-tests --device-choice 1 --gradient-choice 0

  # Android workflow:
  %(prog)s --platform android --device-choice 2
        """
    )

    # Capture options
    capture_group = pipeline_parser.add_argument_group('Screenshot Capture')
    capture_group.add_argument(
        '--device',
        default="iPhone 15 Pro Max",
        help='iOS device name'
    )
    capture_group.add_argument(
        '--platform',
        choices=['ios', 'android'],
        default='ios',
        help='Platform (default: ios)'
    )
    capture_group.add_argument(
        '--skip-tests',
        action='store_true',
        help='Skip test execution'
    )

    # Mockup options
    mockup_group = pipeline_parser.add_argument_group('Mockup Generation')
    mockup_group.add_argument(
        '--device-choice',
        type=int,
        choices=[1, 2],
        help='1=iPhone 15 Pro Max, 2=Pixel 8 Pro'
    )
    mockup_group.add_argument(
        '--gradient-choice',
        type=int,
        choices=[0, 1, 2, 3, 4, 5, 6],
        help='0=Client Primary, 1=Purple, 2=Blue, 3=Orange, 4=Green, 5=Dark, 6=Red'
    )
    mockup_group.add_argument(
        '--angle-choice',
        type=int,
        choices=[1, 2, 3],
        help='Rotation angle: 1=Subtle (15°), 2=Moderate (20°), 3=Pronounced (25°) - Currently unused, kept for backwards compatibility'
    )
    mockup_group.add_argument(
        '--no-ipad',
        action='store_true',
        help='Skip iPad screenshot generation'
    )
    mockup_group.add_argument(
        '--no-gplay',
        action='store_true',
        help='Skip Google Play screenshot generation'
    )
    mockup_group.add_argument(
        '--apple-only',
        action='store_true',
        help='Generate only Apple App Store screenshots (same as --no-gplay)'
    )
    mockup_group.add_argument(
        '--gplay-only',
        action='store_true',
        help='Generate only Google Play Store screenshots (same as --no-ipad)'
    )

    mockup_group.add_argument(
        '--with-logo',
        action='store_true',
        dest='add_logo',
        default=None,
        help='Add transparent-logo.png to bottom-right of mockups'
    )

    mockup_group.add_argument(
        '--no-logo',
        action='store_false',
        dest='add_logo',
        help='Skip adding logo to mockups'
    )

    return parser


def cmd_capture(args: argparse.Namespace) -> int:
    """Execute capture command"""
    capture = ScreenshotCapture(
        device=args.device,
        platform=args.platform,
        screenshots_dir=args.screenshots_dir,
        white_label_dir=args.white_label_dir,
        skip_tests=args.skip_tests
    )
    return capture.capture()


def cmd_mockups(args: argparse.Namespace) -> int:
    """Execute mockups command"""
    # Set environment variables for automated choices
    if args.device_choice is not None:
        os.environ['DEVICE_CHOICE'] = str(args.device_choice)
    if args.gradient_choice is not None:
        os.environ['GRADIENT_CHOICE'] = str(args.gradient_choice)
    if args.add_logo is not None:
        os.environ['ADD_LOGO'] = 'true' if args.add_logo else 'false'

    # Determine what to generate
    generate_ipad = not (args.no_ipad or args.gplay_only)
    generate_gplay = not (args.no_gplay or args.apple_only)

    generator = MockupGenerator(
        screenshots_dir=args.screenshots_dir,
        output_dir=args.output_dir,
        templates_dir=args.templates_dir,
        generate_ipad=generate_ipad,
        generate_gplay=generate_gplay
    )
    return generator.generate()


def cmd_pipeline(args: argparse.Namespace) -> int:
    """Execute pipeline command"""
    # Set environment variable for logo choice
    if args.add_logo is not None:
        os.environ['ADD_LOGO'] = 'true' if args.add_logo else 'false'

    # Determine what to generate
    generate_ipad = not (args.no_ipad or args.gplay_only)
    generate_gplay = not (args.no_gplay or args.apple_only)

    pipeline = ScreenshotPipeline(
        device=args.device,
        platform=args.platform,
        skip_tests=args.skip_tests,
        device_choice=args.device_choice,
        gradient_choice=args.gradient_choice,
        generate_ipad=generate_ipad,
        generate_gplay=generate_gplay
    )
    return pipeline.run()


def main() -> int:
    """Main entry point"""
    # Create parser
    parser = create_parser()

    # Parse arguments
    args = parser.parse_args()

    # Set up logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Print banner (only for pipeline command)
    if args.command == 'pipeline':
        print_banner()

    # Route to appropriate command
    try:
        if args.command == 'capture':
            return cmd_capture(args)
        elif args.command == 'mockups':
            return cmd_mockups(args)
        elif args.command == 'pipeline':
            return cmd_pipeline(args)
        else:
            parser.print_help()
            return 1

    except KeyboardInterrupt:
        print()
        print(f"{YELLOW}⚠️  Operação cancelada pelo usuário{NC}")
        return 130
    except Exception as e:
        logging.exception("Unexpected error")
        print(f"{MAGENTA}❌ Erro inesperado: {e}{NC}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
