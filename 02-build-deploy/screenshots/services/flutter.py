#!/usr/bin/env python3
"""
Flutter Service

Manages Flutter operations including test execution and screenshot capture.
Replaces bash functions from generate-appstore-screenshots.sh.
"""

import subprocess
import os
from pathlib import Path
from typing import Optional, List
import logging


class FlutterError(Exception):
    """Raised when Flutter operations fail"""
    pass


class FlutterService:
    """Service for managing Flutter operations"""

    # Constants
    FLUTTER_CMD = "flutter"
    DEFAULT_DEVICE_ID = "all"  # Run on all connected devices

    def __init__(self, project_dir: Optional[Path] = None):
        """
        Initialize Flutter service

        Args:
            project_dir: Path to Flutter project directory
        """
        self.project_dir = project_dir or Path.cwd()
        self.logger = logging.getLogger(__name__)
        self._check_flutter_available()

    def _check_flutter_available(self) -> None:
        """Check if Flutter is available"""
        try:
            subprocess.run(
                [self.FLUTTER_CMD, "--version"],
                capture_output=True,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise FlutterError(
                "Flutter not found. Please install Flutter SDK."
            )

    def _run_flutter(
        self,
        args: List[str],
        cwd: Optional[Path] = None,
        check: bool = True
    ) -> subprocess.CompletedProcess:
        """
        Run Flutter command

        Args:
            args: Arguments to pass to flutter
            cwd: Working directory (defaults to project_dir)
            check: Whether to raise exception on non-zero exit

        Returns:
            CompletedProcess with result

        Raises:
            FlutterError: If command fails and check=True
        """
        cmd = [self.FLUTTER_CMD] + args
        working_dir = cwd or self.project_dir

        self.logger.info(f"Running: {' '.join(cmd)}")

        try:
            result = subprocess.run(
                cmd,
                cwd=working_dir,
                capture_output=True,
                text=True,
                check=check
            )
            return result
        except subprocess.CalledProcessError as e:
            raise FlutterError(
                f"Flutter command failed: {' '.join(cmd)}\n"
                f"Exit code: {e.returncode}\n"
                f"Stdout: {e.stdout}\n"
                f"Stderr: {e.stderr}"
            )

    def run_integration_test(
        self,
        test_file: str,
        device_id: Optional[str] = None,
        flavor: Optional[str] = None
    ) -> bool:
        """
        Run Flutter integration test

        Args:
            test_file: Path to test file (relative to integration_test/)
            device_id: Device ID to run on (defaults to DEFAULT_DEVICE_ID)
            flavor: Build flavor (optional)

        Returns:
            True if tests passed, False otherwise

        Raises:
            FlutterError: If test execution fails critically
        """
        args = [
            "test",
            f"integration_test/{test_file}",
            "-d", device_id or self.DEFAULT_DEVICE_ID
        ]

        if flavor:
            args.extend(["--flavor", flavor])

        try:
            result = self._run_flutter(args, check=False)

            # Check if tests passed
            if result.returncode == 0:
                self.logger.info("Integration tests passed ✅")
                return True
            else:
                self.logger.warning(f"Integration tests failed (exit code: {result.returncode})")
                return False

        except FlutterError as e:
            self.logger.error(f"Integration test execution error: {e}")
            raise

    def run_drive_test(
        self,
        test_file: str,
        device_id: Optional[str] = None,
        driver_file: str = "test_driver/integration_test.dart"
    ) -> bool:
        """
        Run Flutter drive test (older integration test API)

        Args:
            test_file: Path to test file
            device_id: Device ID to run on
            driver_file: Path to driver file (default: test_driver/integration_test.dart)

        Returns:
            True if tests passed
        """
        args = [
            "drive",
            "--target", test_file,
            "--driver", driver_file
        ]

        if device_id:
            args.extend(["-d", device_id])

        cmd = [self.FLUTTER_CMD] + args
        self.logger.info(f"Running: {' '.join(cmd)}")

        # Run flutter drive with output streaming (not captured)
        result = subprocess.run(
            cmd,
            cwd=self.project_dir,
            check=False
        )

        return result.returncode == 0

    def get_devices(self) -> List[dict]:
        """
        Get list of connected devices

        Returns:
            List of device dictionaries with 'id', 'name', 'platform' keys
        """
        result = self._run_flutter(["devices", "--machine"])

        # Parse JSON output
        import json
        try:
            devices_data = json.loads(result.stdout)
            return [
                {
                    'id': device.get('id'),
                    'name': device.get('name'),
                    'platform': device.get('platform'),
                    'emulator': device.get('emulator', False)
                }
                for device in devices_data
            ]
        except json.JSONDecodeError as e:
            raise FlutterError(f"Failed to parse devices output: {e}")

    def clean(self) -> None:
        """Clean Flutter project build artifacts"""
        self._run_flutter(["clean"])
        self.logger.info("Flutter project cleaned")

    def pub_get(self) -> None:
        """Run flutter pub get to fetch dependencies"""
        self._run_flutter(["pub", "get"])
        self.logger.info("Flutter dependencies fetched")

    def build(
        self,
        platform: str,
        flavor: Optional[str] = None,
        release: bool = False
    ) -> None:
        """
        Build Flutter app

        Args:
            platform: Target platform (ios, android, etc.)
            flavor: Build flavor (optional)
            release: Build in release mode
        """
        args = ["build", platform]

        if flavor:
            args.extend(["--flavor", flavor])

        if release:
            args.append("--release")

        self._run_flutter(args)
        self.logger.info(f"Built {platform} app")
