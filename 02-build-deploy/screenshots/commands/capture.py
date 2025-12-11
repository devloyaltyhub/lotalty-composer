#!/usr/bin/env python3
"""
Screenshot Capture Command

Captures app screenshots using Flutter integration tests.
Supports iOS and Android platforms.

Replaces: Screenshot capture functionality from generate-appstore-screenshots.sh
"""

import sys
import os
from pathlib import Path
from typing import Optional, List
import logging
import argparse

# Import services and configuration
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.screenshot_config import PathConfig
from services.simulator import SimulatorService, SimulatorError
from services.flutter import FlutterService, FlutterError


class ScreenshotCaptureError(Exception):
    """Raised when screenshot capture fails"""
    pass


class ScreenshotCapture:
    """Handles screenshot capture workflow"""

    # Console colors
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    MAGENTA = '\033[0;35m'
    CYAN = '\033[0;36m'
    NC = '\033[0m'

    # Defaults
    DEFAULT_DEVICE = "iPhone 15 Pro Max"
    DEFAULT_PLATFORM = "ios"
    DEFAULT_TEST_FILE = "all_screenshots_test.dart"

    def __init__(
        self,
        device: Optional[str] = None,
        platform: Optional[str] = None,
        screenshots_dir: Optional[Path] = None,
        white_label_dir: Optional[Path] = None,
        skip_tests: bool = False
    ):
        """
        Initialize screenshot capture

        Args:
            device: Device name (e.g., "iPhone 15 Pro Max")
            platform: Platform (ios or android)
            screenshots_dir: Directory to save screenshots
            white_label_dir: Flutter project directory
            skip_tests: If True, skip test execution (use existing screenshots)
        """
        self.logger = logging.getLogger(__name__)

        # Set up configuration
        self.device = device or self.DEFAULT_DEVICE
        self.platform = platform or self.DEFAULT_PLATFORM
        self.skip_tests = skip_tests

        # Set up directories
        # __file__ = automation/02-build-deploy/screenshots/commands/capture.py
        # We need to go up to repo root: commands -> screenshots -> 02-build-deploy -> automation -> repo_root
        # Important: resolve() is needed because __file__ can be relative when running via main.py
        repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
        self.white_label_dir = white_label_dir or (repo_root / "white_label_app")
        self.screenshots_dir = screenshots_dir or (self.white_label_dir / "screenshots")
        self.mockups_dir = self.screenshots_dir / "mockups"

        # Initialize services
        if self.platform == "ios":
            self.simulator = SimulatorService()
        self.flutter = FlutterService(project_dir=self.white_label_dir)

    def _print_banner(self) -> None:
        """Print application banner"""
        print()
        print(f"{self.MAGENTA}╔════════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║   📱  Screenshot Capture v2.0  📱          ║{self.NC}")
        print(f"{self.MAGENTA}║      Flutter Integration Tests             ║{self.NC}")
        print(f"{self.MAGENTA}╚════════════════════════════════════════════╝{self.NC}")
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

    def _print_warning(self, message: str) -> None:
        """Print warning message"""
        print(f"{self.YELLOW}⚠️  {message}{self.NC}")

    def _print_info(self, message: str) -> None:
        """Print info message"""
        print(f"{self.CYAN}ℹ️  {message}{self.NC}")

    def _prepare_environment(self) -> None:
        """
        Prepare environment for screenshot capture

        - Creates screenshot directory if needed
        - Cleans old screenshots if not in skip mode
        """
        self._print_section("📋 ETAPA 1/2: Preparando ambiente")

        # Guard clause: Skip mode
        if self.skip_tests:
            self._print_info("Modo skip-tests: mantendo screenshots existentes")
            return

        # Create screenshots directory
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)

        # Clean old screenshots
        if self.screenshots_dir.exists():
            self._print_warning("Removendo screenshots antigos...")

            # Remove screenshot files
            for screenshot in self.screenshots_dir.glob("0*.png"):
                screenshot.unlink()

            # Remove mockups directory
            if self.mockups_dir.exists():
                import shutil
                shutil.rmtree(self.mockups_dir)

            self._print_success("Screenshots antigos removidos")
        else:
            self._print_info("Criando diretório de screenshots...")
            self.screenshots_dir.mkdir(parents=True, exist_ok=True)

    def _capture_screenshots_ios(self, simulator_id: str) -> bool:
        """
        Capture screenshots on iOS simulator

        Args:
            simulator_id: iOS simulator UDID

        Returns:
            True if successful
        """
        self._print_info("Executando integration test...")
        print()

        # Run integration test using flutter drive
        # Note: Using flutter drive instead of flutter test for screenshot capture
        success = self.flutter.run_drive_test(
            test_file="integration_test/all_screenshots_test.dart",
            device_id=simulator_id
        )

        print()
        if success:
            self._print_success("Screenshots capturados com sucesso!")
        else:
            self._print_error("Erro ao capturar screenshots")
            self._print_warning("Verifique o log acima para detalhes")

        return success

    def _capture_screenshots_android(self, device_id: Optional[str] = None) -> bool:
        """
        Capture screenshots on Android emulator/device

        Args:
            device_id: Android device ID (optional)

        Returns:
            True if successful
        """
        self._print_info("Executando integration test...")
        print()

        # Run integration test
        success = self.flutter.run_drive_test(
            test_file="integration_test/all_screenshots_test.dart",
            device_id=device_id
        )

        print()
        if success:
            self._print_success("Screenshots capturados com sucesso!")
        else:
            self._print_error("Erro ao capturar screenshots")
            self._print_warning("Verifique o log acima para detalhes")

        return success

    def _capture_screenshots(self) -> None:
        """
        Capture screenshots using Flutter integration tests

        Raises:
            ScreenshotCaptureError: If capture fails
        """
        # Guard clause: Skip tests mode
        if self.skip_tests:
            self._print_section("📸 ETAPA 2/2: Capturando Screenshots (PULADO)")
            self._print_warning("Usando screenshots existentes")
            return

        self._print_section("📸 ETAPA 2/2: Capturando Screenshots")
        self._print_info(f"Device: {self.device}")

        if self.platform == "ios":
            # iOS workflow
            self._print_info("Verificando simulador...")

            simulator_id = None
            try:
                # Get and boot simulator
                simulator_id = self.simulator.get_or_boot_simulator(self.device)
                self._print_success(f"Simulador pronto: {simulator_id[:8]}...")

                print()

                # Capture screenshots
                success = self._capture_screenshots_ios(simulator_id)

                # Guard clause: Capture failed
                if not success:
                    raise ScreenshotCaptureError("Flutter integration test failed")

            except SimulatorError as e:
                raise ScreenshotCaptureError(f"iOS simulator error: {e}")
            finally:
                # Always shutdown simulator after capture
                if simulator_id:
                    print()
                    self._print_info("Desligando simulador...")
                    try:
                        self.simulator.shutdown_simulator(simulator_id)
                        self._print_success("Simulador desligado")
                    except SimulatorError as e:
                        self._print_warning(f"Falha ao desligar simulador: {e}")

        elif self.platform == "android":
            # Android workflow
            self._print_info("Verificando emulator/device...")

            # Get connected devices
            devices = self.flutter.get_devices()
            android_devices = [d for d in devices if d['platform'] == 'android']

            # Guard clause: No Android devices
            if not android_devices:
                raise ScreenshotCaptureError(
                    "Nenhum device/emulator Android encontrado!\n"
                    "Inicie um emulator ou conecte um device."
                )

            # Use first Android device
            device_id = android_devices[0]['id']
            device_name = android_devices[0]['name']
            self._print_success(f"Device encontrado: {device_name}")

            print()

            # Capture screenshots
            success = self._capture_screenshots_android(device_id)

            # Guard clause: Capture failed
            if not success:
                raise ScreenshotCaptureError("Flutter integration test failed")

        else:
            raise ScreenshotCaptureError(
                f"Platform inválida: {self.platform}. Use 'ios' ou 'android'"
            )

    def _validate_screenshots(self) -> int:
        """
        Validate that screenshots were captured

        Returns:
            Number of screenshots found

        Raises:
            ScreenshotCaptureError: If no screenshots found
        """
        screenshots = sorted(self.screenshots_dir.glob("0*.png"))
        count = len(screenshots)

        # Guard clause: No screenshots
        if count == 0:
            raise ScreenshotCaptureError(
                f"Nenhum screenshot encontrado em: {self.screenshots_dir}"
            )

        self._print_success(f"{count} screenshots encontrados")
        return count

    def _print_summary(self, screenshot_count: int) -> None:
        """Print capture summary"""
        print()
        print(f"{self.MAGENTA}╔════════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║          ✅  CAPTURA CONCLUÍDA  ✅          ║{self.NC}")
        print(f"{self.MAGENTA}╚════════════════════════════════════════════╝{self.NC}")
        print()

        print(f"{self.CYAN}📊 Resumo:{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Screenshots capturados: {self.YELLOW}{screenshot_count}{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Platform: {self.YELLOW}{self.platform}{self.NC}")
        print(f"   {self.GREEN}✅{self.NC} Device: {self.YELLOW}{self.device}{self.NC}")
        print()

        print(f"{self.CYAN}📂 Localização:{self.NC}")
        print(f"   Screenshots: {self.YELLOW}{self.screenshots_dir}{self.NC}")
        print()

        # List captured screenshots
        print(f"{self.CYAN}📸 Arquivos capturados:{self.NC}")
        for screenshot in sorted(self.screenshots_dir.glob("0*.png")):
            size_kb = screenshot.stat().st_size / 1024
            print(f"   {screenshot.name} ({size_kb:.1f} KB)")

        print()
        print(f"{self.GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print(f"{self.GREEN}🎉 Screenshots prontos para processar!{self.NC}")
        print(f"{self.GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print()

    def capture(self) -> int:
        """
        Main capture workflow

        Returns:
            Exit code (0 for success, 1 for failure)
        """
        try:
            # Print banner
            self._print_banner()

            # Print configuration
            print(f"{self.CYAN}⚙️  Configuração:{self.NC}")
            print(f"   Device: {self.YELLOW}{self.device}{self.NC}")
            print(f"   Platform: {self.YELLOW}{self.platform}{self.NC}")
            print(f"   Skip Tests: {self.YELLOW}{self.skip_tests}{self.NC}")

            # Prepare environment
            self._prepare_environment()

            # Capture screenshots
            self._capture_screenshots()

            # Validate results
            screenshot_count = self._validate_screenshots()

            # Print summary
            self._print_summary(screenshot_count)

            return 0

        except ScreenshotCaptureError as e:
            self._print_error(str(e))
            return 1
        except KeyboardInterrupt:
            print()
            self._print_error("Operação cancelada pelo usuário")
            return 130
        except Exception as e:
            self.logger.exception("Unexpected error during screenshot capture")
            self._print_error(f"Erro inesperado: {e}")
            return 1


def main() -> int:
    """Main entry point"""
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description="Capture app screenshots using Flutter integration tests",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Capture iOS screenshots:
  %(prog)s --device "iPhone 15 Pro Max" --platform ios

  # Capture Android screenshots:
  %(prog)s --platform android

  # Skip test execution (use existing screenshots):
  %(prog)s --skip-tests
        """
    )

    parser.add_argument(
        '--device',
        default=ScreenshotCapture.DEFAULT_DEVICE,
        help=f'Device name (default: {ScreenshotCapture.DEFAULT_DEVICE})'
    )

    parser.add_argument(
        '--platform',
        choices=['ios', 'android'],
        default=ScreenshotCapture.DEFAULT_PLATFORM,
        help=f'Platform (default: {ScreenshotCapture.DEFAULT_PLATFORM})'
    )

    parser.add_argument(
        '--skip-tests',
        action='store_true',
        help='Skip test execution (use existing screenshots)'
    )

    parser.add_argument(
        '--screenshots-dir',
        type=Path,
        help='Screenshots directory (default: white_label_app/screenshots)'
    )

    parser.add_argument(
        '--white-label-dir',
        type=Path,
        help='Flutter project directory (default: white_label_app)'
    )

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

    # Create capture instance and run
    capture = ScreenshotCapture(
        device=args.device,
        platform=args.platform,
        screenshots_dir=args.screenshots_dir,
        white_label_dir=args.white_label_dir,
        skip_tests=args.skip_tests
    )

    return capture.capture()


if __name__ == "__main__":
    sys.exit(main())
