// Copyright (c) 2026 Heureum AI. All rights reserved.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFileStore } from '../store/fileStore';
import {
  fetchSessionFiles,
  uploadSessionFile,
  updateSessionFileContent,
  deleteSessionFile,
  downloadSessionFile,
  getSessionFile,
  type SessionFileInfo,
} from '../lib/api';
import MarkdownMessage from './MarkdownMessage';
import './FilePanel.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(file: SessionFileInfo): string {
  if (file.content_type.startsWith('image/')) return '\u{1F5BC}';
  if (file.content_type === 'application/pdf') return '\u{1F4C4}';
  if (file.is_text) return '\u{1F4DD}';
  return '\u{1F4CE}';
}

function isMarkdownFile(file: SessionFileInfo): boolean {
  return /\.(?:md|markdown)$/i.test(file.filename);
}

function isHtmlFile(file: SessionFileInfo): boolean {
  return /\.html?$/i.test(file.filename) || file.content_type === 'text/html';
}

interface FilePanelProps {
  sessionId: string | null;
  sessionTitle?: string;
}

export default function FilePanel({ sessionId, sessionTitle }: FilePanelProps) {
  const {
    files, setFiles, isFilePanelOpen, closeFilePanel,
    selectedFile, clearSelection, mode, setMode,
    updateFileInList, removeFileFromList,
  } = useFileStore();

  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const loadFiles = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await fetchSessionFiles(sessionId);
      setFiles(data);
    } catch {
      // ignore
    }
  }, [sessionId, setFiles]);

  useEffect(() => {
    if (isFilePanelOpen && sessionId) {
      loadFiles();
      // Electron: sync files to local folder and start watching
      if (window.api?.syncSessionFiles) {
        const title = sessionTitle || 'Session Files';
        window.api.syncSessionFiles(sessionId, title, API_BASE_URL);
        window.api.startFileWatcher?.(sessionId, title, API_BASE_URL);
      }
    }
    return () => {
      if (sessionId && window.api?.stopFileWatcher) {
        window.api.stopFileWatcher(sessionId);
      }
    };
  }, [isFilePanelOpen, sessionId, loadFiles, sessionTitle]);

  // Fetch full file detail (with text_content) when a file is selected
  useEffect(() => {
    if (!selectedFile || !sessionId || !selectedFile.is_text) return;
    if (selectedFile.text_content != null) return; // already loaded
    setLoadingDetail(true);
    getSessionFile(sessionId, selectedFile.id)
      .then((detail) => {
        updateFileInList(detail);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  }, [selectedFile?.id, sessionId]);

  useEffect(() => {
    if (selectedFile?.is_text && mode === 'edit') {
      setEditContent(selectedFile.text_content || '');
    }
  }, [selectedFile, mode]);

  if (!isFilePanelOpen) return null;

  const handleUpload = async (fileList: FileList) => {
    if (!sessionId) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        await uploadSessionFile(sessionId, file);
      }
      await loadFiles();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!sessionId || !selectedFile) return;
    setSaving(true);
    try {
      const updated = await updateSessionFileContent(sessionId, selectedFile.id, editContent);
      updateFileInList(updated);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: SessionFileInfo) => {
    if (!sessionId) return;
    if (!confirm(`Delete "${file.path}"?`)) return;
    try {
      await deleteSessionFile(sessionId, file.id);
      removeFileFromList(file.id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleDownload = async (file: SessionFileInfo) => {
    if (!sessionId) return;
    try {
      const blob = await downloadSessionFile(sessionId, file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragging(false);
      dragCounter.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const openInExplorer = async () => {
    if (!sessionId || !window.api?.openSessionFolder) return;
    const title = sessionTitle || 'Session Files';
    // Sync files to local folder before opening
    if (window.api.syncSessionFiles) {
      await window.api.syncSessionFiles(sessionId, title, API_BASE_URL);
    }
    window.api.openSessionFolder(sessionId, title);
  };

  // --- Render ---

  const renderList = () => (
    <div className="fp-list">
      <div
        className={`fp-upload-zone ${dragging ? 'fp-dragging' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && handleUpload(e.target.files)}
        />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>{uploading ? 'Uploading...' : 'Drop files here or click to upload'}</span>
      </div>

      {files.length === 0 && !uploading && (
        <div className="fp-empty">No files yet</div>
      )}

      {files.map((file) => (
        <div key={file.id} className="fp-file-item" onClick={() => useFileStore.getState().selectFile(file)}>
          <span className="fp-file-icon">{fileIcon(file)}</span>
          <div className="fp-file-info">
            <div className="fp-file-name">{file.path}</div>
            <div className="fp-file-meta">
              {formatFileSize(file.size)}
              {file.created_by === 'agent' && <span className="fp-badge">Agent</span>}
            </div>
          </div>
          <div className="fp-file-actions">
            <button className="fp-btn-icon" onClick={(e) => { e.stopPropagation(); handleDownload(file); }} title="Download">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button className="fp-btn-icon fp-btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(file); }} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderEditor = () => {
    if (!selectedFile) return null;
    return (
      <div className="fp-editor">
        <div className="fp-editor-header">
          <button className="fp-btn-back" onClick={clearSelection}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="fp-editor-path">{selectedFile.path}</span>
          <button className="fp-btn-toggle" onClick={() => setMode('preview')}>Preview</button>
          <button className="fp-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <textarea
          className="fp-editor-textarea"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          spellCheck={false}
        />
      </div>
    );
  };

  const renderPreview = () => {
    if (!selectedFile || !sessionId) return null;
    const isImage = selectedFile.content_type.startsWith('image/');
    const isMd = isMarkdownFile(selectedFile);
    const isHtml = isHtmlFile(selectedFile);
    const downloadUrl = `${API_BASE_URL}/api/v1/sessions/${sessionId}/files/${selectedFile.id}/download/`;

    return (
      <div className="fp-preview">
        <div className="fp-editor-header">
          <button className="fp-btn-back" onClick={clearSelection}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="fp-editor-path">{selectedFile.path}</span>
          {selectedFile.is_text && (
            <button className="fp-btn-toggle" onClick={() => setMode('edit')}>Edit</button>
          )}
          <button className="fp-btn-toggle" onClick={() => handleDownload(selectedFile)}>Download</button>
        </div>
        <div className="fp-preview-content">
          {loadingDetail ? (
            <div className="fp-preview-info"><p>Loading...</p></div>
          ) : isHtml && selectedFile.text_content != null ? (
            <iframe
              className="fp-html-preview"
              srcDoc={selectedFile.text_content}
              sandbox="allow-same-origin"
              title={selectedFile.filename}
            />
          ) : isMd && selectedFile.text_content != null ? (
            <div className="fp-markdown-preview">
              <MarkdownMessage content={selectedFile.text_content} />
            </div>
          ) : selectedFile.is_text && selectedFile.text_content != null ? (
            <pre className="fp-text-preview">{selectedFile.text_content}</pre>
          ) : isImage ? (
            <img src={downloadUrl} alt={selectedFile.filename} className="fp-preview-image" />
          ) : (
            <div className="fp-preview-info">
              <p>{selectedFile.filename}</p>
              <p>{selectedFile.content_type}</p>
              <p>{formatFileSize(selectedFile.size)}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fp-panel">
      <div className="fp-header">
        <h3 className="fp-title">Files</h3>
        <div className="fp-header-actions">
          {window.api?.openSessionFolder && (
            <button className="fp-btn-icon" onClick={openInExplorer} title="Open in Explorer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}
          <button className="fp-btn-close" onClick={closeFilePanel}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      {mode === 'list' && renderList()}
      {mode === 'edit' && renderEditor()}
      {mode === 'preview' && renderPreview()}
    </div>
  );
}
