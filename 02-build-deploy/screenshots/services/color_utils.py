#!/usr/bin/env python3
"""
Color Utility Functions

Provides color manipulation functions for the screenshot mockup system.
Used primarily for generating lighter shades of colors for decorative elements.

Usage:
    from services.color_utils import lighten_color, hex_to_hsl, hsl_to_hex

    lighter = lighten_color("#FF5733", 0.20)  # 20% lighter
"""

import colorsys
from typing import Tuple


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """
    Convert hex color to RGB tuple (0-255 range)

    Args:
        hex_color: Color in hex format (e.g., "#FF5733" or "FF5733")

    Returns:
        Tuple of (R, G, B) values in 0-255 range

    Example:
        >>> hex_to_rgb("#FF5733")
        (255, 87, 51)
    """
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def rgb_to_hex(r: int, g: int, b: int) -> str:
    """
    Convert RGB values to hex color string

    Args:
        r: Red value (0-255)
        g: Green value (0-255)
        b: Blue value (0-255)

    Returns:
        Hex color string with # prefix

    Example:
        >>> rgb_to_hex(255, 87, 51)
        '#ff5733'
    """
    return f"#{r:02x}{g:02x}{b:02x}"


def hex_to_hsl(hex_color: str) -> Tuple[float, float, float]:
    """
    Convert hex color to HSL tuple

    Args:
        hex_color: Color in hex format (e.g., "#FF5733")

    Returns:
        Tuple of (H, S, L) values where:
        - H (hue): 0.0 to 1.0
        - S (saturation): 0.0 to 1.0
        - L (lightness): 0.0 to 1.0

    Example:
        >>> hex_to_hsl("#FF5733")
        (0.029, 1.0, 0.6)  # approximately
    """
    r, g, b = hex_to_rgb(hex_color)
    # Normalize to 0-1 range
    r_norm, g_norm, b_norm = r / 255.0, g / 255.0, b / 255.0
    # colorsys uses HLS (not HSL), where L is in the middle
    h, l, s = colorsys.rgb_to_hls(r_norm, g_norm, b_norm)
    return (h, s, l)  # Return as HSL


def hsl_to_hex(h: float, s: float, l: float) -> str:
    """
    Convert HSL values to hex color string

    Args:
        h: Hue (0.0 to 1.0)
        s: Saturation (0.0 to 1.0)
        l: Lightness (0.0 to 1.0)

    Returns:
        Hex color string with # prefix

    Example:
        >>> hsl_to_hex(0.029, 1.0, 0.6)
        '#ff5733'  # approximately
    """
    # colorsys uses HLS (H, L, S order)
    r_norm, g_norm, b_norm = colorsys.hls_to_rgb(h, l, s)
    r = int(round(r_norm * 255))
    g = int(round(g_norm * 255))
    b = int(round(b_norm * 255))
    return rgb_to_hex(r, g, b)


def lighten_color(hex_color: str, amount: float = 0.20) -> str:
    """
    Increase the lightness of a color by a specified amount

    This function converts the color to HSL, increases the L value,
    and converts back to hex. The result is a lighter shade of the
    original color while maintaining the same hue and saturation.

    Args:
        hex_color: Color in hex format (e.g., "#FF5733")
        amount: Amount to increase lightness (0.0 to 1.0)
                Default is 0.20 (20% lighter)

    Returns:
        Hex color string of the lightened color

    Example:
        >>> lighten_color("#FF5733", 0.20)
        '#ff9980'  # approximately 20% lighter

    Note:
        - If the resulting lightness would exceed 1.0, it's clamped to 1.0
        - Very light colors may not change much as they're already near max
    """
    h, s, l = hex_to_hsl(hex_color)
    # Increase lightness, clamping to maximum of 1.0
    new_l = min(1.0, l + amount)
    return hsl_to_hex(h, s, new_l)


def darken_color(hex_color: str, amount: float = 0.20) -> str:
    """
    Decrease the lightness of a color by a specified amount

    Args:
        hex_color: Color in hex format (e.g., "#FF5733")
        amount: Amount to decrease lightness (0.0 to 1.0)
                Default is 0.20 (20% darker)

    Returns:
        Hex color string of the darkened color

    Example:
        >>> darken_color("#FF5733", 0.20)
        '#cc2200'  # approximately 20% darker
    """
    h, s, l = hex_to_hsl(hex_color)
    # Decrease lightness, clamping to minimum of 0.0
    new_l = max(0.0, l - amount)
    return hsl_to_hex(h, s, new_l)


def get_gradient_colors(
    base_color: str,
    lighten_amount: float = 0.15
) -> Tuple[str, str]:
    """
    Generate two colors suitable for a gradient from a base color

    Creates a gradient pair where:
    - First color is the base color
    - Second color is a slightly lighter version

    Args:
        base_color: Base hex color for the gradient
        lighten_amount: How much lighter the second color should be

    Returns:
        Tuple of (base_color, lighter_color)

    Example:
        >>> get_gradient_colors("#FF5733")
        ('#FF5733', '#ff8066')
    """
    lighter = lighten_color(base_color, lighten_amount)
    return (base_color, lighter)


def adjust_saturation(hex_color: str, amount: float) -> str:
    """
    Adjust the saturation of a color

    Args:
        hex_color: Color in hex format
        amount: Amount to adjust (-1.0 to 1.0)
                Positive values increase saturation
                Negative values decrease saturation

    Returns:
        Hex color string with adjusted saturation
    """
    h, s, l = hex_to_hsl(hex_color)
    new_s = max(0.0, min(1.0, s + amount))
    return hsl_to_hex(h, new_s, l)