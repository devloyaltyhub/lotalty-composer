#!/usr/bin/env python3
"""
Screenshot Configuration Constants

This module centralizes all magic numbers and configuration
constants used in the Python mockup generation scripts.

Usage:
    from automation.screenshots.config.screenshot_config import ScreenshotConfig

    radius = ScreenshotConfig.MIN_CORNER_RADIUS
"""


class ScreenshotConfig:
    """Configuration constants for screenshot processing"""

    # ==================================
    # IMAGE PROCESSING
    # ==================================

    # Minimum corner radius to apply (pixels)
    MIN_CORNER_RADIUS = 2

    # Gaussian blur kernel size for smooth corners
    BLUR_KERNEL_SIZE = (5, 5)
    BLUR_SIGMA = 0

    # ==================================
    # CORNER RADIUS DETECTION
    # ==================================

    # Maximum pixels to search for corner radius
    CORNER_SEARCH_MAX_PIXELS = 200

    # Divisor for calculating max search based on screen width
    CORNER_SEARCH_WIDTH_DIVISOR = 4

    # Default corner radius as percentage of min(width, height)
    # iPhone 15 Pro Max: ~3.6% of screen dimension
    DEFAULT_CORNER_RADIUS_PERCENT = 0.036

    # ==================================
    # SAFETY MARGINS
    # ==================================

    # Safety margin to prevent edge bleeding (pixels)
    # Prevents interpolation artifacts from 3D transformation
    SAFETY_MARGIN_PIXELS = 20

    # ==================================
    # INTERPOLATION
    # ==================================

    # OpenCV interpolation method for high-quality resizing
    INTERPOLATION_METHOD = 'LANCZOS4'

    # Border mode for perspective transformation
    BORDER_MODE = 'CONSTANT'

    # Border value for transparent areas (BGRA)
    BORDER_VALUE = (0, 0, 0, 0)

    # ==================================
    # MASKING
    # ==================================

    # Alpha threshold for opacity detection
    ALPHA_THRESHOLD_TRANSPARENT = 0
    ALPHA_THRESHOLD_OPAQUE = 0

    # Mask values
    MASK_VALUE_ALLOW = 255
    MASK_VALUE_BLOCK = 0


class MockupConfig:
    """Configuration constants for mockup generation"""

    # ==================================
    # CANVAS DIMENSIONS
    # ==================================
    # Canvas must maintain iPhone 6.9" aspect ratio (1320x2868 = 0.460)
    # to avoid distortion when resizing to final dimensions.
    # Using 2000 width: height = 2000 / 0.460 = ~4348

    CANVAS_WIDTH = 2000
    CANVAS_HEIGHT = 4348

    # ==================================
    # SHADOW SETTINGS
    # ==================================

    # Shadow blur radius
    SHADOW_BLUR = 70

    # Shadow spread
    SHADOW_SPREAD = 35

    # Shadow X offset (added to rotation angle)
    SHADOW_OFFSET_X_ADDITION = 10

    # Shadow Y offset
    SHADOW_OFFSET_Y = 40

    # ==================================
    # PERSPECTIVE TRANSFORM
    # ==================================

    # Multipliers for perspective distortion
    PERSPECTIVE_TOP_MULTIPLIER = 3
    PERSPECTIVE_BOTTOM_MULTIPLIER = 4

    # ==================================
    # ROTATION ANGLES (degrees)
    # ==================================

    ROTATION_SUBTLE = 15
    ROTATION_MODERATE = 20
    ROTATION_PRONOUNCED = 25

    # ==================================
    # IMAGE QUALITY
    # ==================================

    # PNG compression level (0-9, where 9 is highest compression)
    PNG_COMPRESSION_LEVEL = 9

    # JPEG quality (0-100, where 100 is highest quality)
    JPEG_QUALITY = 95


