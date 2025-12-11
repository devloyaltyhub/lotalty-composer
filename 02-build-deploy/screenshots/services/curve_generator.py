#!/usr/bin/env python3
"""
Decorative Curve Generator

Generates smooth, organic curves for mockup backgrounds using ImageMagick.
Curves are generated with reproducible randomness based on a seed string.

Usage:
    from services.curve_generator import CurveGenerator

    generator = CurveGenerator()
    generator.create_curve_overlay(
        width=1320,
        height=2868,
        curve_color="#FF8866",
        seed="01_home",
        output_path=Path("/tmp/curves.png")
    )
"""

import hashlib
import random
import subprocess
import logging
from pathlib import Path
from typing import List, Tuple

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config.screenshot_config import DecorativeCurvesConfig


class CurveGenerator:
    """Generates decorative curves for mockup backgrounds"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.config = DecorativeCurvesConfig

    def _get_seeded_random(self, seed: str) -> random.Random:
        """
        Create a seeded random generator for reproducible curves

        Args:
            seed: String to use as seed (typically filename)

        Returns:
            Seeded random.Random instance
        """
        hash_int = int(hashlib.md5(seed.encode()).hexdigest(), 16)
        rng = random.Random(hash_int)
        return rng

    def _generate_wavy_curve_points(
        self,
        width: int,
        height: int,
        rng: random.Random,
        start_side: str = 'left',
        num_waves: int = 3
    ) -> List[Tuple[int, int]]:
        """
        Generate control points for a wavy curve with long, flowing undulations.

        Creates an organic wave pattern with smooth, elongated curves that
        extend well into the canvas. The waves are gentle and flowing,
        not short or choppy.

        Args:
            width: Canvas width
            height: Canvas height
            rng: Seeded random generator
            start_side: Which side the curve starts from ('left' or 'right')
            num_waves: Number of wave peaks (2-3 recommended for longer curves)

        Returns:
            List of (x, y) control points for the wavy curve
        """
        cfg = self.config

        # Base amplitude (how far waves extend into canvas)
        # Use higher minimum for longer-looking curves
        base_amplitude = int(width * rng.uniform(cfg.CURVE_AMPLITUDE_MIN, cfg.CURVE_AMPLITUDE_MAX))

        # Generate wave points from top to bottom
        points = []
        segment_height = height / (num_waves * 2)  # Each wave has peak and valley

        # Start position
        start_y = int(height * rng.uniform(cfg.CURVE_START_Y_MIN, cfg.CURVE_START_Y_MAX))
        end_y = int(height * rng.uniform(cfg.CURVE_END_Y_MIN, cfg.CURVE_END_Y_MAX))

        # Edge position (0 for left, width for right)
        edge_x = 0 if start_side == 'left' else width
        direction = 1 if start_side == 'left' else -1

        # Start at edge
        points.append((edge_x, start_y))

        # Generate alternating peaks and valleys
        for i in range(num_waves * 2):
            # Calculate Y position for this control point
            progress = (i + 1) / (num_waves * 2)
            y = int(start_y + (end_y - start_y) * progress)

            # Add slight randomness to Y position (less variance for smoother curves)
            y_variance = int(segment_height * 0.2)
            y += rng.randint(-y_variance, y_variance)
            y = max(0, min(height, y))  # Clamp to canvas

            # Alternate between peak (extends into canvas) and valley
            if i % 2 == 0:
                # Peak - extends well into canvas (high amplitude)
                amplitude_variance = rng.uniform(0.85, 1.0)
                x = edge_x + direction * int(base_amplitude * amplitude_variance)
            else:
                # Valley - still extends into canvas, but less than peak
                # Higher values (0.4-0.6) make curves look longer and more flowing
                valley_depth = rng.uniform(0.4, 0.6)
                x = edge_x + direction * int(base_amplitude * valley_depth)

            points.append((x, y))

        # End at edge
        points.append((edge_x, end_y))

        return points

    def _generate_curve_points(
        self,
        width: int,
        height: int,
        rng: random.Random,
        start_side: str = 'left'
    ) -> List[Tuple[int, int]]:
        """
        Generate control points for a wavy decorative curve.

        This is the main entry point that delegates to _generate_wavy_curve_points.

        Args:
            width: Canvas width
            height: Canvas height
            rng: Seeded random generator
            start_side: Which side the curve starts from ('left' or 'right')

        Returns:
            List of (x, y) control points for the curve
        """
        # Random number of waves (2-3 for longer, more flowing curves)
        num_waves = rng.randint(2, 3)
        return self._generate_wavy_curve_points(width, height, rng, start_side, num_waves)

    def _generate_blob_points(
        self,
        width: int,
        height: int,
        rng: random.Random
    ) -> List[Tuple[int, int]]:
        """
        Generate points for a blob/bubble shape

        Args:
            width: Canvas width
            height: Canvas height
            rng: Seeded random generator

        Returns:
            List of points defining a blob shape
        """
        # Random center position
        center_x = int(width * rng.uniform(0.2, 0.8))
        center_y = int(height * rng.uniform(0.2, 0.8))

        # Random size
        size_x = int(width * rng.uniform(0.3, 0.5))
        size_y = int(height * rng.uniform(0.2, 0.4))

        # Generate ellipse-like blob with some variation
        return [
            (center_x - size_x, center_y),
            (center_x - int(size_x * 0.7), center_y - int(size_y * 0.8)),
            (center_x + int(size_x * 0.7), center_y - int(size_y * 0.9)),
            (center_x + size_x, center_y),
            (center_x + int(size_x * 0.8), center_y + int(size_y * 0.85)),
            (center_x - int(size_x * 0.8), center_y + int(size_y * 0.9)),
        ]

    def _points_to_svg_path(
        self,
        points: List[Tuple[int, int]],
        width: int,
        height: int,
        fill_to_edge: str = 'left'
    ) -> str:
        """
        Convert control points to SVG path string for ImageMagick.

        Uses quadratic Bezier curves (Q command) to create smooth waves
        through multiple control points.

        Args:
            points: List of (x, y) control points
            width: Canvas width
            height: Canvas height
            fill_to_edge: Which edge to fill to ('left', 'right', or 'bottom')

        Returns:
            SVG path string compatible with ImageMagick -draw
        """
        if len(points) < 3:
            return ""

        # Start path at first point
        path = f"M {points[0][0]},{points[0][1]} "

        # Use quadratic Bezier curves through all points
        # Q command: Q control_x,control_y end_x,end_y
        # For smooth waves, we use each point as an anchor and calculate control points
        for i in range(1, len(points) - 1):
            # Current point is the control point
            ctrl = points[i]
            # End point is midway to next point (for smooth connection)
            if i < len(points) - 2:
                end_x = (points[i][0] + points[i + 1][0]) // 2
                end_y = (points[i][1] + points[i + 1][1]) // 2
            else:
                # Last segment goes directly to final point
                end_x = points[i + 1][0]
                end_y = points[i + 1][1]

            path += f"Q {ctrl[0]},{ctrl[1]} {end_x},{end_y} "

        # Close the shape by drawing to canvas edge and back
        last_point = points[-1]
        first_point = points[0]

        if fill_to_edge == 'left':
            # Draw down to bottom-left, across bottom, up to start
            path += f"L 0,{height} L 0,{first_point[1]} Z"
        elif fill_to_edge == 'right':
            # Draw down to bottom-right, across bottom, up to start
            path += f"L {width},{height} L {width},{first_point[1]} Z"
        else:
            path += f"L {last_point[0]},{height} L {first_point[0]},{height} Z"

        return path

    def _blob_to_svg_path(
        self,
        points: List[Tuple[int, int]]
    ) -> str:
        """
        Convert blob points to a closed SVG path

        Args:
            points: List of (x, y) points defining the blob

        Returns:
            SVG path string for a closed blob shape
        """
        if len(points) < 6:
            return ""

        path = f"M {points[0][0]},{points[0][1]} "

        # First curve segment
        path += f"C {points[1][0]},{points[1][1]} "
        path += f"{points[2][0]},{points[2][1]} "
        path += f"{points[3][0]},{points[3][1]} "

        # Second curve segment to close
        path += f"C {points[4][0]},{points[4][1]} "
        path += f"{points[5][0]},{points[5][1]} "
        path += f"{points[0][0]},{points[0][1]} Z"

        return path

    def generate_curve_paths(
        self,
        width: int,
        height: int,
        seed: str
    ) -> List[str]:
        """
        Generate SVG paths for decorative curves

        Args:
            width: Canvas width in pixels
            height: Canvas height in pixels
            seed: String to use as random seed (e.g., filename)

        Returns:
            List of SVG path strings for ImageMagick
        """
        rng = self._get_seeded_random(seed)
        cfg = self.config
        paths = []

        # Determine number of curves
        num_curves = rng.randint(cfg.MIN_CURVES, cfg.MAX_CURVES)

        # Distribution: 40% left, 40% right, 20% both sides
        side_choices = ['left', 'left', 'right', 'right', 'both']

        for i in range(num_curves):
            # Choose curve side with variety
            curve_type = rng.choice(side_choices)

            if curve_type == 'both':
                # Generate curves on both left and right sides
                points_left = self._generate_curve_points(width, height, rng, 'left')
                points_right = self._generate_curve_points(width, height, rng, 'right')
                path_left = self._points_to_svg_path(points_left, width, height, 'left')
                path_right = self._points_to_svg_path(points_right, width, height, 'right')
                if path_left:
                    paths.append(path_left)
                if path_right:
                    paths.append(path_right)
            else:
                points = self._generate_curve_points(width, height, rng, curve_type)
                path = self._points_to_svg_path(points, width, height, curve_type)
                if path:
                    paths.append(path)

        return paths

    def create_curve_overlay(
        self,
        width: int,
        height: int,
        curve_color: str,
        seed: str,
        output_path: Path
    ) -> bool:
        """
        Create a PNG image with decorative curves on transparent background

        Args:
            width: Canvas width in pixels
            height: Canvas height in pixels
            curve_color: Hex color for the curves (e.g., "#FF8866")
            seed: String to use as random seed for reproducibility
            output_path: Path to save the output PNG

        Returns:
            True if successful, False otherwise
        """
        paths = self.generate_curve_paths(width, height, seed)

        if not paths:
            self.logger.warning(f"No curve paths generated for seed: {seed}")
            return False

        # Build ImageMagick command
        # Start with transparent canvas
        cmd = [
            'magick',
            '-size', f'{width}x{height}',
            'xc:none',
        ]

        # Add each curve path
        for path in paths:
            cmd.extend([
                '-fill', curve_color,
                '-draw', f"path '{path}'"
            ])

        # Output file
        cmd.append(str(output_path))

        try:
            self.logger.debug(f"Running ImageMagick command: {' '.join(cmd[:10])}...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            self.logger.info(f"Created curve overlay: {output_path}")
            return True

        except subprocess.CalledProcessError as e:
            self.logger.error(f"ImageMagick failed: {e.stderr}")
            return False
        except FileNotFoundError:
            self.logger.error("ImageMagick (magick) not found. Please install it.")
            return False

    def _generate_horizontal_wave_points(
        self,
        width: int,
        height: int,
        rng: random.Random,
        start_edge: str = 'top',
        num_waves: int = 2
    ) -> List[Tuple[int, int]]:
        """
        Generate control points for a horizontal wave (for landscape layouts).

        Creates waves that flow from left to right, starting from top or bottom edge.
        Designed for horizontal banners like Feature Graphic (1024x500).

        Args:
            width: Canvas width
            height: Canvas height
            rng: Seeded random generator
            start_edge: Which edge the curve starts from ('top' or 'bottom')
            num_waves: Number of wave peaks (2-3 recommended)

        Returns:
            List of (x, y) control points for the horizontal wave
        """
        # Base amplitude (how far waves extend into canvas vertically)
        base_amplitude = int(height * rng.uniform(0.3, 0.5))

        points = []
        segment_width = width / (num_waves * 2)

        # Start and end X positions
        start_x = int(width * rng.uniform(0.0, 0.1))
        end_x = int(width * rng.uniform(0.9, 1.0))

        # Edge Y position (0 for top, height for bottom)
        edge_y = 0 if start_edge == 'top' else height
        direction = 1 if start_edge == 'top' else -1

        # Start at edge
        points.append((start_x, edge_y))

        # Generate alternating peaks and valleys horizontally
        for i in range(num_waves * 2):
            progress = (i + 1) / (num_waves * 2)
            x = int(start_x + (end_x - start_x) * progress)

            # Add slight randomness to X position
            x_variance = int(segment_width * 0.2)
            x += rng.randint(-x_variance, x_variance)
            x = max(0, min(width, x))

            if i % 2 == 0:
                # Peak - extends into canvas
                amplitude_variance = rng.uniform(0.7, 1.0)
                y = edge_y + direction * int(base_amplitude * amplitude_variance)
            else:
                # Valley - closer to edge
                valley_depth = rng.uniform(0.2, 0.4)
                y = edge_y + direction * int(base_amplitude * valley_depth)

            points.append((x, y))

        # End at edge
        points.append((end_x, edge_y))

        return points

    def _horizontal_wave_to_svg_path(
        self,
        points: List[Tuple[int, int]],
        width: int,
        height: int,
        fill_to_edge: str = 'top'
    ) -> str:
        """
        Convert horizontal wave points to SVG path string.

        Args:
            points: List of (x, y) control points
            width: Canvas width
            height: Canvas height
            fill_to_edge: Which edge to fill to ('top' or 'bottom')

        Returns:
            SVG path string compatible with ImageMagick -draw
        """
        if len(points) < 3:
            return ""

        path = f"M {points[0][0]},{points[0][1]} "

        for i in range(1, len(points) - 1):
            ctrl = points[i]
            if i < len(points) - 2:
                end_x = (points[i][0] + points[i + 1][0]) // 2
                end_y = (points[i][1] + points[i + 1][1]) // 2
            else:
                end_x = points[i + 1][0]
                end_y = points[i + 1][1]

            path += f"Q {ctrl[0]},{ctrl[1]} {end_x},{end_y} "

        last_point = points[-1]
        first_point = points[0]

        if fill_to_edge == 'top':
            # Close to top edge
            path += f"L {width},0 L 0,0 L {first_point[0]},{first_point[1]} Z"
        else:
            # Close to bottom edge
            path += f"L {width},{height} L 0,{height} L {first_point[0]},{first_point[1]} Z"

        return path

    def generate_horizontal_curve_paths(
        self,
        width: int,
        height: int,
        seed: str
    ) -> List[str]:
        """
        Generate SVG paths for horizontal decorative curves.

        Designed for landscape layouts like Feature Graphic.
        Generates waves flowing from top and/or bottom edges.

        Args:
            width: Canvas width in pixels
            height: Canvas height in pixels
            seed: String to use as random seed

        Returns:
            List of SVG path strings for ImageMagick
        """
        rng = self._get_seeded_random(seed)
        paths = []

        # Generate 1-2 curves
        num_curves = rng.randint(1, 2)

        for i in range(num_curves):
            # Alternate between top and bottom, or just one side
            if num_curves == 2:
                start_edge = 'top' if i == 0 else 'bottom'
            else:
                start_edge = rng.choice(['top', 'bottom'])

            num_waves = rng.randint(2, 3)
            points = self._generate_horizontal_wave_points(
                width, height, rng, start_edge, num_waves
            )
            path = self._horizontal_wave_to_svg_path(
                points, width, height, start_edge
            )
            if path:
                paths.append(path)

        return paths

    def create_horizontal_curve_overlay(
        self,
        width: int,
        height: int,
        curve_color: str,
        seed: str,
        output_path: Path
    ) -> bool:
        """
        Create a PNG image with horizontal decorative curves.

        Designed for landscape layouts like Feature Graphic (1024x500).

        Args:
            width: Canvas width in pixels
            height: Canvas height in pixels
            curve_color: Hex color for the curves
            seed: String to use as random seed
            output_path: Path to save the output PNG

        Returns:
            True if successful, False otherwise
        """
        paths = self.generate_horizontal_curve_paths(width, height, seed)

        if not paths:
            self.logger.warning(f"No horizontal curve paths generated for seed: {seed}")
            return False

        cmd = [
            'magick',
            '-size', f'{width}x{height}',
            'xc:none',
        ]

        for path in paths:
            cmd.extend([
                '-fill', curve_color,
                '-draw', f"path '{path}'"
            ])

        cmd.append(str(output_path))

        try:
            self.logger.debug(f"Running ImageMagick command: {' '.join(cmd[:10])}...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            self.logger.info(f"Created horizontal curve overlay: {output_path}")
            return True

        except subprocess.CalledProcessError as e:
            self.logger.error(f"ImageMagick failed: {e.stderr}")
            return False
        except FileNotFoundError:
            self.logger.error("ImageMagick (magick) not found. Please install it.")
            return False
