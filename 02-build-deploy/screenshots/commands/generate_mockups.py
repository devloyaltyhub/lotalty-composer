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
from typing import Optional, List, Tuple, TYPE_CHECKING
import logging

# Import services and configuration
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.screenshot_config import MockupConfig, PathConfig, AppleStoreConfig, GooglePlayConfig, FeatureGraphicConfig
from config.project_config import ProjectConfig, LoyaltyAppConfig, get_project_config
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


class CheckpointManager:
    """
    Manages checkpoint state for resume functionality.

    Saves progress after each screenshot/platform is processed,
    allowing the script to resume from where it left off if interrupted.
    """

    CHECKPOINT_FILE = ".mockups_progress.json"
    VERSION = 1

    # Console colors
    CYAN = '\033[0;36m'
    YELLOW = '\033[1;33m'
    GREEN = '\033[0;32m'
    NC = '\033[0m'

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.checkpoint_path = output_dir / self.CHECKPOINT_FILE
        self.state: Optional[dict] = None
        self.logger = logging.getLogger(__name__)

    def exists(self) -> bool:
        """Check if a checkpoint file exists"""
        return self.checkpoint_path.exists()

    def load(self) -> Optional[dict]:
        """Load checkpoint from file"""
        if not self.exists():
            return None

        try:
            with open(self.checkpoint_path, 'r') as f:
                self.state = json.load(f)
                return self.state
        except (json.JSONDecodeError, IOError) as e:
            self.logger.warning(f"Failed to load checkpoint: {e}")
            return None

    def save(self) -> None:
        """Save current state to checkpoint file"""
        if self.state is None:
            return

        try:
            self.state['last_updated'] = self._now()
            self.output_dir.mkdir(parents=True, exist_ok=True)
            with open(self.checkpoint_path, 'w') as f:
                json.dump(self.state, f, indent=2)
        except IOError as e:
            self.logger.warning(f"Failed to save checkpoint: {e}")

    def initialize(self, config: dict) -> None:
        """Initialize a new checkpoint with config"""
        self.state = {
            'version': self.VERSION,
            'started_at': self._now(),
            'config': config,
            'screenshots': {},
            'last_updated': self._now()
        }
        self.save()

    def mark_platform_complete(self, screenshot_name: str, platform: str) -> None:
        """Mark a specific platform for a screenshot as complete"""
        if self.state is None:
            return

        if screenshot_name not in self.state['screenshots']:
            self.state['screenshots'][screenshot_name] = {}

        self.state['screenshots'][screenshot_name][platform] = True
        self.save()

    def is_platform_complete(self, screenshot_name: str, platform: str) -> bool:
        """Check if a specific platform for a screenshot is already complete"""
        if self.state is None:
            return False

        return self.state.get('screenshots', {}).get(screenshot_name, {}).get(platform, False)

    def is_screenshot_complete(self, screenshot_name: str, platforms: List[str]) -> bool:
        """Check if all platforms for a screenshot are complete"""
        if self.state is None:
            return False

        screenshot_state = self.state.get('screenshots', {}).get(screenshot_name, {})
        return all(screenshot_state.get(p, False) for p in platforms)

    def get_pending_platforms(self, screenshot_name: str, platforms: List[str]) -> List[str]:
        """Get list of platforms that still need processing for a screenshot"""
        if self.state is None:
            return platforms

        screenshot_state = self.state.get('screenshots', {}).get(screenshot_name, {})
        return [p for p in platforms if not screenshot_state.get(p, False)]

    def clear(self) -> None:
        """Remove checkpoint file (call when successfully completed)"""
        if self.checkpoint_path.exists():
            try:
                self.checkpoint_path.unlink()
                self.state = None
            except IOError as e:
                self.logger.warning(f"Failed to remove checkpoint: {e}")

    def get_progress_summary(self) -> str:
        """Get a human-readable progress summary"""
        if self.state is None:
            return "Nenhum progresso salvo"

        screenshots = self.state.get('screenshots', {})
        total_complete = sum(
            1 for s in screenshots.values()
            if all(v for v in s.values())
        )
        return f"{total_complete} screenshots completos"

    def prompt_resume(self) -> bool:
        """
        Prompt user whether to resume from checkpoint or start fresh.

        Returns:
            True to resume, False to start fresh
        """
        if not self.exists():
            return False

        checkpoint = self.load()
        if not checkpoint:
            return False

        print()
        print(f"{self.CYAN}╔═══════════════════════════════════════════╗{self.NC}")
        print(f"{self.CYAN}║     📋 Checkpoint encontrado!             ║{self.NC}")
        print(f"{self.CYAN}╚═══════════════════════════════════════════╝{self.NC}")
        print()
        print(f"   Iniciado em: {self.YELLOW}{checkpoint.get('started_at', 'N/A')}{self.NC}")
        print(f"   Atualizado em: {self.YELLOW}{checkpoint.get('last_updated', 'N/A')}{self.NC}")
        print(f"   Progresso: {self.YELLOW}{self.get_progress_summary()}{self.NC}")
        print()

        if sys.stdin.isatty():
            try:
                choice = input("Continuar de onde parou? (S/N) [padrão: S]: ").strip().lower()
                if choice in ('n', 'nao', 'não', 'no'):
                    self.clear()
                    return False
                return True
            except (ValueError, KeyboardInterrupt):
                return True
        else:
            return True

    def _now(self) -> str:
        """Get current timestamp as ISO string"""
        from datetime import datetime
        return datetime.now().isoformat()