class DeviceConfig:
    """Device-specific configuration"""

    # ==================================
    # IPHONE 15 PRO MAX
    # ==================================

    # Native resolution (@3x)
    IPHONE_15_PRO_MAX_WIDTH = 1290
    IPHONE_15_PRO_MAX_HEIGHT = 2796

    # Corner radius in points
    IPHONE_15_PRO_MAX_CORNER_RADIUS_POINTS = 55

    # Scale factor
    IPHONE_15_PRO_MAX_SCALE = 3

    # Corner radius in pixels (@3x)
    IPHONE_15_PRO_MAX_CORNER_RADIUS_PIXELS = (
        IPHONE_15_PRO_MAX_CORNER_RADIUS_POINTS * IPHONE_15_PRO_MAX_SCALE
    )  # = 165px

    # ==================================
    # STATUS BAR OFFSET
    # ==================================

    # Height of status bar area to skip when cropping screenshots
    # This prevents the dark status bar from appearing in cropped screenshots
    # iPhone 15 Pro Max: ~59pt status bar * 3 = ~177px, rounded to 180px
    STATUS_BAR_OFFSET_PIXELS = 180

    # ==================================
    # MOCKUP FRAME SPECS
    # ==================================

    # Mockup frame size (larger than native for better quality)
    MOCKUP_FRAME_WIDTH = 1621
    MOCKUP_FRAME_HEIGHT = 3135

    # Screen area within frame
    MOCKUP_SCREEN_X1 = 108
    MOCKUP_SCREEN_Y1 = 120
    MOCKUP_SCREEN_X2 = 1512
    MOCKUP_SCREEN_Y2 = 3015

    # Calculated screen dimensions
    MOCKUP_SCREEN_WIDTH = MOCKUP_SCREEN_X2 - MOCKUP_SCREEN_X1  # 1404
    MOCKUP_SCREEN_HEIGHT = MOCKUP_SCREEN_Y2 - MOCKUP_SCREEN_Y1  # 2895

    # Scale factor: mockup / native
    MOCKUP_SCALE_FACTOR = MOCKUP_SCREEN_WIDTH / IPHONE_15_PRO_MAX_WIDTH  # ~1.0884

    # Adjusted corner radius for mockup size
    MOCKUP_CORNER_RADIUS = int(
        IPHONE_15_PRO_MAX_CORNER_RADIUS_PIXELS * MOCKUP_SCALE_FACTOR
    )  # ~180px


class AppleStoreConfig:
    """Apple App Store screenshot requirements (2024-2025)

    Important: Resolutions MUST match Fastlane deliver device folder names.
    Fastlane auto-detects device type by resolution, so using non-standard
    sizes will cause "No Screenshots Found" errors.

    Fastlane folder name -> Expected resolution:
    - APP_IPHONE_67 (6.7"): 1290x2796 (iPhone 14/15/16 Pro Max)
    - APP_IPHONE_65 (6.5"): 1242x2688 (iPhone XS Max, 11 Pro Max)
    - APP_IPHONE_55 (5.5"): 1242x2208 (iPhone 8 Plus)
    - APP_IPAD_PRO_129 (12.9"): 2048x2732 (iPad Pro 12.9")
    """

    # ==================================
    # IPHONE 6.7" (Mandatory - largest iPhone)
    # Fastlane folder: APP_IPHONE_67
    # ==================================

    IPHONE_67_WIDTH = 1290
    IPHONE_67_HEIGHT = 2796
    IPHONE_67_ASPECT_RATIO = IPHONE_67_WIDTH / IPHONE_67_HEIGHT  # ~0.46

    # Legacy aliases for backward compatibility
    IPHONE_69_WIDTH = IPHONE_67_WIDTH
    IPHONE_69_HEIGHT = IPHONE_67_HEIGHT
    IPHONE_69_ASPECT_RATIO = IPHONE_67_ASPECT_RATIO

    # ==================================
    # IPHONE 6.5" (Optional - older large iPhones)
    # Fastlane folder: APP_IPHONE_65
    # ==================================

    IPHONE_65_WIDTH = 1242
    IPHONE_65_HEIGHT = 2688
    IPHONE_65_ASPECT_RATIO = IPHONE_65_WIDTH / IPHONE_65_HEIGHT  # ~0.46

    # ==================================
    # IPHONE 5.5" (Optional - legacy devices)
    # Fastlane folder: APP_IPHONE_55
    # ==================================

    IPHONE_55_WIDTH = 1242
    IPHONE_55_HEIGHT = 2208
    IPHONE_55_ASPECT_RATIO = IPHONE_55_WIDTH / IPHONE_55_HEIGHT  # ~0.56

    # ==================================
    # IPAD PRO 12.9" (Mandatory for iPad support)
    # Fastlane folder: APP_IPAD_PRO_129
    # ==================================

    IPAD_PRO_129_WIDTH = 2048
    IPAD_PRO_129_HEIGHT = 2732
    IPAD_PRO_129_ASPECT_RATIO = IPAD_PRO_129_WIDTH / IPAD_PRO_129_HEIGHT  # ~0.75

    # Legacy aliases for backward compatibility
    IPAD_13_WIDTH = IPAD_PRO_129_WIDTH
    IPAD_13_HEIGHT = IPAD_PRO_129_HEIGHT
    IPAD_13_ASPECT_RATIO = IPAD_PRO_129_ASPECT_RATIO

    # ==================================
    # IPAD SCREENSHOT STYLING
    # ==================================

    # Corner radius for iPad screenshots (no device frame)
    IPAD_CORNER_RADIUS = 40

    # Padding around screenshot in gradient background (pixels)
    IPAD_PADDING = 80

    # Shadow settings for iPad
    IPAD_SHADOW_BLUR = 50
    IPAD_SHADOW_OPACITY = 0.3
    IPAD_SHADOW_OFFSET_Y = 20


