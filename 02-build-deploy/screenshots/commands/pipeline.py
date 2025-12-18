#!/usr/bin/env python3
"""
Screenshot Pipeline Command

End-to-end screenshot automation pipeline:
1. Capture screenshots via Flutter integration tests
2. Generate mockups with gradient backgrounds
"""

import sys
import os
import json
from pathlib import Path
from typing import Optional
import logging
import argparse

# Import commands
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from commands.capture import ScreenshotCapture
from commands.generate_mockups import MockupGenerator
from config.project_config import ProjectConfig, LoyaltyAppConfig


class PipelineError(Exception):
    """Raised when pipeline execution fails"""
    pass


class ScreenshotPipeline:
    """Orchestrates complete screenshot workflow"""

    # Console colors
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'

    def __init__(
        self,
        project_config: Optional[ProjectConfig] = None,
        device: str = "iPhone 15 Pro Max",
        platform: str = "ios",
        skip_tests: bool = False,
        device_choice: Optional[int] = None,
        gradient_choice: Optional[int] = None,
        generate_ipad: Optional[bool] = None,
        generate_gplay: Optional[bool] = None
    ):
        """
        Initialize screenshot pipeline

        Args:
            project_config: Project configuration (recommended)
            device: Device name for screenshot capture
            platform: Platform (ios or android)
            skip_tests: Skip screenshot capture (use existing)
            device_choice: Mockup device choice (1-2)
            gradient_choice: Gradient style choice (0-6)
            generate_ipad: Whether to generate iPad screenshots (None = use project default)
            generate_gplay: Whether to generate Google Play screenshots (None = use project default)
        """
        self.logger = logging.getLogger(__name__)

        # Use project config or create default (loyalty-app)
        self.project_config = project_config or LoyaltyAppConfig()

        # Capture configuration
        self.device = device
        self.platform = platform
        self.skip_tests = skip_tests

        # Feature flags: explicit args override project config
        self.generate_ipad = generate_ipad if generate_ipad is not None else self.project_config.generate_ipad
        self.generate_gplay = generate_gplay if generate_gplay is not None else (
            self.project_config.generate_gplay_phone or self.project_config.generate_gplay_tablet
        )

        # Mockup configuration (via environment variables)
        if device_choice is not None:
            os.environ['DEVICE_CHOICE'] = str(device_choice)
        if gradient_choice is not None:
            os.environ['GRADIENT_CHOICE'] = str(gradient_choice)

        # Load PRIMARY_COLOR from project config if gradient_choice is 0 (Client Primary)
        if gradient_choice == 0:
            self._load_primary_color_from_config()

        # Initialize components
        self.capture_cmd = ScreenshotCapture(
            device=device,
            platform=platform,
            skip_tests=skip_tests,
            screenshots_dir=self.project_config.screenshots_dir
        )
        self.mockup_cmd = MockupGenerator(
            project_config=self.project_config,
            generate_ipad=self.generate_ipad,
            generate_gplay=self.generate_gplay
        )

    def _load_primary_color_from_config(self) -> None:
        """
        Load PRIMARY_COLOR from project configuration.

        Sets the PRIMARY_COLOR environment variable from the project config
        so that MockupGenerator can use it for the gradient.
        """
        primary_color = self.project_config.get_primary_color()

        if primary_color:
            os.environ['PRIMARY_COLOR'] = primary_color
            self.logger.info(f"Loaded PRIMARY_COLOR: {primary_color}")
        else:
            self.logger.warning(f"Primary color not found for {self.project_config.project_name}")

    def _print_banner(self) -> None:
        """Print pipeline banner"""
        project_name = self.project_config.project_name
        print()
        print(f"{self.MAGENTA}╔════════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║   📱  App Store Screenshot Pipeline  📱    ║{self.NC}")
        print(f"{self.MAGENTA}║          Fully Automated Workflow          ║{self.NC}")
        print(f"{self.MAGENTA}╚════════════════════════════════════════════╝{self.NC}")
        print(f"{self.CYAN}   Project: {project_name}{self.NC}")
        print()

    def _print_section(self, title: str) -> None:
        """Print section header"""
        print()
        print(f"{self.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print(f"{self.BLUE}{title}{self.NC}")
        print(f"{self.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print()

    def _print_success(self, message: str) -> None:
        """Print success message"""
        print(f"{self.GREEN}✅ {message}{self.NC}")

    def _print_error(self, message: str) -> None:
        """Print error message"""
        print(f"{self.RED}❌ {message}{self.NC}")

    def _print_info(self, message: str) -> None:
        """Print info message"""
        print(f"{self.CYAN}ℹ️  {message}{self.NC}")

    def _print_configuration(self) -> None:
        """Print pipeline configuration"""
        print(f"{self.CYAN}⚙️  Configuração:{self.NC}")
        print(f"   Device: {self.YELLOW}{self.device}{self.NC}")
        print(f"   Platform: {self.YELLOW}{self.platform}{self.NC}")
        print(f"   Skip Tests: {self.YELLOW}{self.skip_tests}{self.NC}")

        # Print mockup choices if set via environment
        device_choice = os.getenv('DEVICE_CHOICE')
        gradient_choice = os.getenv('GRADIENT_CHOICE')

        if device_choice or gradient_choice:
            print()
            print(f"{self.CYAN}🎨 Mockup (automático):{self.NC}")
            if device_choice:
                print(f"   Device Choice: {self.YELLOW}{device_choice}{self.NC}")
            if gradient_choice:
                print(f"   Gradient: {self.YELLOW}{gradient_choice}{self.NC}")

    def _print_final_summary(
        self,
        screenshot_count: int,
        mockup_count: int
    ) -> None:
        """Print final pipeline summary"""
        screenshots_dir = self.capture_cmd.screenshots_dir
        mockups_dir = self.capture_cmd.mockups_dir

        print()
        print(f"{self.MAGENTA}╔════════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║          ✅  PROCESSO CONCLUÍDO  ✅         ║{self.NC}")
        print(f"{self.MAGENTA}╚════════════════════════════════════════════╝{self.NC}")
        print()

        print(f"{self.CYAN}📊 Resumo:{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Screenshots originais: {self.YELLOW}{screenshot_count}{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Mockups gerados: {self.YELLOW}{mockup_count}{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Platform: {self.YELLOW}{self.platform}{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Device: {self.YELLOW}{self.device}{self.NC}")
        print()

        print(f"{self.CYAN}📂 Localização:{self.NC}")
        print(f"   Screenshots: {self.YELLOW}{screenshots_dir}{self.NC}")
        print(f"   Mockups:     {self.YELLOW}{mockups_dir}{self.NC}")
        print()

        print(f"{self.GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print(f"{self.GREEN}🎉 Screenshots prontos para App Stores!{self.NC}")
        print(f"{self.GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print()

    def run(self) -> int:
        """
        Execute complete pipeline

        Returns:
            Exit code (0 for success, 1 for failure)
        """
        try:
            # Print banner and configuration
            self._print_banner()
            self._print_configuration()

            # Step 1: Capture screenshots
            self._print_section("🎯 ETAPA 1/2: Captura de Screenshots")
            capture_result = self.capture_cmd.capture()

            # Guard clause: Capture failed
            if capture_result != 0:
                raise PipelineError("Screenshot capture failed")

            # Count screenshots
            screenshots = sorted(self.capture_cmd.screenshots_dir.glob("0*.png"))
            screenshot_count = len(screenshots)

            # Step 2: Generate mockups
            self._print_section("🎯 ETAPA 2/2: Geração de Mockups")
            mockup_result = self.mockup_cmd.generate()

            # Guard clause: Mockup generation failed
            if mockup_result != 0:
                raise PipelineError("Mockup generation failed")

            # Count mockups
            mockups = sorted(self.capture_cmd.mockups_dir.glob("*_3d.png"))
            mockup_count = len(mockups)

            # Print final summary
            self._print_final_summary(screenshot_count, mockup_count)

            return 0

        except PipelineError as e:
            self._print_error(str(e))
            return 1
        except KeyboardInterrupt:
            print()
            self._print_error("Operação cancelada pelo usuário")
            return 130
        except Exception as e:
            self.logger.exception("Unexpected error during pipeline execution")
            self._print_error(f"Erro inesperado: {e}")
            return 1


def main() -> int:
    """Main entry point"""
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Complete screenshot automation pipeline (capture + mockups)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode (prompts for mockup choices):
  %(prog)s

  # Fully automated (no prompts):
  %(prog)s --device-choice 1 --gradient-choice 0

  # Skip tests + automatic mockup generation:
  %(prog)s --skip-tests --device-choice 1 --gradient-choice 0

  # Android workflow:
  %(prog)s --platform android --device-choice 2
        """
    )

    # Capture options
    capture_group = parser.add_argument_group('Screenshot Capture Options')
    capture_group.add_argument(
        '--device',
        default="iPhone 15 Pro Max",
        help='iOS device name (default: iPhone 15 Pro Max)'
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
        help='Skip test execution (use existing screenshots)'
    )

    # Mockup options
    mockup_group = parser.add_argument_group('Mockup Generation Options (automatic mode)')
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
        help='0=Client Primary (from config), 1=Purple/Pink, 2=Ocean Blue, 3=Sunset, 4=Fresh Green, 5=Dark Purple, 6=Bold Red/Pink'
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

    # General options
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Set up logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Determine what to generate
    generate_ipad = not (args.no_ipad or args.gplay_only)
    generate_gplay = not (args.no_gplay or args.apple_only)

    # Create pipeline and run
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


if __name__ == "__main__":
    sys.exit(main())