class MockupGenerator:
    """
    Generates mockups from screenshots.

    Supports multiple projects through ProjectConfig (SOLID Open/Closed Principle).
    Each project can have different directory structures and feature flags.

    Usage:
        # Default (loyalty-app)
        generator = MockupGenerator()

        # With project config
        config = get_project_config('admin')
        generator = MockupGenerator(project_config=config)
    """

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
        screenshots_dir: Optional[Path] = None,
        output_dir: Optional[Path] = None,
        templates_dir: Optional[Path] = None,
        generate_ipad: Optional[bool] = None,
        generate_gplay: Optional[bool] = None,
        generate_feature_graphic: Optional[bool] = None,
        recreate_list: Optional[List[str]] = None,
        recreate_platform: str = 'all'
    ):
        """
        Initialize mockup generator

        Args:
            project_config: Project configuration (recommended). If provided,
                           other path arguments are ignored and flags use project defaults.
            screenshots_dir: Directory containing screenshots (legacy, use project_config)
            output_dir: Output directory for mockups (legacy, use project_config)
            templates_dir: Directory containing device templates
            generate_ipad: Whether to generate iPad versions (None = use project default)
            generate_gplay: Whether to generate Google Play versions (None = use project default)
            generate_feature_graphic: Whether to generate Feature Graphic (None = use project default)
            recreate_list: List of screenshot names to force regenerate (ignores checkpoint)
            recreate_platform: Platform to regenerate ('all', 'iphone', 'ipad', 'gplay_phone', 'gplay_tablet')
        """
        self.logger = logging.getLogger(__name__)

        # Recreate flags
        self.recreate_list = recreate_list or []
        self.recreate_platform = recreate_platform

        # Use project config or create default (loyalty-app)
        self.project_config = project_config or LoyaltyAppConfig()

        # Feature flags: explicit args override project config
        self.generate_iphone = self.project_config.generate_iphone
        self.generate_ipad = generate_ipad if generate_ipad is not None else self.project_config.generate_ipad
        self.generate_gplay = generate_gplay if generate_gplay is not None else (
            self.project_config.generate_gplay_phone or self.project_config.generate_gplay_tablet
        )
        self.generate_feature_graphic = generate_feature_graphic if generate_feature_graphic is not None else self.project_config.generate_feature_graphic

        # Set up directories using absolute paths
        resolved_file = Path(__file__).resolve()
        self.script_dir = resolved_file.parent.parent

        # Use project config paths or fallback to legacy args
        if project_config is not None:
            self.screenshots_dir = self.project_config.screenshots_dir
            self.output_dir = self.project_config.mockups_output_dir
            self.top_images_dir = self.project_config.top_images_dir
            self.client_assets_dir = self.project_config.client_assets_dir
            self.repo_root = self.project_config.repo_root
        else:
            # Legacy behavior for backwards compatibility
            repo_root = resolved_file.parent.parent.parent.parent.parent
            white_label_dir = repo_root / "white_label_app"
            self.screenshots_dir = screenshots_dir or (white_label_dir / "screenshots")
            self.output_dir = output_dir or self.screenshots_dir / "mockups"
            self.top_images_dir = self.script_dir / "mockupgen_templates" / "top_images"
            self.client_assets_dir = white_label_dir / "assets" / "client_specific_assets"
            self.repo_root = repo_root

        self.templates_dir = templates_dir or self.script_dir / "mockupgen_templates"
        self.apply_mockup_script = self.script_dir / "apply_mockup.py"

        # Output subdirectories for Apple App Store
        # Folder names match Fastlane deliver conventions and expected resolutions
        self.iphone_output_dir = self.output_dir / "iphone_6_7"  # 1290x2796 → APP_IPHONE_67
        self.ipad_output_dir = self.output_dir / "ipad_12_9"  # 2048x2732 → APP_IPAD_PRO_129

        # Output subdirectories for Google Play Store
        self.gplay_phone_output_dir = self.output_dir / "gplay_phone"
        self.gplay_tablet_output_dir = self.output_dir / "gplay_tablet"

        # Feature Graphic output directory
        self.feature_graphic_output_dir = self.output_dir / "feature_graphic"

        # Initialize ImageMagick service
        self.imagemagick = ImageMagickService()

        # Initialize checkpoint manager (will be set up in generate())
        self.checkpoint: Optional[CheckpointManager] = None

    def _load_primary_color_from_config(self) -> None:
        """
        Load PRIMARY_COLOR from project configuration.

        Sets the PRIMARY_COLOR environment variable from the project config
        so that gradient generation can use it.

        Uses ProjectConfig.get_primary_color() which handles:
        - loyalty-app: reads from white_label_app/config.json
        - loyalty-admin: uses fixed brand color
        """
        primary_color = self.project_config.get_primary_color()

        if primary_color:
            os.environ['PRIMARY_COLOR'] = primary_color
            self._print_info(f"PRIMARY_COLOR carregada: {primary_color}")
        else:
            self.logger.warning(f"Primary color not found for {self.project_config.project_name}")

    def _print_banner(self) -> None:
        """Print application banner"""
        project_name = self.project_config.project_name
        print()
        print(f"{self.MAGENTA}╔═══════════════════════════════════════════╗{self.NC}")
        print(f"{self.MAGENTA}║         📱 Mockup Generator 📱           ║{self.NC}")
        print(f"{self.MAGENTA}║   Python + OpenCV + ImageMagick Pipeline  ║{self.NC}")
        print(f"{self.MAGENTA}╚═══════════════════════════════════════════╝{self.NC}")
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

    def _should_process_platform(self, screenshot_name: str, platform: str) -> bool:
        """
        Check if a platform should be processed for a screenshot.

        Args:
            screenshot_name: Name of the screenshot (without extension)
            platform: Platform name ('iphone', 'ipad', 'gplay_phone', 'gplay_tablet')

        Returns:
            True if platform should be processed, False to skip
        """
        if screenshot_name in self.recreate_list:
            if self.recreate_platform == 'all' or self.recreate_platform == platform:
                return True

        if self.checkpoint and self.checkpoint.is_platform_complete(screenshot_name, platform):
            return False

        return True

    def _delete_existing_mockup(self, screenshot_name: str, platform: str) -> None:
        """Delete existing mockup file before regenerating"""
        platform_dirs = {
            'iphone': self.iphone_output_dir,
            'ipad': self.ipad_output_dir,
            'gplay_phone': self.gplay_phone_output_dir,
            'gplay_tablet': self.gplay_tablet_output_dir
        }

        output_dir = platform_dirs.get(platform)
        if output_dir:
            mockup_path = output_dir / f"{screenshot_name}_mockup.png"
            if mockup_path.exists():
                try:
                    mockup_path.unlink()
                    self.logger.debug(f"Deleted existing mockup: {mockup_path}")
                except IOError as e:
                    self.logger.warning(f"Failed to delete {mockup_path}: {e}")

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

        is_recreate = name in self.recreate_list

        try:
            # === APPLE IPHONE MOCKUP ===
            if self.generate_iphone:
                if not self._should_process_platform(name, 'iphone'):
                    print(f"   {self.CYAN}⏭️{self.NC}  iPhone 6.7\": Ja processado (pulando)")
                    results['iphone'] = True
                else:
                    if is_recreate:
                        self._delete_existing_mockup(name, 'iphone')
                    print("   🍎 iPhone 6.7\": Aplicando cantos arredondados + curvas decorativas...")
                    self._generate_flat_mockup(screenshot_path, template_slug, temp_flat)

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
                    if self.checkpoint:
                        self.checkpoint.mark_platform_complete(name, 'iphone')

            # === GOOGLE PLAY PHONE MOCKUP ===
            if self.generate_gplay:
                if not self._should_process_platform(name, 'gplay_phone'):
                    print(f"   {self.CYAN}⏭️{self.NC}  GPlay Phone: Ja processado (pulando)")
                    results['gplay_phone'] = True
                else:
                    if is_recreate:
                        self._delete_existing_mockup(name, 'gplay_phone')
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
                    if self.checkpoint:
                        self.checkpoint.mark_platform_complete(name, 'gplay_phone')

            # === APPLE IPAD MOCKUP ===
            if self.generate_ipad:
                if not self._should_process_platform(name, 'ipad'):
                    print(f"   {self.CYAN}⏭️{self.NC}  iPad 12.9\": Ja processado (pulando)")
                    results['ipad'] = True
                else:
                    if is_recreate:
                        self._delete_existing_mockup(name, 'ipad')
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
                    if self.checkpoint:
                        self.checkpoint.mark_platform_complete(name, 'ipad')

            # === GOOGLE PLAY TABLET MOCKUP ===
            if self.generate_gplay:
                if not self._should_process_platform(name, 'gplay_tablet'):
                    print(f"   {self.CYAN}⏭️{self.NC}  GPlay Tablet: Ja processado (pulando)")
                    results['gplay_tablet'] = True
                else:
                    if is_recreate:
                        self._delete_existing_mockup(name, 'gplay_tablet')
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
                    if self.checkpoint:
                        self.checkpoint.mark_platform_complete(name, 'gplay_tablet')

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

        # Apple App Store (only show if any Apple output was generated)
        if self.generate_iphone or self.generate_ipad:
            print(f"{self.CYAN}🍎 Apple App Store:{self.NC}")
            if self.generate_iphone:
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
        if self.generate_iphone:
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
            if self.generate_iphone:
                self.iphone_output_dir.mkdir(parents=True, exist_ok=True)
            if self.generate_ipad:
                self.ipad_output_dir.mkdir(parents=True, exist_ok=True)
            if self.generate_gplay:
                self.gplay_phone_output_dir.mkdir(parents=True, exist_ok=True)
                self.gplay_tablet_output_dir.mkdir(parents=True, exist_ok=True)
            if self.generate_feature_graphic:
                self.feature_graphic_output_dir.mkdir(parents=True, exist_ok=True)

            # Initialize checkpoint manager
            self.checkpoint = CheckpointManager(self.output_dir)

            # Check for existing checkpoint (resume functionality)
            is_resuming = False
            if self.checkpoint.exists() and not self.recreate_list:
                is_resuming = self.checkpoint.prompt_resume()

            # Get user choices (or load from checkpoint if resuming)
            if is_resuming and self.checkpoint.state:
                saved_config = self.checkpoint.state.get('config', {})
                device_choice = saved_config.get('device_choice', 1)
                gradient_choice = saved_config.get('gradient_choice', 0)
                add_logo = saved_config.get('add_logo', True)

                device_type, device_name, template_slug = DeviceType.get_by_choice(device_choice)

                if gradient_choice == 0:
                    self._load_primary_color_from_config()
                style_name, gradient_start, gradient_end = GradientStyle.get_by_index(gradient_choice)

                self._print_info(f"Retomando com configuração salva: {device_name}, {style_name}")
            else:
                device_type, device_name, template_slug = self._prompt_device_choice()
                style_name, gradient_start, gradient_end = self._prompt_gradient_choice()
                add_logo = self._prompt_logo_choice()

                device_choice = 1 if template_slug == 'iphone15promax' else 2
                gradient_choice = int(os.getenv('GRADIENT_CHOICE', '0'))

                self.checkpoint.initialize({
                    'device_choice': device_choice,
                    'gradient_choice': gradient_choice,
                    'add_logo': add_logo,
                    'generate_iphone': self.generate_iphone,
                    'generate_ipad': self.generate_ipad,
                    'generate_gplay': self.generate_gplay
                })

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

            # Show Apple App Store targets only if enabled
            if self.generate_iphone or self.generate_ipad:
                print(f"   {self.CYAN}🍎 Apple App Store:{self.NC}")
                if self.generate_iphone:
                    print(f"      iPhone 6.7\": 1290x2796 (cantos arredondados)")
                if self.generate_ipad:
                    print(f"      iPad 12.9\": 2048x2732 (cantos arredondados)")

            # Show Google Play targets only if enabled
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
            # Success is defined by at least one output type having been generated
            total_mockups = sum([
                counts['iphone'] if self.generate_iphone else 0,
                counts['ipad'] if self.generate_ipad else 0,
                counts['gplay_phone'] if self.generate_gplay else 0,
                counts['gplay_tablet'] if self.generate_gplay else 0,
            ])

            if total_mockups == 0:
                self._print_error("Nenhum mockup foi criado com sucesso!")
                return 1

            # Clear checkpoint on success
            if self.checkpoint:
                self.checkpoint.clear()
                self._print_success("Checkpoint removido (processo concluído)")

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