class GooglePlayConfig:
    """Google Play Store screenshot requirements (2025)"""

    # ==================================
    # PHONE (9:16 portrait)
    # ==================================

    PHONE_WIDTH = 1080
    PHONE_HEIGHT = 1920
    PHONE_ASPECT_RATIO = PHONE_WIDTH / PHONE_HEIGHT  # ~0.5625 (9:16)

    # ==================================
    # TABLET 10" (portrait)
    # ==================================

    TABLET_WIDTH = 1600
    TABLET_HEIGHT = 2560
    TABLET_ASPECT_RATIO = TABLET_WIDTH / TABLET_HEIGHT  # ~0.625

    # ==================================
    # STYLING (same as iPad)
    # ==================================

    # Corner radius for screenshots (no device frame)
    CORNER_RADIUS = 40

    # Padding around screenshot in gradient background (pixels)
    PADDING = 80

    # Shadow settings
    SHADOW_BLUR = 50
    SHADOW_OPACITY = 0.3
    SHADOW_OFFSET_Y = 20


class FeatureGraphicConfig:
    """Google Play Feature Graphic configuration (1024x500px)

    The Feature Graphic is a promotional banner displayed at the top
    of the app's Play Store page. It should be visually appealing and
    communicate the app's value proposition.

    Layout (horizontal):
    ┌──────────────────────────────────────────────────────────────┐
    │ ┌─────────────────────┐                    ╭─────────╮       │
    │ │      [LOGO]         │                   ╱│         │╲      │
    │ │                     │                  ╱ │  HOME   │ ╲     │
    │ │  "Acumule pontos    │                 │  │ SCREEN  │  │    │
    │ │   e troque por      │                 │  │ (crop)  │  │    │
    │ │   recompensas!"     │                  ╲ │         │ ╱     │
    │ └─────────────────────┘                   ╲│         │╱      │
    └──────────────────────────────────────────────────────────────┘
    """

    # ==================================
    # DIMENSIONS (Google Play requirement)
    # ==================================

    WIDTH = 1024
    HEIGHT = 500

    # ==================================
    # PHONE MOCKUP SETTINGS
    # ==================================

    # Phone mockup height as percentage of canvas height
    PHONE_HEIGHT_RATIO = 0.95  # 95% of canvas height

    # Rotation angle for phone (subtle tilt)
    PHONE_ROTATION = MockupConfig.ROTATION_SUBTLE  # 15 degrees

    # Phone horizontal position (from right edge, as percentage)
    PHONE_RIGHT_MARGIN_RATIO = 0.08  # 8% from right edge

    # Corner radius for phone screenshot
    PHONE_CORNER_RADIUS = 25

    # ==================================
    # TEXT/LOGO AREA (left side)
    # ==================================

    # Text area width as percentage of canvas
    TEXT_AREA_WIDTH_RATIO = 0.50  # 50% for text/logo

    # Left margin for text area
    TEXT_LEFT_MARGIN_RATIO = 0.06  # 6% from left edge

    # Logo max height as percentage of canvas height
    LOGO_MAX_HEIGHT_RATIO = 0.25  # 25% of canvas height

    # Text settings
    TEXT_FONT = "Helvetica-Bold"
    TEXT_SIZE_RATIO = 0.09  # 9% of canvas height (~45px)
    TEXT_LINE_HEIGHT_RATIO = 1.3  # Line spacing multiplier

    # Vertical spacing
    LOGO_TOP_MARGIN_RATIO = 0.15  # 15% from top
    TEXT_TOP_MARGIN_RATIO = 0.45  # 45% from top (below logo)

    # ==================================
    # SHADOW SETTINGS
    # ==================================

    SHADOW_BLUR = 40
    SHADOW_SPREAD = 20
    SHADOW_OFFSET_X = 15
    SHADOW_OFFSET_Y = 25
    SHADOW_OPACITY = 0.4

    # ==================================
    # PROMOTIONAL TEXT OPTIONS
    # ==================================

    DEFAULT_TEXT_LINES = [
        "Acumule pontos",
        "e troque por",
        "recompensas!"
    ]


