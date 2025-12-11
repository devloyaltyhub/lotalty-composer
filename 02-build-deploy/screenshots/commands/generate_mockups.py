#!/usr/bin/env python3
"""
Mockup Generation Command

Generates mockups from screenshots using two-step pipeline:
1. apply_mockup.py: Screenshot → Device frame (flat mockup)
2. ImageMagick: Flat mockup → gradient background + decorative curves
"""

import subprocess
import sys
import os
import json
from pathlib import Path
from typing import Optional, List, Tuple
import logging

# Import services and configuration
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.screenshot_config import MockupConfig, PathConfig, AppleStoreConfig, GooglePlayConfig, FeatureGraphicConfig
from services.imagemagick import ImageMagickService, ImageMagickError


class MockupGeneratorError(Exception):
    """Raised when mockup generation fails"""
    pass


class GradientStyle:
    """Gradient style definitions"""

    PREMIUM_PURPLE = ("Premium Purple/Pink", "#667eea", "#764ba2")
    OCEAN_BLUE = ("Ocean Blue", "#4facfe", "#00f2fe")
    SUNSET_ORANGE = ("Sunset Orange", "#fa709a", "#fee140")
    FRESH_GREEN = ("Fresh Green", "#0ba360", "#3cba92")
    DARK_PURPLE = ("Dark Purple", "#2d3436", "#6c5ce7")
    BOLD_RED_PINK = ("Bold Red/Pink", "#f093fb", "#f5576c")

    @classmethod
    def get_all(cls) -> List[Tuple[str, str, str]]:
        """Get all gradient styles"""
        return [
            cls.PREMIUM_PURPLE,
            cls.OCEAN_BLUE,
            cls.SUNSET_ORANGE,
            cls.FRESH_GREEN,
            cls.DARK_PURPLE,
            cls.BOLD_RED_PINK
        ]

    @classmethod
    def get_custom_from_env(cls) -> Optional[Tuple[str, str, str]]:
        """
        Get custom gradient from environment variables.

        Uses PRIMARY_COLOR env var to create a gradient from primary to darker shade.
        Returns None if PRIMARY_COLOR is not set.
        """
        primary_color = os.getenv('PRIMARY_COLOR')
        if not primary_color:
            return None

        # Ensure color starts with #
        if not primary_color.startswith('#'):
            primary_color = f'#{primary_color}'

        # Create darker shade for gradient end (darken by 30%)
        try:
            # Parse hex color
            hex_color = primary_color.lstrip('#')
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)

            # Darken by 30%
            darker_r = int(r * 0.7)
            darker_g = int(g * 0.7)
            darker_b = int(b * 0.7)

            darker_color = f'#{darker_r:02x}{darker_g:02x}{darker_b:02x}'

            return ("Client Primary", primary_color, darker_color)
        except (ValueError, IndexError):
            return None

    @classmethod
    def get_by_index(cls, index: int) -> Tuple[str, str, str]:
        """Get gradient style by index (0=custom from env, 1-6=predefined)"""
        # Index 0: Use custom color from environment
        if index == 0:
            custom = cls.get_custom_from_env()
            if custom:
                return custom
            # Fallback to purple if no custom color
            return cls.PREMIUM_PURPLE

        styles = cls.get_all()

        # Guard clause: Invalid index
        if index < 1 or index > len(styles):
            raise ValueError(f"Invalid gradient index: {index}. Must be 0-{len(styles)}")

        return styles[index - 1]


class DeviceType:
    """Device type definitions"""

    IPHONE_15_PRO_MAX = ("iphone", "iPhone 15 Pro Max", "iphone15promax")
    PIXEL_8_PRO = ("android", "Pixel 8 Pro", "pixel8pro")

    @classmethod
    def get_by_choice(cls, choice: int) -> Tuple[str, str, str]:
        """Get device type by choice number (1-2)"""
        devices = {
            1: cls.IPHONE_15_PRO_MAX,
            2: cls.PIXEL_8_PRO
        }

        # Guard clause: Invalid choice
        if choice not in devices:
            raise ValueError(f"Invalid device choice: {choice}. Must be 1 or 2")

        return devices[choice]


