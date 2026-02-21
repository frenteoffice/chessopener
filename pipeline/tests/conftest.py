"""Pytest configuration."""

import os
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "integration: mark test as requiring a live database (skipped in CI by default)"
    )


# Use in-memory SQLite or skip DB tests if no PostgreSQL
os.environ.setdefault("DATABASE_URL", "postgresql://localhost:5432/chess_openings?user=postgres&password=postgres")
