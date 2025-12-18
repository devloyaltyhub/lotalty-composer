#!/usr/bin/env python3
"""
Project Configuration Module

Implements the Open/Closed Principle (OCP) from SOLID:
- Open for extension (new projects can be added)
- Closed for modification (existing code doesn't need to change)

Each project (loyalty-app, loyalty-admin-main, etc.) has its own
configuration class that knows its directory structure and requirements.

Usage:
    from config.project_config import get_project_config

    config = get_project_config('admin')
    generator = MockupGenerator(project_config=config)
"""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional
import os


class ProjectConfig(ABC):
    """
    Abstract base class for project-specific configurations.

    Implements Dependency Inversion Principle (DIP):
    High-level modules (MockupGenerator) depend on this abstraction,
    not on concrete project implementations.
    """

    def __init__(self, repo_root: Optional[Path] = None):
        """
        Initialize project configuration.

        Args:
            repo_root: Repository root path. Auto-detected if not provided.
        """
        if repo_root is None:
            # Auto-detect: config -> screenshots -> 02-build-deploy -> loyalty-composer -> repo_root
            self._repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
        else:
            self._repo_root = repo_root

    @property
    def repo_root(self) -> Path:
        """Repository root path"""
        return self._repo_root

    @property
    @abstractmethod
    def project_name(self) -> str:
        """Human-readable project name"""
        pass

    @property
    @abstractmethod
    def project_slug(self) -> str:
        """Short identifier for CLI (e.g., 'app', 'admin')"""
        pass

    @property
    @abstractmethod
    def project_dir(self) -> Path:
        """Project root directory"""
        pass

    @property
    @abstractmethod
    def screenshots_dir(self) -> Path:
        """Directory where raw screenshots are stored"""
        pass

    @property
    @abstractmethod
    def mockups_output_dir(self) -> Path:
        """Directory where mockups will be generated"""
        pass

    @property
    @abstractmethod
    def metadata_dir(self) -> Path:
        """Directory for store metadata (descriptions, changelogs, etc.)"""
        pass

    @property
    @abstractmethod
    def client_assets_dir(self) -> Optional[Path]:
        """Directory containing client-specific assets (logo, etc.)"""
        pass

    @property
    @abstractmethod
    def top_images_dir(self) -> Optional[Path]:
        """Directory containing top images for mockups"""
        pass

    @property
    @abstractmethod
    def config_json_path(self) -> Optional[Path]:
        """Path to config.json with primary color"""
        pass

    # Feature flags
    @property
    def generate_iphone(self) -> bool:
        """Whether to generate iPhone mockups"""
        return True

    @property
    def generate_ipad(self) -> bool:
        """Whether to generate iPad mockups"""
        return True

    @property
    def generate_gplay_phone(self) -> bool:
        """Whether to generate Google Play phone mockups"""
        return True

    @property
    def generate_gplay_tablet(self) -> bool:
        """Whether to generate Google Play tablet mockups"""
        return True

    @property
    def generate_feature_graphic(self) -> bool:
        """Whether to generate Google Play Feature Graphic"""
        return True

    def get_primary_color(self) -> Optional[str]:
        """
        Load primary color from config.json if available.

        Returns:
            Hex color string (e.g., '#FF5722') or None
        """
        config_path = self.config_json_path
        if config_path is None or not config_path.exists():
            return None

        try:
            import json
            with open(config_path, 'r') as f:
                config = json.load(f)
            return config.get('colors', {}).get('primary')
        except (json.JSONDecodeError, IOError):
            return None

    def ensure_directories(self) -> None:
        """Create necessary directories if they don't exist"""
        self.screenshots_dir.mkdir(parents=True, exist_ok=True)
        self.mockups_output_dir.mkdir(parents=True, exist_ok=True)


class LoyaltyAppConfig(ProjectConfig):
    """
    Configuration for loyalty-app (white label mobile app).

    This is the original project structure that the screenshot
    system was built for. Generates mockups for both iOS and Android.
    """

    @property
    def project_name(self) -> str:
        return "Loyalty App (Mobile)"

    @property
    def project_slug(self) -> str:
        return "app"

    @property
    def project_dir(self) -> Path:
        return self.repo_root / "loyalty-app"

    @property
    def white_label_dir(self) -> Path:
        """Flutter project directory"""
        return self.project_dir / "white_label_app"

    @property
    def screenshots_dir(self) -> Path:
        return self.white_label_dir / "screenshots"

    @property
    def mockups_output_dir(self) -> Path:
        return self.screenshots_dir / "mockups"

    @property
    def metadata_dir(self) -> Path:
        return self.white_label_dir / "metadata"

    @property
    def client_assets_dir(self) -> Optional[Path]:
        return self.white_label_dir / "assets" / "client_specific_assets"

    @property
    def top_images_dir(self) -> Optional[Path]:
        # Top images are in the mockupgen_templates directory
        templates_dir = Path(__file__).resolve().parent.parent / "mockupgen_templates"
        return templates_dir / "top_images"

    @property
    def config_json_path(self) -> Optional[Path]:
        return self.white_label_dir / "config.json"

    # All features enabled for mobile app
    @property
    def generate_iphone(self) -> bool:
        return True

    @property
    def generate_ipad(self) -> bool:
        return True

    @property
    def generate_gplay_phone(self) -> bool:
        return True

    @property
    def generate_gplay_tablet(self) -> bool:
        return True

    @property
    def generate_feature_graphic(self) -> bool:
        return True