class MockupGenerator:
    """Generates mockups from screenshots"""

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
        screenshots_dir: Optional[Path] = None,
        output_dir: Optional[Path] = None,
        templates_dir: Optional[Path] = None,
        generate_ipad: bool = True,
        generate_gplay: bool = True,
        generate_feature_graphic: bool = True
    ):
        """
        Initialize mockup generator

        Args:
            screenshots_dir: Directory containing screenshots
            output_dir: Output directory for mockups
            templates_dir: Directory containing device templates
            generate_ipad: Whether to generate iPad versions (Apple)
            generate_gplay: Whether to generate Google Play versions
            generate_feature_graphic: Whether to generate Feature Graphic for Google Play
        """
        self.logger = logging.getLogger(__name__)
        self.generate_ipad = generate_ipad
        self.generate_gplay = generate_gplay
        self.generate_feature_graphic = generate_feature_graphic

        # Set up directories using absolute paths
        # __file__ = automation/02-build-deploy/screenshots/commands/generate_mockups.py
        # We need: commands -> screenshots -> 02-build-deploy -> automation -> repo_root
        # Important: resolve() is needed because __file__ can be relative when running via main.py
        resolved_file = Path(__file__).resolve()
        self.script_dir = resolved_file.parent.parent
        repo_root = resolved_file.parent.parent.parent.parent.parent
        white_label_dir = repo_root / "white_label_app"

        # Use absolute paths for screenshots directory
        self.screenshots_dir = screenshots_dir or (white_label_dir / "screenshots")
        self.output_dir = output_dir or self.screenshots_dir / "mockups"
        self.templates_dir = templates_dir or self.script_dir / "mockupgen_templates"
        self.apply_mockup_script = self.script_dir / "apply_mockup.py"
        self.top_images_dir = self.templates_dir / "top_images"

        # Output subdirectories for Apple App Store
        # Folder names match Fastlane deliver conventions and expected resolutions
        self.iphone_output_dir = self.output_dir / "iphone_6_7"  # 1290x2796 → APP_IPHONE_67
        self.ipad_output_dir = self.output_dir / "ipad_12_9"  # 2048x2732 → APP_IPAD_PRO_129

        # Output subdirectories for Google Play Store
        self.gplay_phone_output_dir = self.output_dir / "gplay_phone"
        self.gplay_tablet_output_dir = self.output_dir / "gplay_tablet"

        # Client assets directory
        self.client_assets_dir = white_label_dir / "assets" / "client_specific_assets"

        # Feature Graphic output directory (same as gplay_phone for convenience)
        self.feature_graphic_output_dir = self.output_dir / "feature_graphic"

        # Initialize ImageMagick service
        self.imagemagick = ImageMagickService()

        # Store repo root for config loading
        self.repo_root = repo_root

    def _load_primary_color_from_config(self) -> None:
        """
        Load PRIMARY_COLOR from white_label_app/config.json

        Sets the PRIMARY_COLOR environment variable from the client config
        so that gradient generation can use it.
        """
        try:
            config_path = self.repo_root / "white_label_app" / "config.json"

            if not config_path.exists():
                self.logger.warning(f"Config file not found: {config_path}")
                return

            with open(config_path, 'r') as f:
                config = json.load(f)

            primary_color = config.get('colors', {}).get('primary')
            if primary_color:
                os.environ['PRIMARY_COLOR'] = primary_color
                self._print_info(f"PRIMARY_COLOR carregada: {primary_color}")
            else:
                self.logger.warning("Primary color not found in config.json")

        except (json.JSONDecodeError, IOError) as e:
            self.logger.warning(f"Failed to load config.json: {e}")

    def _print_banner(self) -> None:
        """Print application banner"""
        print()
        print(f"{self.MAGENTA}╔═══════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║         📱 Mockup Generator 📱           ║{self.NC}")
        print(f"{self.MAGENTA}║   Python + OpenCV + ImageMagick Pipeline  ║{self.NC}")
        print(f"{self.MAGENTA}╚═══════════════════════════════════════════╝{self.NC}")
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

    def _cleanup_old_mockups(self) -> None:
        """
        Clean up old mockups from the root of mockups directory.

        Old versions of the script generated mockups directly in the root.
        This cleans them up since we now use subdirectories.
        """
        if not self.output_dir.exists():
            return

        old_mockups = list(self.output_dir.glob("*_mockup.png"))
        if old_mockups:
            self._print_info(f"Removendo {len(old_mockups)} mockups antigos da raiz...")
            for old_file in old_mockups:
                try:
                    old_file.unlink()
                    self.logger.debug(f"Removed old mockup: {old_file}")
                except Exception as e:
                    self.logger.warning(f"Failed to remove {old_file}: {e}")

    def _check_dependencies(self) -> None:
        """
        Check required dependencies

        Raises:
            MockupGeneratorError: If dependencies are missing
        """
        # Check Python 3
        if sys.version_info < (3, 7):
            raise MockupGeneratorError("Python 3.7+ required")

        # Check OpenCV and NumPy
        try:
            import cv2
            import numpy
        except ImportError:
            raise MockupGeneratorError(
                "OpenCV/NumPy not installed!\n"
                "Install: pip3 install opencv-python numpy pillow"
            )

        # Check ImageMagick (already done in ImageMagickService.__init__)
        # Just verify it was successful
        if not self.imagemagick.cmd:
            raise MockupGeneratorError("ImageMagick not found")

        # Check apply_mockup.py script
        if not self.apply_mockup_script.exists():
            raise MockupGeneratorError(
                f"apply_mockup.py not found at: {self.apply_mockup_script}"
            )

    def _check_templates(self) -> None:
        """
        Check template directory exists

        Raises:
            MockupGeneratorError: If templates not found
        """
        # Guard clause: Templates directory missing
        if not self.templates_dir.exists():
            raise MockupGeneratorError(
                f"Templates directory not found: {self.templates_dir}"
            )

        # Guard clause: index.json missing
        index_json = self.templates_dir / "index.json"
        if not index_json.exists():
            raise MockupGeneratorError(
                f"index.json not found in: {self.templates_dir}"
            )

    def _find_screenshots(self) -> List[Path]:
        """
        Find all screenshots to process

        Returns:
            List of screenshot file paths

        Raises:
            MockupGeneratorError: If no screenshots found
        """
        screenshots = sorted(self.screenshots_dir.glob("0*.png"))

        # Guard clause: No screenshots found
        if not screenshots:
            raise MockupGeneratorError(
                f"No screenshots found in: {self.screenshots_dir}\n"
                f"Expected files matching pattern: 0*.png"
            )

        return screenshots

    def _find_top_image(self, screenshot_name: str) -> Optional[Path]:
        """
        Find a matching top image for a screenshot.

        Uses simple name matching: top image must have the SAME name as screenshot.

        Examples:
            - screenshot "01_home.png" → top image "01_home.png"
            - screenshot "04_account_statement.png" → top image "04_account_statement.png"

        Args:
            screenshot_name: Name of the screenshot (without extension)

        Returns:
            Path to matching top image, or None if not found
        """
        if not self.top_images_dir.exists():
            return None

        # Simple exact match: top image has same name as screenshot
        top_image_path = self.top_images_dir / f"{screenshot_name}.png"

        if top_image_path.exists():
            self.logger.info(f"Found top image: {top_image_path.name}")
            return top_image_path

        return None

    def _find_transparent_logo(self) -> Optional[Path]:
        """
        Find the transparent logo in client assets.

        The transparent logo is used as a watermark/branding element
        in the bottom-right corner of each mockup.

        Returns:
            Path to transparent-logo.png if found, None otherwise
        """
        logo_path = self.client_assets_dir / "transparent-logo.png"

        if logo_path.exists():
            self.logger.info(f"Found transparent logo: {logo_path}")
            return logo_path

        self.logger.debug(f"Transparent logo not found at: {logo_path}")
        return None

    def _generate_feature_graphic(
        self,
        screenshot_path: Path,
        gradient_start: str,
        gradient_end: str,
        logo_path: Optional[Path] = None,
        text_lines: Optional[List[str]] = None
    ) -> bool:
        """
        Generate Feature Graphic for Google Play Store (1024x500px)

        Args:
            screenshot_path: Path to home screenshot (01_home.png)
            gradient_start: Gradient start color
            gradient_end: Gradient end color
            logo_path: Optional path to transparent logo
            text_lines: Optional promotional text lines

        Returns:
            True if generation succeeded, False otherwise
        """
        output_path = self.feature_graphic_output_dir / "featureGraphic.png"

        try:
            print(f"   📱 Feature Graphic: Criando banner 1024x500...")

            self.imagemagick.create_feature_graphic(
                screenshot_path=screenshot_path,
                output_path=output_path,
                gradient_start=gradient_start,
                gradient_end=gradient_end,
                logo_path=logo_path,
                text_lines=text_lines
            )

            size_kb = output_path.stat().st_size / 1024
            print(f"   {self.GREEN}✅{self.NC} Feature Graphic (1024x500) - {size_kb:.1f} KB")
            return True

        except Exception as e:
            self.logger.error(f"Failed to generate Feature Graphic: {e}")
            print(f"   {self.RED}❌{self.NC} Feature Graphic: {e}")
            return False

    def _get_user_choice(
        self,
        prompt: str,
        default: int,
        env_var: Optional[str] = None
    ) -> int:
        """
        Get user choice with support for environment variables

        Args:
            prompt: Prompt to display
            default: Default value
            env_var: Environment variable name to check

        Returns:
            User's choice
        """
        # Check environment variable first
        if env_var and os.getenv(env_var):
            value = int(os.getenv(env_var))
            print(f"Escolha (automática): {value}")
            return value

        # Check if running in interactive mode
        if sys.stdin.isatty():
            try:
                choice = input(f"{prompt} [padrão: {default}]: ").strip()
                return int(choice) if choice else default
            except (ValueError, KeyboardInterrupt):
                return default
        else:
            # Non-interactive mode, use default
            return default

    def _prompt_device_choice(self) -> Tuple[str, str, str]:
        """
        Prompt user for device choice

        Returns:
            Tuple of (device_type, device_name, template_slug)
        """
        print(f"{self.CYAN}📱 Escolha o tipo de device:{self.NC}")
        print()
        print("  1) 🍎 iPhone 15 Pro Max")
        print("  2) 🤖 Pixel 8 Pro")
        print()

        choice = self._get_user_choice(
            "Escolha (1-2)",
            default=1,
            env_var="DEVICE_CHOICE"
        )

        return DeviceType.get_by_choice(choice)

    def _prompt_gradient_choice(self) -> Tuple[str, str, str]:
        """
        Prompt user for gradient style

        Returns:
            Tuple of (style_name, gradient_start, gradient_end)
        """
        print()
        print(f"{self.CYAN}🎨 Escolha o estilo de gradiente:{self.NC}")
        print()
        print("  0) 🎨 Client Primary (do config.json)")
        print("  1) 🌟 Premium Purple/Pink")
        print("  2) 🌊 Ocean Blue")
        print("  3) 🔥 Sunset Orange")
        print("  4) 🌿 Fresh Green")
        print("  5) 🌙 Dark Purple")
        print("  6) 🎯 Bold Red/Pink")
        print()

        choice = self._get_user_choice(
            "Escolha (0-6)",
            default=0,
            env_var="GRADIENT_CHOICE"
        )

        # Load PRIMARY_COLOR from config.json if choice is 0
        if choice == 0:
            self._load_primary_color_from_config()

        return GradientStyle.get_by_index(choice)

    def _prompt_logo_choice(self) -> bool:
        """
        Prompt user whether to add logo to mockups

        Returns:
            True if user wants to add logo, False otherwise
        """
        # Check environment variable first
        env_value = os.getenv('ADD_LOGO')
        if env_value is not None:
            result = env_value.lower() in ('1', 'true', 'yes', 's', 'sim')
            print(f"Adicionar logo (automático): {'Sim' if result else 'Não'}")
            return result

        print()
        print(f"{self.CYAN}🏷️  Adicionar logo no rodapé dos mockups?{self.NC}")
        print()
        print("  S) Sim - Adicionar transparent-logo.png no canto inferior direito")
        print("  N) Não - Gerar mockups sem logo")
        print()

        # Check if running in interactive mode
        if sys.stdin.isatty():
            try:
                choice = input(f"Adicionar logo? (S/N) [padrão: S]: ").strip().lower()
                if choice in ('n', 'nao', 'não', 'no'):
                    return False
                return True  # Default to yes
            except (ValueError, KeyboardInterrupt):
                return True
        else:
            # Non-interactive mode, default to yes
            return True

    def _generate_flat_mockup(
        self,
        screenshot_path: Path,
        template_slug: str,
        output_path: Path
    ) -> None:
        """
        Generate flat mockup using apply_mockup.py

        Args:
            screenshot_path: Path to screenshot
            template_slug: Device template slug
            output_path: Output path for flat mockup

        Raises:
            MockupGeneratorError: If generation fails
        """
        cmd = [
            "python3",
            str(self.apply_mockup_script),
            str(screenshot_path),
            str(self.templates_dir),
            template_slug,
            str(output_path)
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
        except subprocess.CalledProcessError as e:
            raise MockupGeneratorError(
                f"Failed to generate flat mockup: {e.stderr}"
            )

        # Guard clause: Output file not created
        if not output_path.exists():
            raise MockupGeneratorError(
                f"Flat mockup not created: {output_path}"
            )

    def _apply_gradient_background(
        self,
        flat_mockup_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str
    ) -> None:
        """
        Apply gradient background to flat mockup

        Args:
            flat_mockup_path: Path to flat mockup
            output_path: Output path for final mockup
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
        """
        self.imagemagick.composite_on_gradient(
            input_path=flat_mockup_path,
            output_path=output_path,
            gradient_start=gradient_start,
            gradient_end=gradient_end
        )

    def _process_screenshot(
        self,
        screenshot_path: Path,
        device_type: str,
        template_slug: str,
        gradient_start: str,
        gradient_end: str,
        index: int,
        total: int,
        bottom_logo_path: Optional[Path] = None
    ) -> dict:
        """
        Process a single screenshot for all platforms

        Args:
            screenshot_path: Path to screenshot
            device_type: Device type (iphone/android)
            template_slug: Device template slug
            gradient_start: Gradient start color
            gradient_end: Gradient end color
            index: Current index (1-based)
            total: Total number of screenshots
            bottom_logo_path: Optional path to logo for bottom-right corner

        Returns:
            Dict with success status for each platform
        """
        filename = screenshot_path.name
        name = screenshot_path.stem

        # Temporary files
        temp_flat = Path("/tmp") / f"mockup_flat_{name}.png"
        temp_large_mockup = Path("/tmp") / f"mockup_large_{name}.png"

        # Output files
        iphone_output = self.iphone_output_dir / f"{name}_mockup.png"
        ipad_output = self.ipad_output_dir / f"{name}_mockup.png"
        gplay_phone_output = self.gplay_phone_output_dir / f"{name}_mockup.png"
        gplay_tablet_output = self.gplay_tablet_output_dir / f"{name}_mockup.png"

        print(f"{self.YELLOW}[{index}/{total}]{self.NC} Processando: {filename}")

        results = {
            'iphone': False,
            'ipad': False,
            'gplay_phone': False,
            'gplay_tablet': False
        }

        # Seed for curve generation (use filename for reproducibility)
        curve_seed = name

        # Check for matching top image
        top_image_path = self._find_top_image(name)
        if top_image_path:
            print(f"   🖼️  Imagem de topo encontrada: {top_image_path.name}")

        # Log bottom logo status
        if bottom_logo_path:
            print(f"   🏷️  Logo inferior: {bottom_logo_path.name}")

        try:
            # === APPLE IPHONE MOCKUP ===
            # Step 1: Generate flat mockup (screenshot with rounded corners)
            print("   🍎 iPhone 6.7\": Aplicando cantos arredondados + curvas decorativas...")
            self._generate_flat_mockup(screenshot_path, template_slug, temp_flat)

            # Step 2: Apply gradient background with decorative curves (and optional top image/bottom logo)
            self.imagemagick.create_iphone_mockup_with_curves(
                flat_mockup_path=temp_flat,
                output_path=iphone_output,
                gradient_start=gradient_start,
                gradient_end=gradient_end,
                seed=curve_seed,
                top_image_path=top_image_path,
                bottom_logo_path=bottom_logo_path
            )

            size_mb = iphone_output.stat().st_size / (1024 * 1024)
            print(f"   {self.GREEN}✅{self.NC} iPhone 6.7\" (1290x2796) - {size_mb:.2f} MB")
            results['iphone'] = True

            # === GOOGLE PLAY PHONE MOCKUP ===
            # Google Play prohibits device frames - create clean screenshot with curves
            if self.generate_gplay:
                print("   🤖 Google Play Phone: Criando versão sem frame + curvas...")
                self.imagemagick.create_google_play_phone_screenshot_with_curves(
                    input_path=screenshot_path,
                    output_path=gplay_phone_output,
                    gradient_start=gradient_start,
                    gradient_end=gradient_end,
                    seed=curve_seed,
                    top_image_path=top_image_path,
                    bottom_logo_path=bottom_logo_path
                )

                size_mb = gplay_phone_output.stat().st_size / (1024 * 1024)
                print(f"   {self.GREEN}✅{self.NC} GPlay Phone (1080x1920) - {size_mb:.2f} MB")
                results['gplay_phone'] = True

            # === APPLE IPAD MOCKUP ===
            if self.generate_ipad:
                print("   🍎 iPad 12.9\": Criando versão tablet + curvas...")
                self.imagemagick.create_ipad_screenshot_with_curves(
                    input_path=screenshot_path,
                    output_path=ipad_output,
                    gradient_start=gradient_start,
                    gradient_end=gradient_end,
                    seed=curve_seed,
                    top_image_path=top_image_path,
                    bottom_logo_path=bottom_logo_path
                )

                size_mb = ipad_output.stat().st_size / (1024 * 1024)
                print(f"   {self.GREEN}✅{self.NC} iPad 12.9\" (2048x2732) - {size_mb:.2f} MB")
                results['ipad'] = True

            # === GOOGLE PLAY TABLET MOCKUP ===
            if self.generate_gplay:
                print("   🤖 Google Play Tablet: Criando versão tablet + curvas...")
                self.imagemagick.create_google_play_tablet_screenshot_with_curves(
                    input_path=screenshot_path,
                    output_path=gplay_tablet_output,
                    gradient_start=gradient_start,
                    gradient_end=gradient_end,
                    seed=curve_seed,
                    top_image_path=top_image_path,
                    bottom_logo_path=bottom_logo_path
                )

                size_mb = gplay_tablet_output.stat().st_size / (1024 * 1024)
                print(f"   {self.GREEN}✅{self.NC} GPlay Tablet (1600x2560) - {size_mb:.2f} MB")
                results['gplay_tablet'] = True

            print()

        except Exception as e:
            self.logger.error(f"Failed to process {filename}: {e}")
            print(f"   {self.RED}❌{self.NC} Erro: {e}")
            print()

        finally:
            # Clean up temporary files
            for temp_file in [temp_flat, temp_large_mockup]:
                if temp_file.exists():
                    temp_file.unlink()

        return results

    def _print_summary(
        self,
        device_name: str,
        style_name: str,
        total_processed: int,
        counts: dict
    ) -> None:
        """Print generation summary"""
        print(f"{self.MAGENTA}╔═══════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║        ✨  MOCKUPS GERADOS  ✨            ║{self.NC}")
        print(f"{self.MAGENTA}╚═══════════════════════════════════════════╝{self.NC}")
        print()

        print(f"{self.CYAN}📊 Resumo:{self.NC}")
        print(f"   Screenshots processados: {self.YELLOW}{total_processed}{self.NC}")
        print(f"   Cor: {self.YELLOW}{style_name}{self.NC}")
        print()

        # Apple App Store
        print(f"{self.CYAN}🍎 Apple App Store:{self.NC}")
        print(f"   iPhone 6.7\" (1290x2796): {self.YELLOW}{counts['iphone']}{self.NC} mockups")
        if self.generate_ipad:
            print(f"   iPad 12.9\" (2048x2732): {self.YELLOW}{counts['ipad']}{self.NC} mockups")
        print()

        # Google Play Store
        if self.generate_gplay:
            print(f"{self.CYAN}🤖 Google Play Store:{self.NC}")
            print(f"   Phone (1080x1920): {self.YELLOW}{counts['gplay_phone']}{self.NC} mockups")
            print(f"   Tablet 10\" (1600x2560): {self.YELLOW}{counts['gplay_tablet']}{self.NC} mockups")
            if self.generate_feature_graphic and counts.get('feature_graphic', 0) > 0:
                print(f"   Feature Graphic (1024x500): {self.YELLOW}1{self.NC} imagem")
            print()

        print(f"{self.CYAN}📂 Localização:{self.NC}")
        print(f"   🍎 iPhone:      {self.YELLOW}{self.iphone_output_dir}{self.NC}")
        if self.generate_ipad:
            print(f"   🍎 iPad:        {self.YELLOW}{self.ipad_output_dir}{self.NC}")
        if self.generate_gplay:
            print(f"   🤖 GPlay Phone: {self.YELLOW}{self.gplay_phone_output_dir}{self.NC}")
            print(f"   🤖 GPlay Tablet:{self.YELLOW}{self.gplay_tablet_output_dir}{self.NC}")
            if self.generate_feature_graphic:
                print(f"   📱 Feature:     {self.YELLOW}{self.feature_graphic_output_dir}{self.NC}")

        print()
        print(f"{self.GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print(f"{self.GREEN}✨ Mockups prontos para App Stores!{self.NC}")
        print(f"{self.GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{self.NC}")
        print()

    def generate(self) -> int:
        """
        Main generation workflow

        Returns:
            Exit code (0 for success, 1 for failure)
        """
        try:
            # Print banner
            self._print_banner()

            # Check dependencies
            self._check_dependencies()
            self._check_templates()

            # Clean up old mockups from root directory
            self._cleanup_old_mockups()

            # Find screenshots
            screenshots = self._find_screenshots()
            self._print_success(f"Encontrados {len(screenshots)} screenshots")
            print()

            # Create output directories
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self.iphone_output_dir.mkdir(parents=True, exist_ok=True)
            if self.generate_ipad:
                self.ipad_output_dir.mkdir(parents=True, exist_ok=True)
            if self.generate_gplay:
                self.gplay_phone_output_dir.mkdir(parents=True, exist_ok=True)
                self.gplay_tablet_output_dir.mkdir(parents=True, exist_ok=True)
            if self.generate_feature_graphic:
                self.feature_graphic_output_dir.mkdir(parents=True, exist_ok=True)

            # Get user choices
            device_type, device_name, template_slug = self._prompt_device_choice()
            style_name, gradient_start, gradient_end = self._prompt_gradient_choice()

            # Ask if user wants to add logo
            add_logo = self._prompt_logo_choice()

            # Find transparent logo for bottom-right branding (only if user wants it)
            bottom_logo_path = None
            if add_logo:
                bottom_logo_path = self._find_transparent_logo()
                if not bottom_logo_path:
                    self._print_info("transparent-logo.png não encontrado em client_specific_assets/")

            # Print configuration
            self._print_section("✨ Gerando mockups para App Stores")
            print(f"   Device Frame: {self.YELLOW}{device_name}{self.NC}")
            print(f"   Cor: {self.YELLOW}{style_name}{self.NC}")
            if bottom_logo_path:
                print(f"   Logo: {self.YELLOW}transparent-logo.png{self.NC} (bottom-right)")
            elif add_logo:
                print(f"   Logo: {self.YELLOW}Não encontrada{self.NC}")
            else:
                print(f"   Logo: {self.YELLOW}Desabilitada{self.NC}")
            print()
            print(f"   {self.CYAN}🍎 Apple App Store:{self.NC}")
            print(f"      iPhone 6.7\": 1290x2796 (cantos arredondados)")
            if self.generate_ipad:
                print(f"      iPad 12.9\": 2048x2732 (cantos arredondados)")
            if self.generate_gplay:
                print()
                print(f"   {self.CYAN}🤖 Google Play Store:{self.NC}")
                print(f"      Phone: 1080x1920 (cantos arredondados)")
                print(f"      Tablet 10\": 1600x2560 (cantos arredondados)")
            print()

            # Process screenshots
            counts = {'iphone': 0, 'ipad': 0, 'gplay_phone': 0, 'gplay_tablet': 0, 'feature_graphic': 0}
            for index, screenshot in enumerate(screenshots, start=1):
                results = self._process_screenshot(
                    screenshot_path=screenshot,
                    device_type=device_type,
                    template_slug=template_slug,
                    gradient_start=gradient_start,
                    gradient_end=gradient_end,
                    index=index,
                    total=len(screenshots),
                    bottom_logo_path=bottom_logo_path
                )
                for key, success in results.items():
                    if success:
                        counts[key] += 1

            # Generate Feature Graphic (using first screenshot - home)
            if self.generate_feature_graphic and self.generate_gplay and screenshots:
                self._print_section("📱 Feature Graphic (Google Play)")
                home_screenshot = screenshots[0]  # Usually 01_home.png
                if self._generate_feature_graphic(
                    screenshot_path=home_screenshot,
                    gradient_start=gradient_start,
                    gradient_end=gradient_end,
                    logo_path=bottom_logo_path,
                    text_lines=FeatureGraphicConfig.DEFAULT_TEXT_LINES
                ):
                    counts['feature_graphic'] = 1
                print()

            # Print summary
            self._print_summary(
                device_name=device_name,
                style_name=style_name,
                total_processed=len(screenshots),
                counts=counts
            )

            # Guard clause: Check if any mockups were created
            if counts['iphone'] == 0:
                self._print_error("Nenhum mockup foi criado com sucesso!")
                return 1

            return 0

        except MockupGeneratorError as e:
            self._print_error(str(e))
            return 1
        except KeyboardInterrupt:
            print()
            self._print_error("Operação cancelada pelo usuário")
            return 130
        except Exception as e:
            self.logger.exception("Unexpected error during mockup generation")
            self._print_error(f"Erro inesperado: {e}")
            return 1


def main() -> int:
    """Main entry point"""
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Create generator and run
    generator = MockupGenerator()
    return generator.generate()


if __name__ == "__main__":
    sys.exit(main())
