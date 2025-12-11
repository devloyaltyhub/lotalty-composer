#!/usr/bin/env python3
"""
iOS Simulator Service

Manages iOS simulator operations including listing, booting, and status checking.
Replaces bash functions from generate-appstore-screenshots.sh.
"""

import subprocess
import time
import re
from typing import Optional, List, Dict


class SimulatorError(Exception):
    """Raised when simulator operations fail"""
    pass


class SimulatorService:
    """Service for managing iOS simulators"""

    # Constants
    BOOT_WAIT_SECONDS = 3
    XCRUN_CMD = "xcrun"
    SIMCTL_CMD = "simctl"

    def __init__(self):
        self._check_xcrun_available()

    def _check_xcrun_available(self) -> None:
        """Check if xcrun is available (macOS only)"""
        try:
            subprocess.run(
                [self.XCRUN_CMD, "--version"],
                capture_output=True,
                check=True
            )
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise SimulatorError(
                "xcrun not found. This tool requires Xcode Command Line Tools on macOS."
            )

    def _run_simctl(self, args: List[str]) -> subprocess.CompletedProcess:
        """
        Run simctl command

        Args:
            args: List of arguments to pass to simctl

        Returns:
            CompletedProcess with result

        Raises:
            SimulatorError: If command fails
        """
        cmd = [self.XCRUN_CMD, self.SIMCTL_CMD] + args

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            return result
        except subprocess.CalledProcessError as e:
            raise SimulatorError(
                f"simctl command failed: {' '.join(cmd)}\n"
                f"Error: {e.stderr}"
            )

    def get_simulator_id(self, device_name: str) -> Optional[str]:
        """
        Get simulator ID (UDID) by device name

        Args:
            device_name: Name of the device (e.g., "iPhone 15 Pro Max")

        Returns:
            Simulator UDID or None if not found
        """
        result = self._run_simctl(["list", "devices", "available"])

        # Parse output to find matching device
        # Format: "iPhone 15 Pro Max (UDID) (Booted/Shutdown)"
        pattern = rf"{re.escape(device_name)}\s+\(([A-F0-9-]+)\)"
        match = re.search(pattern, result.stdout)

        if match:
            return match.group(1)

        return None

    def is_simulator_booted(self, simulator_id: str) -> bool:
        """
        Check if simulator is booted

        Args:
            simulator_id: Simulator UDID

        Returns:
            True if booted, False otherwise
        """
        result = self._run_simctl(["list", "devices"])

        # Check if this simulator is listed as "Booted"
        pattern = rf"{simulator_id}\)\s+\(Booted\)"
        return bool(re.search(pattern, result.stdout))

    def boot_simulator(self, simulator_id: str, wait: bool = True) -> None:
        """
        Boot simulator

        Args:
            simulator_id: Simulator UDID
            wait: Whether to wait for boot to complete

        Raises:
            SimulatorError: If boot fails
        """
        # Guard clause: Check if already booted
        if self.is_simulator_booted(simulator_id):
            return  # Already booted, nothing to do

        try:
            self._run_simctl(["boot", simulator_id])

            if wait:
                time.sleep(self.BOOT_WAIT_SECONDS)

                # Verify boot succeeded
                if not self.is_simulator_booted(simulator_id):
                    raise SimulatorError(
                        f"Simulator {simulator_id} failed to boot properly"
                    )
        except SimulatorError:
            raise
        except Exception as e:
            raise SimulatorError(f"Failed to boot simulator: {e}")

    def shutdown_simulator(self, simulator_id: str) -> None:
        """
        Shutdown simulator

        Args:
            simulator_id: Simulator UDID
        """
        # Guard clause: Check if already shut down
        if not self.is_simulator_booted(simulator_id):
            return  # Already shut down

        self._run_simctl(["shutdown", simulator_id])

    def list_devices(self) -> List[Dict[str, str]]:
        """
        List all available simulators

        Returns:
            List of dicts with 'name', 'udid', 'state' keys
        """
        result = self._run_simctl(["list", "devices", "available"])

        devices = []
        # Parse output
        pattern = r"(.+?)\s+\(([A-F0-9-]+)\)\s+\((.+?)\)"

        for line in result.stdout.splitlines():
            match = re.search(pattern, line.strip())
            if match:
                devices.append({
                    'name': match.group(1).strip(),
                    'udid': match.group(2),
                    'state': match.group(3)
                })

        return devices

    def get_or_boot_simulator(self, device_name: str) -> str:
        """
        Get simulator ID and ensure it's booted

        Args:
            device_name: Name of the device

        Returns:
            Simulator UDID

        Raises:
            SimulatorError: If device not found or boot fails
        """
        # Get simulator ID
        simulator_id = self.get_simulator_id(device_name)

        # Guard clause: Simulator not found
        if not simulator_id:
            raise SimulatorError(
                f"Simulator '{device_name}' not found. "
                f"Available simulators: {[d['name'] for d in self.list_devices()]}"
            )

        # Boot if needed
        self.boot_simulator(simulator_id)

        return simulator_id
