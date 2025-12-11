#!/usr/bin/env python3
"""
ImageMagick Service

Wraps ImageMagick operations for creating mockup effects.
"""

import subprocess
from pathlib import Path
from typing import Optional, Tuple
import logging

# Import configuration
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.screenshot_config import MockupConfig, AppleStoreConfig, GooglePlayConfig, LayoutConfig, DecorativeCurvesConfig, DeviceConfig, TopImageConfig, BottomLogoConfig, FeatureGraphicConfig
from services.color_utils import lighten_color
from services.curve_generator import CurveGenerator


class ImageMagickError(Exception):
    """Raised when ImageMagick operations fail"""
    pass


class ImageMagickService:
    """Service for ImageMagick operations"""

    # Commands
    MAGICK_CMD = "magick"
    CONVERT_CMD = "convert"  # Fallback for older ImageMagick

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.cmd = self._detect_imagemagick_cmd()
        self.curve_generator = CurveGenerator()

    def _detect_imagemagick_cmd(self) -> str:
        """
        Detect which ImageMagick command is available

        Returns:
            Command name ('magick' or 'convert')

        Raises:
            ImageMagickError: If ImageMagick not found
        """
        # Try 'magick' first (ImageMagick 7+)
        try:
            subprocess.run(
                [self.MAGICK_CMD, "--version"],
                capture_output=True,
                check=True
            )
            return self.MAGICK_CMD
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        # Try 'convert' (ImageMagick 6)
        try:
            subprocess.run(
                [self.CONVERT_CMD, "--version"],
                capture_output=True,
                check=True
            )
            self.logger.warning("Using legacy 'convert' command (ImageMagick 6). Consider upgrading to ImageMagick 7.")
            return self.CONVERT_CMD
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise ImageMagickError(
                "ImageMagick not found. Please install ImageMagick 7+ or ImageMagick 6."
            )

    def _run_magick(
        self,
        args: list,
        check: bool = True
    ) -> subprocess.CompletedProcess:
        """
        Run ImageMagick command

        Args:
            args: Arguments to pass to ImageMagick
            check: Whether to raise exception on failure

        Returns:
            CompletedProcess

        Raises:
            ImageMagickError: If command fails and check=True
        """
        cmd = [self.cmd] + args
        self.logger.debug(f"Running: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=check
            )
            return result
        except subprocess.CalledProcessError as e:
            raise ImageMagickError(
                f"ImageMagick command failed: {' '.join(cmd)}\n"
                f"Error: {e.stderr}"
            )

    def apply_3d_perspective(
        self,
        input_path: Path,
        output_path: Path,
        rotation_angle: int,
        gradient_start: str,
        gradient_end: str
    ) -> None:
        """
        Apply perspective transformation with gradient background

        Uses a multi-step process:
        1. Apply perspective distortion to mockup
        2. Create gradient background
        3. Create shadow from perspective image
        4. Composite all layers: gradient + shadow + mockup

        Args:
            input_path: Path to flat mockup image
            output_path: Path for output mockup
            rotation_angle: Rotation angle in degrees (15, 20, or 25)
            gradient_start: Hex color for gradient start (e.g., "#667eea")
            gradient_end: Hex color for gradient end (e.g., "#764ba2")

        Raises:
            ImageMagickError: If transformation fails
        """
        import tempfile

        # Guard clauses
        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        if rotation_angle not in [
            MockupConfig.ROTATION_SUBTLE,
            MockupConfig.ROTATION_MODERATE,
            MockupConfig.ROTATION_PRONOUNCED
        ]:
            raise ImageMagickError(
                f"Invalid rotation angle: {rotation_angle}. "
                f"Must be {MockupConfig.ROTATION_SUBTLE}, "
                f"{MockupConfig.ROTATION_MODERATE}, or "
                f"{MockupConfig.ROTATION_PRONOUNCED}"
            )

        # Calculate perspective coefficients
        top_coef = rotation_angle * MockupConfig.PERSPECTIVE_TOP_MULTIPLIER
        bottom_coef = rotation_angle * MockupConfig.PERSPECTIVE_BOTTOM_MULTIPLIER

        # Calculate shadow offset
        shadow_x_offset = rotation_angle + MockupConfig.SHADOW_OFFSET_X_ADDITION

        # Create temporary files for multi-step process
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_perspective = Path(temp_dir) / "perspective.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_shadow = Path(temp_dir) / "shadow.png"

            # Step 1: Apply perspective distortion
            perspective_args = [
                str(input_path),
                "-distort", "Perspective",
                f"0,0 {top_coef},0 "
                f"1404,0 {1404-top_coef},0 "
                f"1404,2895 {1404-bottom_coef},2895 "
                f"0,2895 {bottom_coef},2895",
                "-resize", f"{MockupConfig.CANVAS_WIDTH}x{MockupConfig.CANVAS_HEIGHT}",
                str(temp_perspective)
            ]
            self._run_magick(perspective_args)

            # Step 2: Create gradient background
            gradient_args = [
                "-size", f"{MockupConfig.CANVAS_WIDTH}x{MockupConfig.CANVAS_HEIGHT}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 3: Create shadow from perspective image
            shadow_args = [
                str(temp_perspective),
                "-background", "black",
                "-shadow", f"{MockupConfig.SHADOW_BLUR}x{MockupConfig.SHADOW_SPREAD}+{shadow_x_offset}+{MockupConfig.SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 4: Composite all layers: gradient + shadow + mockup
            composite_args = [
                str(temp_gradient),
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_perspective), "-gravity", "center", "-composite",
                str(output_path)
            ]
            self._run_magick(composite_args)

        self.logger.info(f"Created mockup: {output_path}")

    def composite_on_gradient(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        canvas_width: int = None,
        canvas_height: int = None,
        asymmetric_position: bool = True
    ) -> None:
        """
        Composite mockup on gradient background

        By default uses asymmetric positioning:
        - 25% space at top (for future marketing content)
        - 65% for the mockup
        - 10% space at bottom

        Args:
            input_path: Path to flat mockup image (screenshot in device frame)
            output_path: Path for output image
            gradient_start: Hex color for gradient start
            gradient_end: Hex color for gradient end
            canvas_width: Output width (default from MockupConfig)
            canvas_height: Output height (default from MockupConfig)
            asymmetric_position: Use asymmetric positioning (default True)

        Raises:
            ImageMagickError: If composition fails
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        width = canvas_width or MockupConfig.CANVAS_WIDTH
        height = canvas_height or MockupConfig.CANVAS_HEIGHT

        if asymmetric_position:
            # Use asymmetric positioning with separate steps
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_gradient = Path(temp_dir) / "gradient.png"

                # Step 1: Create gradient background
                gradient_args = [
                    "-size", f"{width}x{height}",
                    f"gradient:{gradient_start}-{gradient_end}",
                    str(temp_gradient)
                ]
                self._run_magick(gradient_args)

                # Step 2: Composite with asymmetric positioning
                self.composite_with_asymmetric_position(
                    background_path=temp_gradient,
                    foreground_path=input_path,
                    output_path=output_path,
                    canvas_height=height
                )
        else:
            # Original centered composition
            args = [
                "-size", f"{width}x{height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(input_path),
                "-gravity", "center",
                "-composite",
                str(output_path)
            ]
            self._run_magick(args)

        self.logger.info(f"Created mockup with gradient: {output_path}")

    def create_gradient(
        self,
        width: int,
        height: int,
        start_color: str,
        end_color: str,
        output_path: Path
    ) -> None:
        """
        Create gradient image

        Args:
            width: Image width
            height: Image height
            start_color: Hex color for start
            end_color: Hex color for end
            output_path: Output file path
        """
        args = [
            "-size", f"{width}x{height}",
            f"gradient:{start_color}-{end_color}",
            str(output_path)
        ]

        self._run_magick(args)

    def composite_images(
        self,
        background_path: Path,
        foreground_path: Path,
        output_path: Path,
        gravity: str = "center"
    ) -> None:
        """
        Composite two images

        Args:
            background_path: Background image
            foreground_path: Foreground image
            output_path: Output file
            gravity: Composite gravity (center, north, etc.)
        """
        args = [
            str(background_path),
            str(foreground_path),
            "-gravity", gravity,
            "-composite",
            str(output_path)
        ]

        self._run_magick(args)

    def composite_with_asymmetric_position(
        self,
        background_path: Path,
        foreground_path: Path,
        output_path: Path,
        canvas_height: int
    ) -> None:
        """
        Composite foreground on background with asymmetric vertical positioning.

        Positions the foreground image with:
        - 25% space at top (for future marketing content)
        - 65% for the mockup
        - 10% space at bottom (aesthetic margin)

        Args:
            background_path: Background image (gradient)
            foreground_path: Foreground image (mockup with shadow)
            output_path: Output file
            canvas_height: Height of the canvas for offset calculation
        """
        # Calculate top offset based on layout config
        top_offset = LayoutConfig.get_top_offset(canvas_height)

        # Use north gravity with vertical offset
        args = [
            str(background_path),
            str(foreground_path),
            "-gravity", "north",
            "-geometry", f"+0+{top_offset}",
            "-composite",
            str(output_path)
        ]

        self._run_magick(args)

    def get_image_size(self, image_path: Path) -> Tuple[int, int]:
        """
        Get image dimensions

        Args:
            image_path: Path to image

        Returns:
            Tuple of (width, height)
        """
        args = [str(image_path), "-format", "%wx%h", "info:"]

        result = self._run_magick(args)
        width, height = result.stdout.strip().split('x')

        return int(width), int(height)

    def resize_image(
        self,
        input_path: Path,
        output_path: Path,
        width: int,
        height: int
    ) -> None:
        """
        Resize image to exact dimensions

        Args:
            input_path: Source image
            output_path: Output image
            width: Target width
            height: Target height
        """
        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        args = [
            str(input_path),
            "-resize", f"{width}x{height}!",
            str(output_path)
        ]

        self._run_magick(args)
        self.logger.info(f"Resized image to {width}x{height}: {output_path}")

    def resize_to_apple_iphone(
        self,
        input_path: Path,
        output_path: Path
    ) -> None:
        """
        Resize mockup to Apple iPhone 6.9" dimensions (1320x2868)

        Args:
            input_path: Source mockup image
            output_path: Output image path
        """
        self.resize_image(
            input_path,
            output_path,
            AppleStoreConfig.IPHONE_69_WIDTH,
            AppleStoreConfig.IPHONE_69_HEIGHT
        )

    def create_ipad_screenshot(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str
    ) -> None:
        """
        Create iPad screenshot from iPhone screenshot (NO device frame)

        Uses asymmetric positioning:
        - 25% space at top (for future marketing content)
        - 65% for the screenshot
        - 10% space at bottom

        Process:
        1. Crop center to iPad aspect ratio (0.75)
        2. Resize to fit within 65% of canvas height
        3. Apply rounded corners
        4. Add shadow
        5. Composite on gradient background with asymmetric positioning

        Args:
            input_path: Source iPhone screenshot (raw, not mockup)
            output_path: Output iPad screenshot
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get source dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Final canvas dimensions
        final_width = AppleStoreConfig.IPAD_13_WIDTH
        final_height = AppleStoreConfig.IPAD_13_HEIGHT
        corner_radius = AppleStoreConfig.IPAD_CORNER_RADIUS

        # Calculate available space for screenshot (65% of height, 90% of width)
        max_screenshot_height = LayoutConfig.get_mockup_max_height(final_height)
        max_screenshot_width = LayoutConfig.get_mockup_max_width(final_width)

        # Target aspect ratio for iPad (0.75)
        target_aspect = AppleStoreConfig.IPAD_13_ASPECT_RATIO

        # Crop source to target aspect ratio
        # Skip status bar area to avoid dark bar at top
        status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS

        new_height = int(src_width / target_aspect)
        if new_height > src_height - status_bar_offset:
            new_height = src_height - status_bar_offset
            new_width = int(new_height * target_aspect)
            crop_x = (src_width - new_width) // 2
            crop_y = status_bar_offset
        else:
            new_width = src_width
            crop_x = 0
            crop_y = status_bar_offset  # Skip status bar

        # Calculate screenshot size to fit within available space (maintaining aspect ratio)
        screenshot_aspect = new_width / new_height
        if max_screenshot_width / max_screenshot_height > screenshot_aspect:
            # Height is limiting factor
            screenshot_height = max_screenshot_height
            screenshot_width = int(screenshot_height * screenshot_aspect)
        else:
            # Width is limiting factor
            screenshot_width = max_screenshot_width
            screenshot_height = int(screenshot_width / screenshot_aspect)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_cropped = Path(temp_dir) / "cropped.png"
            temp_resized = Path(temp_dir) / "resized.png"
            temp_rounded = Path(temp_dir) / "rounded.png"
            temp_shadow = Path(temp_dir) / "shadow.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_with_shadow = Path(temp_dir) / "with_shadow.png"

            # Step 1: Crop to iPad aspect ratio
            crop_args = [
                str(input_path),
                "-crop", f"{new_width}x{new_height}+{crop_x}+{crop_y}",
                "+repage",
                str(temp_cropped)
            ]
            self._run_magick(crop_args)

            # Step 2: Resize to calculated dimensions
            resize_args = [
                str(temp_cropped),
                "-resize", f"{screenshot_width}x{screenshot_height}",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 3: Apply rounded corners using mask
            rounded_args = [
                str(temp_resized),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 4: Create shadow
            shadow_args = [
                str(temp_rounded),
                "-background", "none",
                "-shadow", f"{AppleStoreConfig.IPAD_SHADOW_BLUR}x{AppleStoreConfig.IPAD_SHADOW_BLUR}+0+{AppleStoreConfig.IPAD_SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 5: Create gradient background
            gradient_args = [
                "-size", f"{final_width}x{final_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 6: Composite shadow and rounded screenshot together (centered)
            shadow_composite_args = [
                "-size", f"{screenshot_width + 100}x{screenshot_height + 100}",
                "xc:none",
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_rounded), "-gravity", "center", "-composite",
                str(temp_with_shadow)
            ]
            self._run_magick(shadow_composite_args)

            # Step 7: Composite with asymmetric positioning
            self.composite_with_asymmetric_position(
                background_path=temp_gradient,
                foreground_path=temp_with_shadow,
                output_path=output_path,
                canvas_height=final_height
            )

        self.logger.info(f"Created iPad screenshot: {output_path}")

    def resize_to_google_play_phone(
        self,
        input_path: Path,
        output_path: Path
    ) -> None:
        """
        Resize mockup to Google Play Phone dimensions (1080x1920)

        Args:
            input_path: Source mockup image
            output_path: Output image path
        """
        self.resize_image(
            input_path,
            output_path,
            GooglePlayConfig.PHONE_WIDTH,
            GooglePlayConfig.PHONE_HEIGHT
        )

    def create_google_play_phone_screenshot(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str
    ) -> None:
        """
        Create Google Play phone screenshot from iPhone screenshot (NO device frame)

        Google Play prohibits device frames in screenshots. This creates a clean
        screenshot with rounded corners and gradient background.

        Uses asymmetric positioning:
        - 25% space at top (for future marketing content)
        - 65% for the screenshot
        - 10% space at bottom

        Process:
        1. Crop center to 9:16 aspect ratio
        2. Resize to fit within 65% of canvas height
        3. Apply rounded corners
        4. Add shadow
        5. Composite on gradient background with asymmetric positioning

        Args:
            input_path: Source iPhone screenshot (raw, not mockup)
            output_path: Output phone screenshot
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get source dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Final canvas dimensions
        final_width = GooglePlayConfig.PHONE_WIDTH
        final_height = GooglePlayConfig.PHONE_HEIGHT
        corner_radius = GooglePlayConfig.CORNER_RADIUS

        # Calculate available space for screenshot (65% of height, 90% of width)
        max_screenshot_height = LayoutConfig.get_mockup_max_height(final_height)
        max_screenshot_width = LayoutConfig.get_mockup_max_width(final_width)

        # Target aspect ratio for phone (9:16)
        target_aspect = GooglePlayConfig.PHONE_ASPECT_RATIO

        # Crop source to target aspect ratio
        # Skip status bar area to avoid dark bar at top
        status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS

        new_height = int(src_width / target_aspect)
        if new_height > src_height - status_bar_offset:
            new_height = src_height - status_bar_offset
            new_width = int(new_height * target_aspect)
            crop_x = (src_width - new_width) // 2
            crop_y = status_bar_offset
        else:
            new_width = src_width
            crop_x = 0
            crop_y = status_bar_offset  # Skip status bar

        # Calculate screenshot size to fit within available space (maintaining aspect ratio)
        screenshot_aspect = new_width / new_height
        if max_screenshot_width / max_screenshot_height > screenshot_aspect:
            # Height is limiting factor
            screenshot_height = max_screenshot_height
            screenshot_width = int(screenshot_height * screenshot_aspect)
        else:
            # Width is limiting factor
            screenshot_width = max_screenshot_width
            screenshot_height = int(screenshot_width / screenshot_aspect)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_cropped = Path(temp_dir) / "cropped.png"
            temp_resized = Path(temp_dir) / "resized.png"
            temp_rounded = Path(temp_dir) / "rounded.png"
            temp_shadow = Path(temp_dir) / "shadow.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_with_shadow = Path(temp_dir) / "with_shadow.png"

            # Step 1: Crop to phone aspect ratio
            crop_args = [
                str(input_path),
                "-crop", f"{new_width}x{new_height}+{crop_x}+{crop_y}",
                "+repage",
                str(temp_cropped)
            ]
            self._run_magick(crop_args)

            # Step 2: Resize to calculated dimensions
            resize_args = [
                str(temp_cropped),
                "-resize", f"{screenshot_width}x{screenshot_height}",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 3: Apply rounded corners
            rounded_args = [
                str(temp_resized),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 4: Create shadow
            shadow_args = [
                str(temp_rounded),
                "-background", "none",
                "-shadow", f"{GooglePlayConfig.SHADOW_BLUR}x{GooglePlayConfig.SHADOW_BLUR}+0+{GooglePlayConfig.SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 5: Create gradient background
            gradient_args = [
                "-size", f"{final_width}x{final_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 6: Composite shadow and rounded screenshot together (centered)
            # Create a transparent canvas and add shadow + screenshot
            shadow_composite_args = [
                "-size", f"{screenshot_width + 100}x{screenshot_height + 100}",
                "xc:none",
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_rounded), "-gravity", "center", "-composite",
                str(temp_with_shadow)
            ]
            self._run_magick(shadow_composite_args)

            # Step 7: Composite with asymmetric positioning
            self.composite_with_asymmetric_position(
                background_path=temp_gradient,
                foreground_path=temp_with_shadow,
                output_path=output_path,
                canvas_height=final_height
            )

        self.logger.info(f"Created Google Play phone screenshot: {output_path}")

    def create_google_play_tablet_screenshot(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str
    ) -> None:
        """
        Create Google Play tablet screenshot from iPhone screenshot (NO device frame)

        Uses asymmetric positioning:
        - 25% space at top (for future marketing content)
        - 65% for the screenshot
        - 10% space at bottom

        Process:
        1. Crop center to tablet aspect ratio (0.625)
        2. Resize to fit within 65% of canvas height
        3. Apply rounded corners
        4. Add shadow
        5. Composite on gradient background with asymmetric positioning

        Args:
            input_path: Source iPhone screenshot (raw, not mockup)
            output_path: Output tablet screenshot
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get source dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Final canvas dimensions
        final_width = GooglePlayConfig.TABLET_WIDTH
        final_height = GooglePlayConfig.TABLET_HEIGHT
        corner_radius = GooglePlayConfig.CORNER_RADIUS

        # Calculate available space for screenshot (65% of height, 90% of width)
        max_screenshot_height = LayoutConfig.get_mockup_max_height(final_height)
        max_screenshot_width = LayoutConfig.get_mockup_max_width(final_width)

        # Target aspect ratio for tablet (0.625)
        target_aspect = GooglePlayConfig.TABLET_ASPECT_RATIO

        # Crop source to target aspect ratio
        # Skip status bar area to avoid dark bar at top
        status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS

        new_height = int(src_width / target_aspect)
        if new_height > src_height - status_bar_offset:
            new_height = src_height - status_bar_offset
            new_width = int(new_height * target_aspect)
            crop_x = (src_width - new_width) // 2
            crop_y = status_bar_offset
        else:
            new_width = src_width
            crop_x = 0
            crop_y = status_bar_offset  # Skip status bar

        # Calculate screenshot size to fit within available space (maintaining aspect ratio)
        screenshot_aspect = new_width / new_height
        if max_screenshot_width / max_screenshot_height > screenshot_aspect:
            # Height is limiting factor
            screenshot_height = max_screenshot_height
            screenshot_width = int(screenshot_height * screenshot_aspect)
        else:
            # Width is limiting factor
            screenshot_width = max_screenshot_width
            screenshot_height = int(screenshot_width / screenshot_aspect)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_cropped = Path(temp_dir) / "cropped.png"
            temp_resized = Path(temp_dir) / "resized.png"
            temp_rounded = Path(temp_dir) / "rounded.png"
            temp_shadow = Path(temp_dir) / "shadow.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_with_shadow = Path(temp_dir) / "with_shadow.png"

            # Step 1: Crop to tablet aspect ratio
            crop_args = [
                str(input_path),
                "-crop", f"{new_width}x{new_height}+{crop_x}+{crop_y}",
                "+repage",
                str(temp_cropped)
            ]
            self._run_magick(crop_args)

            # Step 2: Resize to calculated dimensions
            resize_args = [
                str(temp_cropped),
                "-resize", f"{screenshot_width}x{screenshot_height}",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 3: Apply rounded corners using mask
            rounded_args = [
                str(temp_resized),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 4: Create shadow
            shadow_args = [
                str(temp_rounded),
                "-background", "none",
                "-shadow", f"{GooglePlayConfig.SHADOW_BLUR}x{GooglePlayConfig.SHADOW_BLUR}+0+{GooglePlayConfig.SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 5: Create gradient background
            gradient_args = [
                "-size", f"{final_width}x{final_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 6: Composite shadow and rounded screenshot together (centered)
            shadow_composite_args = [
                "-size", f"{screenshot_width + 100}x{screenshot_height + 100}",
                "xc:none",
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_rounded), "-gravity", "center", "-composite",
                str(temp_with_shadow)
            ]
            self._run_magick(shadow_composite_args)

            # Step 7: Composite with asymmetric positioning
            self.composite_with_asymmetric_position(
                background_path=temp_gradient,
                foreground_path=temp_with_shadow,
                output_path=output_path,
                canvas_height=final_height
            )

        self.logger.info(f"Created Google Play tablet screenshot: {output_path}")

    def resize_mockup_to_fit(
        self,
        input_path: Path,
        max_width: int,
        max_height: int,
        output_path: Path
    ) -> None:
        """
        Resize mockup to fit within maximum dimensions while maintaining aspect ratio.

        This ensures the mockup doesn't get cropped when placed with asymmetric
        positioning (25% top offset).

        Args:
            input_path: Source mockup image
            max_width: Maximum allowed width
            max_height: Maximum allowed height
            output_path: Output image path
        """
        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get current dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Calculate scale factor to fit within max dimensions
        scale_w = max_width / src_width
        scale_h = max_height / src_height
        scale = min(scale_w, scale_h)

        # Only resize if image is larger than max dimensions
        if scale < 1.0:
            new_width = int(src_width * scale)
            new_height = int(src_height * scale)

            args = [
                str(input_path),
                "-resize", f"{new_width}x{new_height}",
                str(output_path)
            ]
            self._run_magick(args)
            self.logger.info(f"Resized mockup to fit: {new_width}x{new_height}")
        else:
            # Just copy if already fits
            import shutil
            shutil.copy(input_path, output_path)
            self.logger.info(f"Mockup already fits within {max_width}x{max_height}")

    def composite_with_decorative_curves(
        self,
        foreground_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        canvas_width: int,
        canvas_height: int,
        seed: str,
        top_image_path: Optional[Path] = None
    ) -> None:
        """
        Composite mockup on gradient background with decorative curves.

        Layer order (bottom to top):
        1. Gradient background
        2. Decorative curves (lighter shade of primary color)
        3. Top image (optional, placed in top space)
        4. Mockup/screenshot

        Args:
            foreground_path: Path to mockup image (with frame or rounded corners)
            output_path: Path for final output
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
            canvas_width: Canvas width in pixels
            canvas_height: Canvas height in pixels
            seed: Seed string for reproducible curve generation (typically filename)
            top_image_path: Optional path to image to place in top space
        """
        import tempfile

        if not foreground_path.exists():
            raise ImageMagickError(f"Input file not found: {foreground_path}")

        # Calculate curve color (lighter shade of gradient start)
        curve_color = lighten_color(gradient_start, DecorativeCurvesConfig.LIGHTNESS_INCREASE)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_curves = Path(temp_dir) / "curves.png"
            temp_bg_with_curves = Path(temp_dir) / "bg_with_curves.png"
            temp_bg_with_top_image = Path(temp_dir) / "bg_with_top_image.png"

            # Step 1: Create gradient background
            gradient_args = [
                "-size", f"{canvas_width}x{canvas_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 2: Generate decorative curves
            self.curve_generator.create_curve_overlay(
                width=canvas_width,
                height=canvas_height,
                curve_color=curve_color,
                seed=seed,
                output_path=temp_curves
            )

            # Step 3: Composite curves on gradient
            curves_composite_args = [
                str(temp_gradient),
                str(temp_curves),
                "-gravity", "center",
                "-composite",
                str(temp_bg_with_curves)
            ]
            self._run_magick(curves_composite_args)

            # Step 4: Add top image if provided
            final_bg = temp_bg_with_curves
            if top_image_path and top_image_path.exists():
                self._add_top_image(
                    background_path=temp_bg_with_curves,
                    top_image_path=top_image_path,
                    output_path=temp_bg_with_top_image,
                    canvas_width=canvas_width,
                    canvas_height=canvas_height
                )
                final_bg = temp_bg_with_top_image

            # Step 5: Composite foreground with asymmetric positioning
            self.composite_with_asymmetric_position(
                background_path=final_bg,
                foreground_path=foreground_path,
                output_path=output_path,
                canvas_height=canvas_height
            )

        self.logger.info(f"Created mockup with decorative curves: {output_path}")

    def _add_top_image(
        self,
        background_path: Path,
        top_image_path: Path,
        output_path: Path,
        canvas_width: int,
        canvas_height: int,
        device_type: str = 'iphone'
    ) -> None:
        """
        Add an image to the top space of the background.

        The image is scaled respecting TWO constraints:
        1. Maximum width (% of canvas width)
        2. Maximum height (% of top space)

        Uses the smaller scale factor to ensure both constraints are met.
        PNG transparency is preserved.

        Args:
            background_path: Path to background image
            top_image_path: Path to top image to add (PNG with transparency)
            output_path: Output path for result
            canvas_width: Canvas width in pixels
            canvas_height: Canvas height in pixels
            device_type: Device type for configuration ('iphone', 'ipad', 'gplay_phone', 'gplay_tablet')
        """
        # Get device-specific configuration
        config = TopImageConfig.get_config(device_type)

        # Calculate constraint dimensions
        top_space_height = LayoutConfig.get_top_offset(canvas_height)
        max_width = int(canvas_width * config.max_width_percent)
        max_height = int(top_space_height * config.max_height_percent)
        top_padding = int(top_space_height * config.top_padding_percent)

        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_resized = Path(temp_dir) / "top_image_resized.png"

            # Get original image dimensions
            orig_width, orig_height = self.get_image_size(top_image_path)

            # Calculate scale factors for BOTH constraints
            scale_by_width = max_width / orig_width
            scale_by_height = max_height / orig_height

            # Use the SMALLER scale to ensure image fits BOTH constraints
            scale = min(scale_by_width, scale_by_height)

            new_width = int(orig_width * scale)
            new_height = int(orig_height * scale)

            self.logger.debug(
                f"Top image [{device_type}]: {orig_width}x{orig_height} -> "
                f"{new_width}x{new_height} (max: {max_width}x{max_height})"
            )

            # Step 1: Resize maintaining aspect ratio
            resize_args = [
                str(top_image_path),
                "-resize", f"{new_width}x{new_height}",
                "-background", "none",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 2: Calculate vertical offset based on alignment
            available_height = top_space_height - top_padding
            remaining_space = available_height - new_height

            if config.vertical_align == "top":
                vertical_offset = top_padding
            elif config.vertical_align == "bottom":
                vertical_offset = top_padding + max(0, remaining_space)
            else:  # center (default)
                vertical_offset = top_padding + max(0, remaining_space // 2)

            # Step 3: Composite top image onto background
            composite_args = [
                str(background_path),
                str(temp_resized),
                "-gravity", "north",
                "-geometry", f"+0+{vertical_offset}",
                "-compose", "Over",
                "-composite",
                str(output_path)
            ]
            self._run_magick(composite_args)

        self.logger.info(f"Added top image [{device_type}]: {top_image_path.name}")

    def _add_bottom_logo(
        self,
        background_path: Path,
        logo_path: Path,
        output_path: Path,
        canvas_width: int,
        canvas_height: int,
        device_type: str = 'iphone'
    ) -> None:
        """
        Add a logo to the bottom-right corner of the background.

        The logo is scaled respecting TWO constraints:
        1. Maximum width (% of canvas width)
        2. Maximum height (% of bottom space - 10% of canvas height)

        Uses the smaller scale factor to ensure both constraints are met.
        PNG transparency is preserved.

        Args:
            background_path: Path to background image
            logo_path: Path to logo image (PNG with transparency)
            output_path: Output path for result
            canvas_width: Canvas width in pixels
            canvas_height: Canvas height in pixels
            device_type: Device type for configuration ('iphone', 'ipad', 'gplay_phone', 'gplay_tablet')
        """
        # Get device-specific configuration
        config = BottomLogoConfig.get_config(device_type)

        # Calculate bottom space (10% of canvas height)
        bottom_space_height = int(canvas_height * LayoutConfig.BOTTOM_SPACE_PERCENT)

        # Calculate constraint dimensions
        max_width = int(canvas_width * config.max_width_percent)
        max_height = int(bottom_space_height * config.max_height_percent)
        right_padding = int(canvas_width * config.right_padding_percent)
        bottom_padding = int(bottom_space_height * config.bottom_padding_percent)

        import tempfile
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_resized = Path(temp_dir) / "logo_resized.png"

            # Get original image dimensions
            orig_width, orig_height = self.get_image_size(logo_path)

            # Calculate scale factors for BOTH constraints
            scale_by_width = max_width / orig_width
            scale_by_height = max_height / orig_height

            # Use the SMALLER scale to ensure image fits BOTH constraints
            scale = min(scale_by_width, scale_by_height)

            new_width = int(orig_width * scale)
            new_height = int(orig_height * scale)

            self.logger.debug(
                f"Bottom logo [{device_type}]: {orig_width}x{orig_height} -> "
                f"{new_width}x{new_height} (max: {max_width}x{max_height})"
            )

            # Step 1: Resize maintaining aspect ratio
            resize_args = [
                str(logo_path),
                "-resize", f"{new_width}x{new_height}",
                "-background", "none",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 2: Composite logo onto background at bottom-right
            # Using southeast gravity with padding offset
            composite_args = [
                str(background_path),
                str(temp_resized),
                "-gravity", "southeast",
                "-geometry", f"+{right_padding}+{bottom_padding}",
                "-compose", "Over",
                "-composite",
                str(output_path)
            ]
            self._run_magick(composite_args)

        self.logger.info(f"Added bottom logo [{device_type}]: {logo_path.name}")

    def create_iphone_mockup_with_curves(
        self,
        flat_mockup_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        seed: str,
        top_image_path: Optional[Path] = None,
        bottom_logo_path: Optional[Path] = None
    ) -> None:
        """
        Create iPhone mockup with gradient background and decorative curves.

        This is a high-level method that combines:
        1. Resize mockup to fit within available space
        2. Generate gradient + curves background
        3. Add optional top image
        4. Add optional bottom-right logo
        5. Composite with asymmetric positioning
        6. Resize to final iPhone 6.9" dimensions

        Args:
            flat_mockup_path: Path to flat mockup (screenshot in device frame)
            output_path: Final output path
            gradient_start: Gradient start color
            gradient_end: Gradient end color
            seed: Seed for curve generation (filename)
            top_image_path: Optional path to image for top space
            bottom_logo_path: Optional path to logo for bottom-right corner
        """
        import tempfile

        # Use large canvas for quality, then resize
        canvas_width = MockupConfig.CANVAS_WIDTH
        canvas_height = MockupConfig.CANVAS_HEIGHT

        # Calculate max dimensions for mockup (72% height, 90% width)
        max_mockup_height = LayoutConfig.get_mockup_max_height(canvas_height)
        max_mockup_width = LayoutConfig.get_mockup_max_width(canvas_width)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_resized_mockup = Path(temp_dir) / "resized_mockup.png"
            temp_large_output = Path(temp_dir) / "large_output.png"
            temp_with_logo = Path(temp_dir) / "with_logo.png"

            # Step 1: Resize mockup to fit within available space
            self.resize_mockup_to_fit(
                input_path=flat_mockup_path,
                max_width=max_mockup_width,
                max_height=max_mockup_height,
                output_path=temp_resized_mockup
            )

            # Step 2: Composite with gradient, curves, and optional top image
            self.composite_with_decorative_curves(
                foreground_path=temp_resized_mockup,
                output_path=temp_large_output,
                gradient_start=gradient_start,
                gradient_end=gradient_end,
                canvas_width=canvas_width,
                canvas_height=canvas_height,
                seed=seed,
                top_image_path=top_image_path
            )

            # Step 3: Add bottom logo if provided
            final_large = temp_large_output
            if bottom_logo_path and bottom_logo_path.exists():
                self._add_bottom_logo(
                    background_path=temp_large_output,
                    logo_path=bottom_logo_path,
                    output_path=temp_with_logo,
                    canvas_width=canvas_width,
                    canvas_height=canvas_height,
                    device_type='iphone'
                )
                final_large = temp_with_logo

            # Step 4: Resize to final iPhone dimensions
            self.resize_to_apple_iphone(final_large, output_path)

        self.logger.info(f"Created iPhone mockup with curves: {output_path}")

    def create_ipad_screenshot_with_curves(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        seed: str,
        top_image_path: Optional[Path] = None,
        bottom_logo_path: Optional[Path] = None
    ) -> None:
        """
        Create iPad screenshot with gradient background and decorative curves.

        Process:
        1. Crop center to iPad aspect ratio (0.75)
        2. Resize to fit within 65% of canvas height
        3. Apply rounded corners
        4. Add shadow
        5. Composite on gradient + curves background
        6. Add optional top image
        7. Add optional bottom-right logo

        Args:
            input_path: Source iPhone screenshot (raw, not mockup)
            output_path: Output iPad screenshot
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
            seed: Seed for curve generation (filename)
            top_image_path: Optional path to image for top space
            bottom_logo_path: Optional path to logo for bottom-right corner
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get source dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Final canvas dimensions
        final_width = AppleStoreConfig.IPAD_13_WIDTH
        final_height = AppleStoreConfig.IPAD_13_HEIGHT
        corner_radius = AppleStoreConfig.IPAD_CORNER_RADIUS

        # Calculate available space for screenshot (65% of height, 90% of width)
        max_screenshot_height = LayoutConfig.get_mockup_max_height(final_height)
        max_screenshot_width = LayoutConfig.get_mockup_max_width(final_width)

        # Target aspect ratio for iPad (0.75)
        target_aspect = AppleStoreConfig.IPAD_13_ASPECT_RATIO

        # Crop source to target aspect ratio
        # Skip status bar area to avoid dark bar at top of screenshots
        status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS

        new_height = int(src_width / target_aspect)
        if new_height > src_height - status_bar_offset:
            # Source is too short - crop width to fit, keep most height
            new_height = src_height - status_bar_offset
            new_width = int(new_height * target_aspect)
            crop_x = (src_width - new_width) // 2  # Center horizontally
            crop_y = status_bar_offset  # Start after status bar
        else:
            # Source is tall enough - crop from after status bar
            new_width = src_width
            crop_x = 0
            crop_y = status_bar_offset  # Skip status bar

        # Calculate screenshot size to fit within available space
        screenshot_aspect = new_width / new_height
        if max_screenshot_width / max_screenshot_height > screenshot_aspect:
            screenshot_height = max_screenshot_height
            screenshot_width = int(screenshot_height * screenshot_aspect)
        else:
            screenshot_width = max_screenshot_width
            screenshot_height = int(screenshot_width / screenshot_aspect)

        # Calculate curve color
        curve_color = lighten_color(gradient_start, DecorativeCurvesConfig.LIGHTNESS_INCREASE)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_cropped = Path(temp_dir) / "cropped.png"
            temp_resized = Path(temp_dir) / "resized.png"
            temp_rounded = Path(temp_dir) / "rounded.png"
            temp_shadow = Path(temp_dir) / "shadow.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_curves = Path(temp_dir) / "curves.png"
            temp_bg_with_curves = Path(temp_dir) / "bg_with_curves.png"
            temp_with_shadow = Path(temp_dir) / "with_shadow.png"

            # Step 1: Crop to iPad aspect ratio
            crop_args = [
                str(input_path),
                "-crop", f"{new_width}x{new_height}+{crop_x}+{crop_y}",
                "+repage",
                str(temp_cropped)
            ]
            self._run_magick(crop_args)

            # Step 2: Resize to calculated dimensions
            resize_args = [
                str(temp_cropped),
                "-resize", f"{screenshot_width}x{screenshot_height}",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 3: Apply rounded corners
            rounded_args = [
                str(temp_resized),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 4: Create shadow
            shadow_args = [
                str(temp_rounded),
                "-background", "none",
                "-shadow", f"{AppleStoreConfig.IPAD_SHADOW_BLUR}x{AppleStoreConfig.IPAD_SHADOW_BLUR}+0+{AppleStoreConfig.IPAD_SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 5: Create gradient background
            gradient_args = [
                "-size", f"{final_width}x{final_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 6: Generate decorative curves
            self.curve_generator.create_curve_overlay(
                width=final_width,
                height=final_height,
                curve_color=curve_color,
                seed=seed,
                output_path=temp_curves
            )

            # Step 7: Composite curves on gradient
            curves_composite_args = [
                str(temp_gradient),
                str(temp_curves),
                "-gravity", "center",
                "-composite",
                str(temp_bg_with_curves)
            ]
            self._run_magick(curves_composite_args)

            # Step 7.5: Add top image if provided
            final_bg = temp_bg_with_curves
            if top_image_path and top_image_path.exists():
                temp_bg_with_top_image = Path(temp_dir) / "bg_with_top_image.png"
                self._add_top_image(
                    background_path=temp_bg_with_curves,
                    top_image_path=top_image_path,
                    output_path=temp_bg_with_top_image,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='ipad'
                )
                final_bg = temp_bg_with_top_image

            # Step 7.6: Add bottom logo if provided
            if bottom_logo_path and bottom_logo_path.exists():
                temp_bg_with_logo = Path(temp_dir) / "bg_with_logo.png"
                self._add_bottom_logo(
                    background_path=final_bg,
                    logo_path=bottom_logo_path,
                    output_path=temp_bg_with_logo,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='ipad'
                )
                final_bg = temp_bg_with_logo

            # Step 8: Composite shadow and rounded screenshot together
            shadow_composite_args = [
                "-size", f"{screenshot_width + 100}x{screenshot_height + 100}",
                "xc:none",
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_rounded), "-gravity", "center", "-composite",
                str(temp_with_shadow)
            ]
            self._run_magick(shadow_composite_args)

            # Step 9: Composite with asymmetric positioning
            temp_composited = Path(temp_dir) / "composited.png"
            self.composite_with_asymmetric_position(
                background_path=final_bg,
                foreground_path=temp_with_shadow,
                output_path=temp_composited,
                canvas_height=final_height
            )

            # Step 10: Add bottom-right logo if provided
            if bottom_logo_path and bottom_logo_path.exists():
                self._add_bottom_logo(
                    background_path=temp_composited,
                    logo_path=bottom_logo_path,
                    output_path=output_path,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='ipad'
                )
            else:
                # Copy temp_composited to output_path
                import shutil
                shutil.copy(temp_composited, output_path)

        self.logger.info(f"Created iPad screenshot with curves: {output_path}")

    def create_google_play_phone_screenshot_with_curves(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        seed: str,
        top_image_path: Optional[Path] = None,
        bottom_logo_path: Optional[Path] = None
    ) -> None:
        """
        Create Google Play phone screenshot with gradient and decorative curves.

        Args:
            input_path: Source iPhone screenshot (raw)
            output_path: Output phone screenshot
            gradient_start: Gradient start color
            gradient_end: Gradient end color
            seed: Seed for curve generation
            top_image_path: Optional path to image for top space
            bottom_logo_path: Optional path to logo for bottom-right corner
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get source dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Final canvas dimensions
        final_width = GooglePlayConfig.PHONE_WIDTH
        final_height = GooglePlayConfig.PHONE_HEIGHT
        corner_radius = GooglePlayConfig.CORNER_RADIUS

        # Calculate available space
        max_screenshot_height = LayoutConfig.get_mockup_max_height(final_height)
        max_screenshot_width = LayoutConfig.get_mockup_max_width(final_width)

        # Target aspect ratio for phone (9:16)
        target_aspect = GooglePlayConfig.PHONE_ASPECT_RATIO

        # Crop source to target aspect ratio
        # Skip status bar area to avoid dark bar at top
        status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS

        new_height = int(src_width / target_aspect)
        if new_height > src_height - status_bar_offset:
            new_height = src_height - status_bar_offset
            new_width = int(new_height * target_aspect)
            crop_x = (src_width - new_width) // 2
            crop_y = status_bar_offset
        else:
            new_width = src_width
            crop_x = 0
            crop_y = status_bar_offset  # Skip status bar

        # Calculate screenshot size
        screenshot_aspect = new_width / new_height
        if max_screenshot_width / max_screenshot_height > screenshot_aspect:
            screenshot_height = max_screenshot_height
            screenshot_width = int(screenshot_height * screenshot_aspect)
        else:
            screenshot_width = max_screenshot_width
            screenshot_height = int(screenshot_width / screenshot_aspect)

        # Calculate curve color
        curve_color = lighten_color(gradient_start, DecorativeCurvesConfig.LIGHTNESS_INCREASE)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_cropped = Path(temp_dir) / "cropped.png"
            temp_resized = Path(temp_dir) / "resized.png"
            temp_rounded = Path(temp_dir) / "rounded.png"
            temp_shadow = Path(temp_dir) / "shadow.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_curves = Path(temp_dir) / "curves.png"
            temp_bg_with_curves = Path(temp_dir) / "bg_with_curves.png"
            temp_with_shadow = Path(temp_dir) / "with_shadow.png"

            # Step 1: Crop to phone aspect ratio
            crop_args = [
                str(input_path),
                "-crop", f"{new_width}x{new_height}+{crop_x}+{crop_y}",
                "+repage",
                str(temp_cropped)
            ]
            self._run_magick(crop_args)

            # Step 2: Resize
            resize_args = [
                str(temp_cropped),
                "-resize", f"{screenshot_width}x{screenshot_height}",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 3: Apply rounded corners
            rounded_args = [
                str(temp_resized),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 4: Create shadow
            shadow_args = [
                str(temp_rounded),
                "-background", "none",
                "-shadow", f"{GooglePlayConfig.SHADOW_BLUR}x{GooglePlayConfig.SHADOW_BLUR}+0+{GooglePlayConfig.SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 5: Create gradient
            gradient_args = [
                "-size", f"{final_width}x{final_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 6: Generate curves
            self.curve_generator.create_curve_overlay(
                width=final_width,
                height=final_height,
                curve_color=curve_color,
                seed=seed,
                output_path=temp_curves
            )

            # Step 7: Composite curves on gradient
            curves_composite_args = [
                str(temp_gradient),
                str(temp_curves),
                "-gravity", "center",
                "-composite",
                str(temp_bg_with_curves)
            ]
            self._run_magick(curves_composite_args)

            # Step 7.5: Add top image if provided
            final_bg = temp_bg_with_curves
            if top_image_path and top_image_path.exists():
                temp_bg_with_top_image = Path(temp_dir) / "bg_with_top_image.png"
                self._add_top_image(
                    background_path=temp_bg_with_curves,
                    top_image_path=top_image_path,
                    output_path=temp_bg_with_top_image,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='gplay_phone'
                )
                final_bg = temp_bg_with_top_image

            # Step 7.6: Add bottom logo if provided
            if bottom_logo_path and bottom_logo_path.exists():
                temp_bg_with_logo = Path(temp_dir) / "bg_with_logo.png"
                self._add_bottom_logo(
                    background_path=final_bg,
                    logo_path=bottom_logo_path,
                    output_path=temp_bg_with_logo,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='gplay_phone'
                )
                final_bg = temp_bg_with_logo

            # Step 8: Composite shadow and screenshot
            shadow_composite_args = [
                "-size", f"{screenshot_width + 100}x{screenshot_height + 100}",
                "xc:none",
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_rounded), "-gravity", "center", "-composite",
                str(temp_with_shadow)
            ]
            self._run_magick(shadow_composite_args)

            # Step 9: Composite with asymmetric positioning
            temp_composited = Path(temp_dir) / "composited.png"
            self.composite_with_asymmetric_position(
                background_path=final_bg,
                foreground_path=temp_with_shadow,
                output_path=temp_composited,
                canvas_height=final_height
            )

            # Step 10: Add bottom-right logo if provided
            if bottom_logo_path and bottom_logo_path.exists():
                self._add_bottom_logo(
                    background_path=temp_composited,
                    logo_path=bottom_logo_path,
                    output_path=output_path,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='gplay_phone'
                )
            else:
                import shutil
                shutil.copy(temp_composited, output_path)

        self.logger.info(f"Created Google Play phone screenshot with curves: {output_path}")

    def create_google_play_tablet_screenshot_with_curves(
        self,
        input_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        seed: str,
        top_image_path: Optional[Path] = None,
        bottom_logo_path: Optional[Path] = None
    ) -> None:
        """
        Create Google Play tablet screenshot with gradient and decorative curves.

        Args:
            input_path: Source iPhone screenshot (raw)
            output_path: Output tablet screenshot
            gradient_start: Gradient start color
            gradient_end: Gradient end color
            seed: Seed for curve generation
            top_image_path: Optional path to image for top space
            bottom_logo_path: Optional path to logo for bottom-right corner
        """
        import tempfile

        if not input_path.exists():
            raise ImageMagickError(f"Input file not found: {input_path}")

        # Get source dimensions
        src_width, src_height = self.get_image_size(input_path)

        # Final canvas dimensions
        final_width = GooglePlayConfig.TABLET_WIDTH
        final_height = GooglePlayConfig.TABLET_HEIGHT
        corner_radius = GooglePlayConfig.CORNER_RADIUS

        # Calculate available space
        max_screenshot_height = LayoutConfig.get_mockup_max_height(final_height)
        max_screenshot_width = LayoutConfig.get_mockup_max_width(final_width)

        # Target aspect ratio for tablet (0.625)
        target_aspect = GooglePlayConfig.TABLET_ASPECT_RATIO

        # Crop source to target aspect ratio
        # Skip status bar area to avoid dark bar at top
        status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS

        new_height = int(src_width / target_aspect)
        if new_height > src_height - status_bar_offset:
            new_height = src_height - status_bar_offset
            new_width = int(new_height * target_aspect)
            crop_x = (src_width - new_width) // 2
            crop_y = status_bar_offset
        else:
            new_width = src_width
            crop_x = 0
            crop_y = status_bar_offset  # Skip status bar

        # Calculate screenshot size
        screenshot_aspect = new_width / new_height
        if max_screenshot_width / max_screenshot_height > screenshot_aspect:
            screenshot_height = max_screenshot_height
            screenshot_width = int(screenshot_height * screenshot_aspect)
        else:
            screenshot_width = max_screenshot_width
            screenshot_height = int(screenshot_width / screenshot_aspect)

        # Calculate curve color
        curve_color = lighten_color(gradient_start, DecorativeCurvesConfig.LIGHTNESS_INCREASE)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_cropped = Path(temp_dir) / "cropped.png"
            temp_resized = Path(temp_dir) / "resized.png"
            temp_rounded = Path(temp_dir) / "rounded.png"
            temp_shadow = Path(temp_dir) / "shadow.png"
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_curves = Path(temp_dir) / "curves.png"
            temp_bg_with_curves = Path(temp_dir) / "bg_with_curves.png"
            temp_with_shadow = Path(temp_dir) / "with_shadow.png"

            # Step 1: Crop to tablet aspect ratio
            crop_args = [
                str(input_path),
                "-crop", f"{new_width}x{new_height}+{crop_x}+{crop_y}",
                "+repage",
                str(temp_cropped)
            ]
            self._run_magick(crop_args)

            # Step 2: Resize
            resize_args = [
                str(temp_cropped),
                "-resize", f"{screenshot_width}x{screenshot_height}",
                str(temp_resized)
            ]
            self._run_magick(resize_args)

            # Step 3: Apply rounded corners
            rounded_args = [
                str(temp_resized),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 4: Create shadow
            shadow_args = [
                str(temp_rounded),
                "-background", "none",
                "-shadow", f"{GooglePlayConfig.SHADOW_BLUR}x{GooglePlayConfig.SHADOW_BLUR}+0+{GooglePlayConfig.SHADOW_OFFSET_Y}",
                str(temp_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 5: Create gradient
            gradient_args = [
                "-size", f"{final_width}x{final_height}",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 6: Generate curves
            self.curve_generator.create_curve_overlay(
                width=final_width,
                height=final_height,
                curve_color=curve_color,
                seed=seed,
                output_path=temp_curves
            )

            # Step 7: Composite curves on gradient
            curves_composite_args = [
                str(temp_gradient),
                str(temp_curves),
                "-gravity", "center",
                "-composite",
                str(temp_bg_with_curves)
            ]
            self._run_magick(curves_composite_args)

            # Step 7.5: Add top image if provided
            final_bg = temp_bg_with_curves
            if top_image_path and top_image_path.exists():
                temp_bg_with_top_image = Path(temp_dir) / "bg_with_top_image.png"
                self._add_top_image(
                    background_path=temp_bg_with_curves,
                    top_image_path=top_image_path,
                    output_path=temp_bg_with_top_image,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='gplay_tablet'
                )
                final_bg = temp_bg_with_top_image

            # Step 7.6: Add bottom logo if provided
            if bottom_logo_path and bottom_logo_path.exists():
                temp_bg_with_logo = Path(temp_dir) / "bg_with_logo.png"
                self._add_bottom_logo(
                    background_path=final_bg,
                    logo_path=bottom_logo_path,
                    output_path=temp_bg_with_logo,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='gplay_tablet'
                )
                final_bg = temp_bg_with_logo

            # Step 8: Composite shadow and screenshot
            shadow_composite_args = [
                "-size", f"{screenshot_width + 100}x{screenshot_height + 100}",
                "xc:none",
                str(temp_shadow), "-gravity", "center", "-composite",
                str(temp_rounded), "-gravity", "center", "-composite",
                str(temp_with_shadow)
            ]
            self._run_magick(shadow_composite_args)

            # Step 9: Composite with asymmetric positioning
            temp_composited = Path(temp_dir) / "composited.png"
            self.composite_with_asymmetric_position(
                background_path=final_bg,
                foreground_path=temp_with_shadow,
                output_path=temp_composited,
                canvas_height=final_height
            )

            # Step 10: Add bottom-right logo if provided
            if bottom_logo_path and bottom_logo_path.exists():
                self._add_bottom_logo(
                    background_path=temp_composited,
                    logo_path=bottom_logo_path,
                    output_path=output_path,
                    canvas_width=final_width,
                    canvas_height=final_height,
                    device_type='gplay_tablet'
                )
            else:
                import shutil
                shutil.copy(temp_composited, output_path)

        self.logger.info(f"Created Google Play tablet screenshot with curves: {output_path}")

    def create_feature_graphic(
        self,
        screenshot_path: Path,
        output_path: Path,
        gradient_start: str,
        gradient_end: str,
        logo_path: Optional[Path] = None,
        text_lines: Optional[list] = None,
        text_color: str = "#FFFFFF",
        seed: Optional[str] = None
    ) -> None:
        """
        Create Google Play Feature Graphic (1024x500px) with phone mockup.

        Layout:
        ┌──────────────────────────────────────────────────────────────┐
        │ ┌─────────────────────┐                    ╭─────────╮       │
        │ │      [LOGO]         │                   ╱│         │╲      │
        │ │                     │                  ╱ │  HOME   │ ╲     │
        │ │  "Acumule pontos    │                 │  │ SCREEN  │  │    │
        │ │   e troque por      │                 │  │ (crop)  │  │    │
        │ │   recompensas!"     │                  ╲ │         │ ╱     │
        │ └─────────────────────┘                   ╲│         │╱      │
        └──────────────────────────────────────────────────────────────┘

        Args:
            screenshot_path: Path to source screenshot (home screen)
            output_path: Output path for feature graphic
            gradient_start: Gradient start color (hex)
            gradient_end: Gradient end color (hex)
            logo_path: Optional path to logo image (PNG with transparency)
            text_lines: Optional list of text lines for promotional message
            text_color: Text color (hex), default white
            seed: Optional seed for curve randomization (uses timestamp if None)
        """
        import tempfile
        import time

        if not screenshot_path.exists():
            raise ImageMagickError(f"Screenshot not found: {screenshot_path}")

        # Configuration
        cfg = FeatureGraphicConfig
        canvas_width = cfg.WIDTH
        canvas_height = cfg.HEIGHT

        # Use default text if not provided
        if text_lines is None:
            text_lines = cfg.DEFAULT_TEXT_LINES

        # Calculate curve color (lighter shade of gradient start)
        curve_color = lighten_color(gradient_start, DecorativeCurvesConfig.LIGHTNESS_INCREASE)

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_gradient = Path(temp_dir) / "gradient.png"
            temp_curves = Path(temp_dir) / "curves.png"
            temp_bg_with_curves = Path(temp_dir) / "bg_with_curves.png"
            temp_phone_cropped = Path(temp_dir) / "phone_cropped.png"
            temp_phone_rounded = Path(temp_dir) / "phone_rounded.png"
            temp_phone_rotated = Path(temp_dir) / "phone_rotated.png"
            temp_phone_shadow = Path(temp_dir) / "phone_shadow.png"
            temp_phone_with_shadow = Path(temp_dir) / "phone_with_shadow.png"
            temp_with_phone = Path(temp_dir) / "with_phone.png"
            temp_with_logo = Path(temp_dir) / "with_logo.png"
            temp_with_text = Path(temp_dir) / "with_text.png"

            # Step 1: Create horizontal gradient background
            gradient_args = [
                "-size", f"{canvas_width}x{canvas_height}",
                "-define", "gradient:direction=east",
                f"gradient:{gradient_start}-{gradient_end}",
                str(temp_gradient)
            ]
            self._run_magick(gradient_args)

            # Step 2: Generate decorative curves (horizontal layout)
            # Use provided seed or generate random one based on timestamp
            curve_seed = seed if seed else f"feature_graphic_{int(time.time() * 1000)}"
            self.curve_generator.create_horizontal_curve_overlay(
                width=canvas_width,
                height=canvas_height,
                curve_color=curve_color,
                seed=curve_seed,
                output_path=temp_curves
            )

            # Step 3: Composite curves on gradient
            curves_composite_args = [
                str(temp_gradient),
                str(temp_curves),
                "-gravity", "center",
                "-composite",
                str(temp_bg_with_curves)
            ]
            self._run_magick(curves_composite_args)

            # Step 4: Prepare phone mockup
            # Get source dimensions
            src_width, src_height = self.get_image_size(screenshot_path)

            # Calculate phone dimensions (95% of canvas height)
            phone_height = int(canvas_height * cfg.PHONE_HEIGHT_RATIO)
            # Maintain iPhone aspect ratio (approximately 0.46)
            phone_aspect = 0.46
            phone_width = int(phone_height * phone_aspect)

            # Crop center portion of screenshot (skip status bar)
            status_bar_offset = DeviceConfig.STATUS_BAR_OFFSET_PIXELS
            crop_height = src_height - status_bar_offset
            crop_width = src_width

            # Crop screenshot
            crop_args = [
                str(screenshot_path),
                "-crop", f"{crop_width}x{crop_height}+0+{status_bar_offset}",
                "+repage",
                "-resize", f"{phone_width}x{phone_height}",
                str(temp_phone_cropped)
            ]
            self._run_magick(crop_args)

            # Step 5: Apply rounded corners to phone
            corner_radius = cfg.PHONE_CORNER_RADIUS
            rounded_args = [
                str(temp_phone_cropped),
                "(",
                "+clone",
                "-alpha", "extract",
                "-draw", f"fill black polygon 0,0 0,{corner_radius} {corner_radius},0 "
                         f"fill white circle {corner_radius},{corner_radius} {corner_radius},0",
                "(",
                "+clone", "-flip",
                ")", "-compose", "Multiply", "-composite",
                "(",
                "+clone", "-flop",
                ")", "-compose", "Multiply", "-composite",
                ")",
                "-alpha", "off",
                "-compose", "CopyOpacity",
                "-composite",
                str(temp_phone_rounded)
            ]
            self._run_magick(rounded_args)

            # Step 6: Apply rotation to phone
            rotation = cfg.PHONE_ROTATION
            rotate_args = [
                str(temp_phone_rounded),
                "-background", "none",
                "-rotate", str(-rotation),  # Negative for tilt to the right
                str(temp_phone_rotated)
            ]
            self._run_magick(rotate_args)

            # Step 7: Create shadow for phone
            shadow_args = [
                str(temp_phone_rotated),
                "-background", "none",
                "-shadow", f"{cfg.SHADOW_BLUR}x{cfg.SHADOW_SPREAD}+{cfg.SHADOW_OFFSET_X}+{cfg.SHADOW_OFFSET_Y}",
                str(temp_phone_shadow)
            ]
            self._run_magick(shadow_args)

            # Step 8: Composite phone with shadow
            # Get rotated phone dimensions
            rotated_width, rotated_height = self.get_image_size(temp_phone_rotated)
            shadow_canvas_width = rotated_width + 100
            shadow_canvas_height = rotated_height + 100

            phone_composite_args = [
                "-size", f"{shadow_canvas_width}x{shadow_canvas_height}",
                "xc:none",
                str(temp_phone_shadow), "-gravity", "center", "-composite",
                str(temp_phone_rotated), "-gravity", "center", "-composite",
                str(temp_phone_with_shadow)
            ]
            self._run_magick(phone_composite_args)

            # Step 9: Composite phone on background (right side)
            right_margin = int(canvas_width * cfg.PHONE_RIGHT_MARGIN_RATIO)
            # Calculate vertical center offset
            phone_final_width, phone_final_height = self.get_image_size(temp_phone_with_shadow)
            vertical_offset = (canvas_height - phone_final_height) // 2

            phone_on_bg_args = [
                str(temp_bg_with_curves),
                str(temp_phone_with_shadow),
                "-gravity", "east",
                "-geometry", f"+{right_margin}+0",
                "-composite",
                str(temp_with_phone)
            ]
            self._run_magick(phone_on_bg_args)

            # Step 10: Add logo (if provided)
            current_bg = temp_with_phone
            if logo_path and logo_path.exists():
                # Calculate logo dimensions
                logo_max_height = int(canvas_height * cfg.LOGO_MAX_HEIGHT_RATIO)
                logo_top_margin = int(canvas_height * cfg.LOGO_TOP_MARGIN_RATIO)
                left_margin = int(canvas_width * cfg.TEXT_LEFT_MARGIN_RATIO)

                # Get logo dimensions and scale
                logo_orig_width, logo_orig_height = self.get_image_size(logo_path)
                scale = min(1.0, logo_max_height / logo_orig_height)
                logo_new_width = int(logo_orig_width * scale)
                logo_new_height = int(logo_orig_height * scale)

                logo_args = [
                    str(current_bg),
                    "(",
                    str(logo_path),
                    "-resize", f"{logo_new_width}x{logo_new_height}",
                    ")",
                    "-gravity", "northwest",
                    "-geometry", f"+{left_margin}+{logo_top_margin}",
                    "-composite",
                    str(temp_with_logo)
                ]
                self._run_magick(logo_args)
                current_bg = temp_with_logo

            # Step 11: Add promotional text
            if text_lines:
                text_size = int(canvas_height * cfg.TEXT_SIZE_RATIO)
                text_top_margin = int(canvas_height * cfg.TEXT_TOP_MARGIN_RATIO)
                left_margin = int(canvas_width * cfg.TEXT_LEFT_MARGIN_RATIO)
                line_height = int(text_size * cfg.TEXT_LINE_HEIGHT_RATIO)

                # Build text annotation commands
                text_args = [str(current_bg)]

                for i, line in enumerate(text_lines):
                    y_pos = text_top_margin + (i * line_height)
                    text_args.extend([
                        "-font", cfg.TEXT_FONT,
                        "-pointsize", str(text_size),
                        "-fill", text_color,
                        "-gravity", "northwest",
                        "-annotate", f"+{left_margin}+{y_pos}", line
                    ])

                text_args.append(str(temp_with_text))
                self._run_magick(text_args)
                current_bg = temp_with_text

            # Step 12: Copy final result to output
            import shutil
            shutil.copy(current_bg, output_path)

        self.logger.info(f"Created Feature Graphic: {output_path}")
