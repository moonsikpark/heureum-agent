# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Tests for TTL cache."""
import time
from unittest.mock import patch

import pytest

from src.common.cache import TTLCache, make_cache_key


# ---------------------------------------------------------------------------
# TTLCache
# ---------------------------------------------------------------------------


class TestTTLCache:
    """Tests for TTLCache set, get, expiration, eviction, and edge cases."""

    def test_set_and_get(self):
        """Verify that a stored value can be retrieved by its key."""
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("key1", {"value": 42})
        result = cache.get("key1")
        assert result == {"value": 42}

    def test_get_returns_none_for_missing(self):
        """Verify that get returns None for a key that was never set."""
        cache = TTLCache(ttl=60.0, max_size=10)
        assert cache.get("nonexistent") is None

    def test_get_returns_copy_not_reference(self):
        """Cached dict should be a copy, not a reference to the original."""
        cache = TTLCache(ttl=60.0, max_size=10)
        original = {"value": 42, "items": [1, 2, 3]}
        cache.set("key1", original)

        result1 = cache.get("key1")
        result1["mutated"] = True
        result1["value"] = 999

        result2 = cache.get("key1")
        assert "mutated" not in result2
        assert result2["value"] == 42

    def test_get_returns_copy_for_list(self):
        """Verify that cached lists are shallow-copied on retrieval."""
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("key1", [1, 2, 3])

        result1 = cache.get("key1")
        result1.append(4)

        result2 = cache.get("key1")
        assert result2 == [1, 2, 3]

    def test_shallow_copy_nested_dict_limitation(self):
        """copy.copy() is shallow — nested mutable objects share references.

        This documents a known limitation: nested dict/list mutation
        can leak into the cache. Deep copy is intentionally avoided for
        performance, as the typical use case (JSON-serializable results)
        doesn't mutate nested structures.
        """
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("key1", {"nested": {"inner": 1}})

        result = cache.get("key1")
        result["nested"]["inner"] = 999

        # Shallow copy: nested mutation DOES leak (documented behavior)
        leaked = cache.get("key1")
        assert leaked["nested"]["inner"] == 999

    def test_string_values_not_copied(self):
        """Immutable values (str, int, etc.) are returned as-is, no copy needed."""
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("key1", "immutable")
        assert cache.get("key1") == "immutable"
        assert cache.get("key1") is cache.get("key1")  # Same object is fine for immutables

    def test_ttl_expiration(self):
        """Verify that entries expire and return None after TTL elapses."""
        cache = TTLCache(ttl=0.1, max_size=10)
        cache.set("key1", "value1")

        assert cache.get("key1") == "value1"
        time.sleep(0.15)
        assert cache.get("key1") is None

    def test_fifo_eviction(self):
        """Verify that the oldest entry is evicted when max_size is exceeded."""
        cache = TTLCache(ttl=60.0, max_size=3)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        cache.set("d", 4)  # Should evict "a"

        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("d") == 4

    def test_clear(self):
        """Verify that clear removes all entries from the cache."""
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()

        assert cache.get("a") is None
        assert cache.get("b") is None

    def test_overwrite_existing_key(self):
        """Verify that setting an existing key updates its value."""
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("key1", "old")
        cache.set("key1", "new")
        assert cache.get("key1") == "new"

    def test_max_size_one(self):
        """Cache with max_size=1 should only keep the last entry."""
        cache = TTLCache(ttl=60.0, max_size=1)
        cache.set("a", 1)
        cache.set("b", 2)
        assert cache.get("a") is None
        assert cache.get("b") == 2

    def test_overwrite_does_not_increase_size(self):
        """Overwriting a key should not trigger eviction of other keys."""
        cache = TTLCache(ttl=60.0, max_size=3)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        cache.set("a", 10)  # Overwrite, not a new key
        # All keys should still be accessible
        assert cache.get("a") == 10
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_expired_entries_evicted_on_set(self):
        """Expired entries should be cleaned up when setting new entries."""
        cache = TTLCache(ttl=0.05, max_size=10)
        cache.set("old", "value")
        time.sleep(0.1)
        cache.set("new", "value")
        assert cache.get("old") is None
        assert len(cache._store) == 1

    def test_integer_values(self):
        """Verify that integer values can be stored and retrieved correctly."""
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("k", 42)
        assert cache.get("k") == 42

    def test_none_value(self):
        """Storing None as a value — get() returns None which is indistinguishable from miss.
        This is a documented edge case.
        """
        cache = TTLCache(ttl=60.0, max_size=10)
        cache.set("k", None)
        # Returns None, same as a miss — by design
        assert cache.get("k") is None


# ---------------------------------------------------------------------------
# make_cache_key
# ---------------------------------------------------------------------------


class TestMakeCacheKey:
    """Tests for the make_cache_key hashing utility."""

    def test_deterministic(self):
        """Verify that identical inputs produce identical cache keys."""
        key1 = make_cache_key("fetch", "https://example.com", "50000")
        key2 = make_cache_key("fetch", "https://example.com", "50000")
        assert key1 == key2

    def test_different_inputs_different_keys(self):
        """Verify that different inputs produce different cache keys."""
        key1 = make_cache_key("fetch", "https://a.com")
        key2 = make_cache_key("fetch", "https://b.com")
        assert key1 != key2

    def test_order_matters(self):
        """Verify that argument order affects the resulting cache key."""
        key1 = make_cache_key("a", "b")
        key2 = make_cache_key("b", "a")
        assert key1 != key2

    def test_returns_hex_string(self):
        """Verify that the cache key is a 64-character hex SHA-256 digest."""
        key = make_cache_key("test")
        assert len(key) == 64  # SHA-256 hex digest
        assert all(c in "0123456789abcdef" for c in key)

    def test_single_part(self):
        """Verify that a single argument produces a valid cache key."""
        key = make_cache_key("single")
        assert isinstance(key, str)
        assert len(key) == 64

    def test_empty_parts(self):
        """Verify that empty string arguments produce a valid cache key."""
        key = make_cache_key("", "")
        assert isinstance(key, str)
        assert len(key) == 64