class LayoutConfig:
    """Layout configuration for mockup positioning

    Asymmetric vertical positioning to reserve space at the top
    for future marketing content (phrases, icons, badges).

    Layout:
    ┌────────────────────────┐
    │                        │  ← TOP_SPACE_PERCENT (25%)
    │   ┌──────────────────┐ │
    │   │     MOCKUP       │ │  ← MOCKUP_SPACE_PERCENT (65%)
    │   └──────────────────┘ │
    │                        │  ← BOTTOM_SPACE_PERCENT (10%)
    └────────────────────────┘
    """

    # ==================================
    # VERTICAL POSITIONING (asymmetric)
    # ==================================

    # Space at top for marketing content (phrases, icons, images)
    TOP_SPACE_PERCENT = 0.18  # 18% (was 25%)

    # Space at bottom for aesthetic margin
    BOTTOM_SPACE_PERCENT = 0.10  # 10%

    # Space for the mockup itself (increased with smaller top)
    MOCKUP_SPACE_PERCENT = 0.72  # 72% (was 65%)

    # ==================================
    # HORIZONTAL POSITIONING
    # ==================================

    # Horizontal padding on each side
    HORIZONTAL_PADDING_PERCENT = 0.05  # 5% each side

    # ==================================
    # HELPER METHODS
    # ==================================

    @classmethod
    def get_top_offset(cls, canvas_height: int) -> int:
        """Calculate top offset in pixels for a given canvas height"""
        return int(canvas_height * cls.TOP_SPACE_PERCENT)

    @classmethod
    def get_mockup_max_height(cls, canvas_height: int) -> int:
        """Calculate maximum mockup height in pixels"""
        return int(canvas_height * cls.MOCKUP_SPACE_PERCENT)

    @classmethod
    def get_mockup_max_width(cls, canvas_width: int) -> int:
        """Calculate maximum mockup width in pixels (accounting for horizontal padding)"""
        return int(canvas_width * (1 - 2 * cls.HORIZONTAL_PADDING_PERCENT))