class LoyaltyAdminConfig(ProjectConfig):
    """
    Configuration for loyalty-admin-main (merchant admin panel).

    This is a Flutter desktop/web application for merchants to manage
    their loyalty programs. Currently only deployed to Google Play Store.

    Key differences from mobile app:
    - No iOS deployment (yet)
    - Desktop-focused UI (may need different mockup treatment)
    - Simpler store presence (only Google Play)
    """

    @property
    def project_name(self) -> str:
        return "Loyalty Admin (Merchant Panel)"

    @property
    def project_slug(self) -> str:
        return "admin"

    @property
    def project_dir(self) -> Path:
        return self.repo_root / "loyalty-admin-main"

    @property
    def screenshots_dir(self) -> Path:
        return self.project_dir / "screenshots"

    @property
    def mockups_output_dir(self) -> Path:
        return self.screenshots_dir / "mockups"

    @property
    def metadata_dir(self) -> Path:
        return self.project_dir / "metadata"

    @property
    def client_assets_dir(self) -> Optional[Path]:
        """Admin panel uses shared assets from the project"""
        assets_dir = self.project_dir / "assets" / "images"
        if assets_dir.exists():
            return assets_dir
        return None

    @property
    def top_images_dir(self) -> Optional[Path]:
        """Admin-specific top images directory"""
        top_dir = self.project_dir / "screenshots" / "top_images"
        if top_dir.exists():
            return top_dir
        # Fallback to shared templates
        templates_dir = Path(__file__).resolve().parent.parent / "mockupgen_templates"
        return templates_dir / "top_images"

    @property
    def config_json_path(self) -> Optional[Path]:
        """Admin doesn't use config.json for colors"""
        return None

    # Feature flags for admin panel
    @property
    def generate_iphone(self) -> bool:
        """Admin is not on iOS App Store"""
        return False

    @property
    def generate_ipad(self) -> bool:
        """Admin is not on iOS App Store"""
        return False

    @property
    def generate_gplay_phone(self) -> bool:
        """Generate phone screenshots for Play Store"""
        return True

    @property
    def generate_gplay_tablet(self) -> bool:
        """Generate tablet screenshots for Play Store"""
        return True

    @property
    def generate_feature_graphic(self) -> bool:
        """Generate Feature Graphic banner for Play Store"""
        return True

    def get_primary_color(self) -> Optional[str]:
        """
        Admin panel uses a fixed brand color.

        Returns the Loyalty Hub admin primary color.
        """
        # Admin panel brand color (purple/indigo)
        return "#6366F1"


# Registry of available project configurations
PROJECT_CONFIGS = {
    'app': LoyaltyAppConfig,
    'admin': LoyaltyAdminConfig,
}


def get_project_config(project_slug: str, repo_root: Optional[Path] = None) -> ProjectConfig:
    """
    Factory function to get project configuration by slug.

    Args:
        project_slug: Project identifier ('app', 'admin')
        repo_root: Optional repository root path

    Returns:
        ProjectConfig instance for the specified project

    Raises:
        ValueError: If project slug is not recognized

    Example:
        config = get_project_config('admin')
        print(config.project_name)  # "Loyalty Admin (Merchant Panel)"
    """
    if project_slug not in PROJECT_CONFIGS:
        available = ', '.join(PROJECT_CONFIGS.keys())
        raise ValueError(
            f"Unknown project: '{project_slug}'. "
            f"Available projects: {available}"
        )

    config_class = PROJECT_CONFIGS[project_slug]
    return config_class(repo_root=repo_root)


def list_available_projects() -> list:
    """
    List all available project configurations.

    Returns:
        List of tuples (slug, name) for each project
    """
    result = []
    for slug, config_class in PROJECT_CONFIGS.items():
        # Create temporary instance to get name
        config = config_class()
        result.append((slug, config.project_name))
    return result
