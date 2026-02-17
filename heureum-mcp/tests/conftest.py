# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Shared test configuration."""
import os

# Ensure test environment
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("SSRF_PROTECTION_ENABLED", "True")
os.environ.setdefault("CACHE_ENABLED", "True")
os.environ.setdefault("CONTENT_WRAPPING_ENABLED", "True")