class DecorativeCurvesConfig:
    """Configuration for decorative background curves

    Decorative curves add visual interest to mockup backgrounds.
    They appear as soft waves in a lighter shade of the primary color,
    positioned between the gradient background and the mockup.

    Visual example:
    ┌────────────────────────────────────┐
    │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ← Background (primary/gradient)
    │ ░░░░░░░╭───────╮░░░░░░░░░░░░░░░░░░│
    │ ░░░░░╭╯░░░░░░░░╰─────╮░░░░░░░░░░░░│ ← Curva decorativa (primary +20% luz)
    │ ░░░░░│░░░░░░░░░░░░░░░│░░░░░░░░░░░░│
    │ ░░░░░│  ┌─────────┐  │░░░░░░░░░░░░│
    │ ░░░░░│  │ MOCKUP  │  │░░░░░░░░░░░░│
    │ ░░░░░│  └─────────┘  │░░░░░░░░░░░░│
    │ ░░░░░╰───────────────╯░░░░░░░░░░░░│
    └────────────────────────────────────┘
    """

    # ==================================
    # COLOR ADJUSTMENT
    # ==================================

    # Lightness increase for curve color (HSL)
    # 0.20 = +20% lightness over primary color
    LIGHTNESS_INCREASE = 0.20

    # ==================================
    # CURVE SHAPE PARAMETERS
    # ==================================

    # Amplitude of curves as percentage of canvas width
    # Larger values = curves extend further into the center
    CURVE_AMPLITUDE_MIN = 0.25  # 25% minimum wave amplitude (was 0.15)
    CURVE_AMPLITUDE_MAX = 0.45  # 45% maximum wave amplitude (was 0.35)

    # Number of control points for Bezier curves
    CONTROL_POINTS = 4

    # Smoothness factor (higher = smoother curves)
    SMOOTHNESS = 0.3

    # ==================================
    # CURVE POSITIONING
    # ==================================

    # Vertical range for curve start/end (as % of canvas height)
    # Curves now span from top to bottom for full-height effect
    CURVE_START_Y_MIN = 0.0   # Start at the very top (was 0.10)
    CURVE_START_Y_MAX = 0.15  # Small variation at start (was 0.40)
    CURVE_END_Y_MIN = 0.85    # End near the bottom (was 0.60)
    CURVE_END_Y_MAX = 1.0     # Go all the way to bottom (was 0.90)

    # ==================================
    # STYLE OPTIONS
    # ==================================

    # Number of curves to generate (1-3)
    MIN_CURVES = 1
    MAX_CURVES = 2

    # Opacity of curves (0.0 to 1.0)
    CURVE_OPACITY = 1.0


from dataclasses import dataclass


@dataclass
class DeviceTopImageConfig:
    """Configuration for top image placement on a specific device type.

    Top images are marketing graphics placed in the top space above the mockup.
    Different devices require different scaling to prevent overlap with the mockup.

    Attributes:
        max_width_percent: Maximum width as percentage of canvas (0.0-1.0)
        max_height_percent: Maximum height as percentage of top_space (0.0-1.0)
        vertical_align: Vertical alignment within top space ("top", "center", "bottom")
        top_padding_percent: Padding from top as percentage of top_space (0.0-1.0)
    """
    max_width_percent: float = 0.90
    max_height_percent: float = 0.85
    vertical_align: str = "center"
    top_padding_percent: float = 0.05


class TopImageConfig:
    """Device-specific configurations for top image placement.

    The key challenge is that wider devices (iPad, tablets) have:
    1. Less vertical space relative to width
    2. Top images scale up more (due to width-based scaling)

    Solution: Use dual constraints (max width AND max height) with
    device-specific settings to ensure images fit properly.
    """

    # iPhone 6.9" - tall device (aspect ratio 0.46), works well with larger images
    # Top image uses 100% width for full visual impact
    IPHONE = DeviceTopImageConfig(
        max_width_percent=1.0,
        max_height_percent=0.95,
        vertical_align="center"
    )

    # iPad 13" - wide device (aspect ratio 0.75), needs more constraints
    IPAD = DeviceTopImageConfig(
        max_width_percent=0.85,
        max_height_percent=0.92,
        vertical_align="center"
    )

    # Google Play Phone - similar to iPhone (aspect ratio 0.56)
    GPLAY_PHONE = DeviceTopImageConfig(
        max_width_percent=0.98,
        max_height_percent=0.92,
        vertical_align="center"
    )

    # Google Play Tablet - wide device (aspect ratio 0.625)
    GPLAY_TABLET = DeviceTopImageConfig(
        max_width_percent=0.88,
        max_height_percent=0.92,
        vertical_align="center"
    )

    @classmethod
    def get_config(cls, device_type: str) -> DeviceTopImageConfig:
        """Get configuration for a device type.

        Args:
            device_type: One of 'iphone', 'ipad', 'gplay_phone', 'gplay_tablet'

        Returns:
            DeviceTopImageConfig for the device (defaults to IPHONE if unknown)
        """
        configs = {
            'iphone': cls.IPHONE,
            'ipad': cls.IPAD,
            'gplay_phone': cls.GPLAY_PHONE,
            'gplay_tablet': cls.GPLAY_TABLET,
        }
        return configs.get(device_type, cls.IPHONE)


