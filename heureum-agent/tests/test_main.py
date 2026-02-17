# Copyright (c) 2026 Heureum AI. All rights reserved.

"""
Tests for main application.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root() -> None:
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["message"] == "Heureum Agent Service"


def test_health_check() -> None:
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "0.1.0"


def test_docs_available() -> None:
    """Test that API docs are available."""
    response = client.get("/docs")
    assert response.status_code == 200
