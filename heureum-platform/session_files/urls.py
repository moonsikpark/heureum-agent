# Copyright (c) 2026 Heureum AI. All rights reserved.

from django.urls import path

from .views import SessionFileViewSet

# Manual URL patterns for nested /sessions/{session_id}/files/ endpoints
session_file_list = SessionFileViewSet.as_view({"get": "list", "post": "create"})
session_file_detail = SessionFileViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"})
session_file_download = SessionFileViewSet.as_view({"get": "download"})
session_file_read = SessionFileViewSet.as_view({"get": "read_by_path"})
session_file_write = SessionFileViewSet.as_view({"post": "write_by_path"})
session_file_delete_by_path = SessionFileViewSet.as_view({"delete": "delete_by_path"})

urlpatterns = [
    path("<str:session_id>/files/", session_file_list, name="session-file-list"),
    path("<str:session_id>/files/read/", session_file_read, name="session-file-read"),
    path("<str:session_id>/files/write/", session_file_write, name="session-file-write"),
    path("<str:session_id>/files/delete-by-path/", session_file_delete_by_path, name="session-file-delete-by-path"),
    path("<str:session_id>/files/<str:pk>/", session_file_detail, name="session-file-detail"),
    path("<str:session_id>/files/<str:pk>/download/", session_file_download, name="session-file-download"),
]