@dataclass
class DeviceBottomLogoConfig:
    """Configuration for bottom-right logo placement on a specific device type.

    The logo is placed in the bottom space (10% of canvas height) at the right edge.
    Different devices need different sizing to avoid overlapping with the mockup.

    Attributes:
        max_width_percent: Maximum width as percentage of canvas width (0.0-1.0)
        max_height_percent: Maximum height as percentage of bottom_space (0.0-1.0)
        right_padding_percent: Padding from right edge as percentage of canvas width (0.0-1.0)
        bottom_padding_percent: Padding from bottom as percentage of bottom_space (0.0-1.0)
    """
    max_width_percent: float = 0.25
    max_height_percent: float = 0.70
    right_padding_percent: float = 0.03
    bottom_padding_percent: float = 0.15


class BottomLogoConfig:
    """Device-specific configurations for bottom-right logo placement.

    The bottom space is 10% of canvas height. Each device has different
    canvas dimensions, so the absolute pixel space varies:
    - iPhone 6.7" (2796px): 280px bottom space
    - iPad 12.9" (2732px): 273px bottom space
    - GPlay Phone (1920px): 192px bottom space (smallest!)
    - GPlay Tablet (2560px): 256px bottom space

    GPlay Phone needs more restrictive settings to prevent overlap.
    """

    # iPhone 6.7" - 280px bottom space, plenty of room - LARGER logo
    IPHONE = DeviceBottomLogoConfig(
        max_width_percent=0.30,
        max_height_percent=0.80,
        right_padding_percent=0.03,
        bottom_padding_percent=0.10
    )

    # iPad 12.9" - 273px bottom space - smaller, lower
    IPAD = DeviceBottomLogoConfig(
        max_width_percent=0.16,
        max_height_percent=0.55,
        right_padding_percent=0.025,
        bottom_padding_percent=0.08
    )

    # Google Play Phone - 192px bottom space (SMALLEST) - smaller, lower
    GPLAY_PHONE = DeviceBottomLogoConfig(
        max_width_percent=0.16,
        max_height_percent=0.50,
        right_padding_percent=0.03,
        bottom_padding_percent=0.08
    )

    # Google Play Tablet - 256px bottom space - smaller, lower
    GPLAY_TABLET = DeviceBottomLogoConfig(
        max_width_percent=0.14,
        max_height_percent=0.50,
        right_padding_percent=0.025,
        bottom_padding_percent=0.08
    )

    @classmethod
    def get_config(cls, device_type: str) -> DeviceBottomLogoConfig:
        """Get configuration for a device type.

        Args:
            device_type: One of 'iphone', 'ipad', 'gplay_phone', 'gplay_tablet'

        Returns:
            DeviceBottomLogoConfig for the device (defaults to IPHONE if unknown)
        """
        configs = {
            'iphone': cls.IPHONE,
            'ipad': cls.IPAD,
            'gplay_phone': cls.GPLAY_PHONE,
            'gplay_tablet': cls.GPLAY_TABLET,
        }
        return configs.get(device_type, cls.IPHONE)


class PathConfig:
    """Path configuration"""

    # ==================================
    # DIRECTORY PATHS
    # ==================================

    # Relative to automation directory
    SCREENSHOTS_DIR = "../white_label_app/screenshots"
    MOCKUPS_DIR = "../white_label_app/screenshots/mockups"
    TEMPLATES_DIR = "./mockupgen_templates"

    # ==================================
    # FILE PATTERNS
    # ==================================

    SCREENSHOT_PATTERN = "0*.png"
    MOCKUP_OUTPUT_PATTERN = "{name}_iphone_3d.png"
    FLAT_MOCKUP_TEMP_PATTERN = "/tmp/mockup_flat_{name}.png"


# Convenience function for getting OpenCV interpolation constant
def get_interpolation_method():
    """Returns OpenCV interpolation method constant"""
    import cv2
    method_name = ScreenshotConfig.INTERPOLATION_METHOD
    return getattr(cv2, f'INTER_{method_name}')


def get_border_mode():
    """Returns OpenCV border mode constant"""
    import cv2
    mode_name = ScreenshotConfig.BORDER_MODE
    return getattr(cv2, f'BORDER_{mode_name}')
