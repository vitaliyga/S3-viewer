import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import TextViewer from './FileTypeHandlers/TextViewer';
import ImageViewer from './FileTypeHandlers/ImageViewer';
import CsvViewer from './FileTypeHandlers/CsvViewer';
import DocxViewer from './FileTypeHandlers/DocxViewer';
import XlsxViewer from './FileTypeHandlers/XlsxViewer';

function FileViewer({ file, currentPath, onSelectFile, imageFiles = [] }) {
  const [fileData, setFileData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSyncCommand, setShowSyncCommand] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [localBasePath, setLocalBasePath] = useState('');
  const syncCommandRef = useRef(null);

  // Format file size with proper units (B, KB, MB, GB, TB)
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    // Use TB for extremely large files
    if (i >= 4) {
      return `${(bytes / Math.pow(1024, 4)).toFixed(2)} TB`;
    }
    // Use GB for very large files
    else if (i === 3) {
      return `${(bytes / Math.pow(1024, 3)).toFixed(2)} GB`;
    }
    // Use MB for large files
    else if (i === 2) {
      return `${Math.round(bytes / Math.pow(1024, 2))} MB`;
    }
    // Use KB for medium files
    else if (i === 1) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    // Use B for small files
    else {
      return `${bytes} B`;
    }
  };

  const isImageExtension = (extension) => {
    return ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'svg', 'webp', 'bmp'].includes(extension?.toLowerCase());
  };

  const normalizeBucketName = (value) => {
    if (!value) return '';
    const cleaned = value.trim();
    if (cleaned.startsWith('s3://')) {
      return cleaned.slice(5).split('/')[0];
    }
    return cleaned.split('/')[0];
  };

  const getDirectFileUrl = (filePath) => {
    const urlParams = new URLSearchParams(window.location.search);
    const publicUrl = urlParams.get('public_url');
    const endpoint = urlParams.get('endpoint') || 'https://s3.amazonaws.com';
    const bucket = normalizeBucketName(urlParams.get('bucket'));

    const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${encodedPath}`;
    }

    if (!bucket) return '';

    if (endpoint === 'https://s3.amazonaws.com') {
      return `https://${bucket}.s3.amazonaws.com/${encodedPath}`;
    }

    return `${endpoint.replace(/\/$/, '')}/${bucket}/${encodedPath}`;
  };

  const imageList = imageFiles.filter((item) => isImageExtension(item.extension));
  const currentImageIndex = file && imageList.length > 0
    ? imageList.findIndex((item) => item.path === file.path)
    : -1;
  const canNavigateImages = currentImageIndex >= 0 && imageList.length > 1;

  const openAdjacentImage = useCallback((direction) => {
    if (!canNavigateImages || !onSelectFile) return;
    const nextIndex = (currentImageIndex + direction + imageList.length) % imageList.length;
    onSelectFile(imageList[nextIndex]);
  }, [canNavigateImages, onSelectFile, currentImageIndex, imageList]);

  // Handle clicks outside the sync command dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (syncCommandRef.current && !syncCommandRef.current.contains(event.target)) {
        setShowSyncCommand(false);
      }
    }

    // Add event listener when dropdown is open
    if (showSyncCommand) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Clean up event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSyncCommand]);

  useEffect(() => {
    if (!file || !isImageExtension(file.extension)) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onSelectFile?.(null);
      } else if (event.key === 'ArrowLeft') {
        openAdjacentImage(-1);
      } else if (event.key === 'ArrowRight') {
        openAdjacentImage(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onSelectFile, currentImageIndex, imageList.length, openAdjacentImage]);

  // Get URL parameters for the sync command
  const getUrlParams = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      endpoint: urlParams.get('endpoint'),
      bucket: urlParams.get('bucket') || ''
    };
  };

  // Set default local base path when bucket changes
  useEffect(() => {
    const { bucket } = getUrlParams();
    if (bucket) {
      setLocalBasePath(`./s3_${bucket.split('-').join('_')}`);
    }
  }, []);

  // Calculate the full local path that mirrors the S3 path structure
  const getFullLocalPath = () => {
    // Start with the base path
    let path = localBasePath;

    // If there's a current path, append it to maintain the same directory structure locally
    if (currentPath) {
      path += `/${currentPath}`;
    }

    return path;
  };

  // Update local path handler
  const handleLocalPathChange = (e) => {
    setLocalBasePath(e.target.value);
  };

  // Generate the AWS S3 sync command
  const getSyncCommand = () => {
    const { endpoint, bucket } = getUrlParams();
    // Don't proceed if bucket is empty or null
    if (!bucket) {
      return 'Please configure bucket in settings first';
    }
    return `aws s3 sync s3://${bucket}${currentPath ? '/' + currentPath : ''} ${getFullLocalPath()} --no-sign-request ${endpoint ? '--endpoint-url ' + endpoint : ''}`;
  };

  // Copy sync command to clipboard
  const copyCommandToClipboard = () => {
    navigator.clipboard.writeText(getSyncCommand())
      .then(() => {
        setCopiedToast(true);
        setTimeout(() => {
          setCopiedToast(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Get file icon based on extension
  const getFileIcon = (extension) => {
    const iconMap = {
      // Text files
      'txt': '📄',
      'md': '📝',
      'json': '📋',
      'xml': '📋',
      'html': '🌐',
      'css': '🎨',
      'js': '📜',
      'py': '🐍',

      // Images
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️',
      'tif': '🖼️',
      'tiff': '🖼️',
      'svg': '🖼️',

      // Documents
      'pdf': '📑',
      'docx': '📘',
      'doc': '📘',
      'xlsx': '📊',
      'xls': '📊',

      // Other
      'csv': '📊',
      'zip': '🗜️',
      'tar': '🗜️',
      'gz': '🗜️',
      'rar': '🗜️',

      // Media
      'mp3': '🎵',
      'wav': '🎵',
      'mp4': '🎬',
      'mov': '🎬',
      'avi': '🎬',

      // Programming
      'java': '☕',
      'cpp': '🔧',
      'c': '🔧',
      'rb': '💎',
      'php': '🐘',
      'go': '🔵',
      'rs': '🦀'
    };

    return iconMap[extension?.toLowerCase()] || '📄';
  };

  // Large file preview component
  const LargeFilePreview = ({ fileData }) => {
    const icon = getFileIcon(fileData.extension);

    return (
      <div className="text-center p-8">
        <div className="mb-6 text-9xl">{icon}</div>
        <h2 className="text-xl font-medium mb-4">{fileData.name || 'Large File'}</h2>
        <p className="mb-4 text-amber-600">{fileData.preview}</p>
        <p className="text-gray-600 mb-8">
          Files over 100MB can be downloaded but not previewed in the browser.
        </p>
        <button
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onClick={handleDownload}
        >
          Download File
        </button>
      </div>
    );
  };

  useEffect(() => {
    if (!file) return;

    // Updated fetchFilePreview function for FileViewer.js
    const fetchFilePreview = async () => {
      setError(null);

      if (isImageExtension(file.extension)) {
        setFileData({
          type: 'image',
          url: getDirectFileUrl(file.path),
          size: file.size || 0,
          name: file.name,
          extension: file.extension,
          mime: `image/${file.extension === 'jpg' ? 'jpeg' : file.extension}`
        });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      // Check if file is a video file — stream directly
      const fileExt = file.extension?.toLowerCase();
      if (['mp4', 'mov', 'webm', 'm4v', 'ogv'].includes(fileExt)) {
        const mimeMap = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4', ogv: 'video/ogg' };
        setFileData({
          type: 'video',
          url: getDirectFileUrl(file.path),
          mime: mimeMap[fileExt] || 'video/mp4',
          size: file.size || 0,
          name: file.name,
          extension: file.extension
        });
        setIsLoading(false);
        return;
      }

      // Check if file is an archive file
      if (['zip', 'tar', 'gz', 'rar'].includes(fileExt)) {
        setFileData({
          type: 'zip',
          preview: 'Archive files cannot be previewed. Please download to view contents.',
          size: file.size || 0,
          name: file.name,
          extension: file.extension
        });
        setIsLoading(false);
        return;
      }

      // Check if file size exceeds preview limit (100MB = 104857600 bytes)
      const MAX_PREVIEW_SIZE = 104857600;
      if (file.size > MAX_PREVIEW_SIZE) {
        setFileData({
          type: 'too_large',
          preview: `This file is ${formatFileSize(file.size)}, which exceeds the preview size limit.`,
          size: file.size,
          name: file.name,
          extension: file.extension
        });
        setIsLoading(false);
        return;
      }

      try {
        // Get URL parameters to include in the request
        const urlParams = new URLSearchParams(window.location.search);
        const endpoint = urlParams.get('endpoint');
        const bucket = urlParams.get('bucket');

        // Build request URL with all necessary parameters
        let requestUrl = `/api/file?path=${encodeURIComponent(file.path)}&preview=true&size=${file.size || 0}`;

        // Add endpoint and bucket parameters if they exist
        if (endpoint) {
          requestUrl += `&endpoint=${encodeURIComponent(endpoint)}`;
        }

        if (bucket) {
          requestUrl += `&bucket=${encodeURIComponent(bucket)}`;
        }

        const response = await axios.get(requestUrl);
        setFileData(response.data);
      } catch (err) {
        setError('Failed to load file preview: ' + (err.response?.data?.error || err.message));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilePreview();
  }, [file]);

  const handleDownload = () => {
    if (!file) return;
    const link = document.createElement('a');
    link.href = getDirectFileUrl(file.path);
    link.download = file.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render empty state if no file is selected
  if (!file) {
    const { bucket } = getUrlParams();

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Current directory info header */}
        {currentPath && (
          <div className="bg-gray-100 p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium">
                  Current Directory: {currentPath || 'Root'}
                </h2>
              </div>
              {bucket && (
                <div className="relative">
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    onClick={() => setShowSyncCommand(!showSyncCommand)}
                  >
                    Download All Files
                  </button>

                  {showSyncCommand && (
                    <div ref={syncCommandRef} className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded shadow-lg z-10 w-96">
                      <div className="p-3">
                        <h3 className="font-medium text-gray-800 mb-1">AWS S3 Sync Command</h3>
                        <p className="text-xs text-gray-600 mb-2">Use this command with AWS CLI to download all files in this directory:</p>

                        <div className="bg-gray-100 p-2 rounded font-mono text-xs mb-2 overflow-x-auto text-gray-800">
                          {getSyncCommand()}
                        </div>
                        <div className="flex justify-end">
                          <button
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 focus:outline-none"
                            onClick={copyCommandToClipboard}
                          >
                            Copy Command
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {copiedToast && (
                    <div className="absolute top-full mt-2 right-0 bg-gray-800 text-white px-4 py-2 rounded shadow-lg text-sm whitespace-nowrap z-50">
                      Command copied to clipboard!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center bg-white p-8">
          <div className="text-center text-gray-500">
            <div className="text-5xl mb-4">📄</div>
            <p>Select a file to preview</p>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4 mx-auto"></div>
          <p className="text-gray-600">Loading file preview...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-white p-8">
        <div className="text-center text-red-500 max-w-lg">
          <div className="text-4xl mb-4">⚠️</div>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const renderFullscreenImage = () => {
    if (!file || !file.extension || !isImageExtension(file.extension)) return null;

    return (
      <div className="fixed inset-0 z-[100] bg-black/95 text-white">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 bg-black/30 backdrop-blur-sm">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="text-xs text-white/70">
                {currentImageIndex >= 0 ? `${currentImageIndex + 1} / ${imageList.length}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canNavigateImages && (
                <>
                  <button
                    className="rounded-full border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={() => openAdjacentImage(-1)}
                    type="button"
                  >
                    ←
                  </button>
                  <button
                    className="rounded-full border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                    onClick={() => openAdjacentImage(1)}
                    type="button"
                  >
                    →
                  </button>
                </>
              )}
              <button
                className="rounded-full border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                onClick={() => onSelectFile?.(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <img
                src={fileData?.url || ''}
                alt={file.name}
                className="max-h-full max-w-full object-contain select-none shadow-2xl"
                draggable="false"
              />
            </div>

            {canNavigateImages && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl hover:bg-white/20"
                  onClick={() => openAdjacentImage(-1)}
                  type="button"
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-4 py-3 text-2xl hover:bg-white/20"
                  onClick={() => openAdjacentImage(1)}
                  type="button"
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render file preview based on type
  return (
    <div className="h-full flex flex-col bg-white">
      {renderFullscreenImage()}

      {/* File info header */}
      <div className="bg-gray-100 p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium">{file.name}</h2>
            <p className="text-sm text-gray-500">
              {file.size ? formatFileSize(file.size) : ''}
              {file.lastModified ? ` • Last modified: ${new Date(file.lastModified).toLocaleString()}` : ''}
            </p>
          </div>
          <div className="flex space-x-2">
            {currentPath && (
              <div className="relative">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  onClick={() => setShowSyncCommand(!showSyncCommand)}
                >
                  Download Directory
                </button>

                {showSyncCommand && (
                  <div ref={syncCommandRef} className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded shadow-lg z-10 w-96">
                    <div className="p-3">
                      <h3 className="font-medium text-gray-800 mb-1">AWS S3 Sync Command</h3>
                      <p className="text-xs text-gray-600 mb-2">Use this command with AWS CLI to download all files in this directory:</p>

                      <div className="bg-gray-100 p-2 rounded font-mono text-xs mb-2 overflow-x-auto text-gray-800">
                        {getSyncCommand()}
                      </div>
                      <div className="flex justify-end">
                        <button
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 focus:outline-none"
                          onClick={copyCommandToClipboard}
                        >
                          Copy Command
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {copiedToast && (
                  <div className="absolute top-full mt-2 right-0 bg-gray-800 text-white px-4 py-2 rounded shadow-lg text-sm whitespace-nowrap z-50">
                    Command copied to clipboard!
                  </div>
                )}
              </div>
            )}
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>
        </div>
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto p-4">
        {fileData && (
          <>
            {fileData.type === 'text' && (
              <TextViewer content={fileData.preview} extension={fileData.extension} />
            )}

            {fileData.type === 'image' && (
              <ImageViewer src={fileData.url} mime={fileData.mime} />
            )}

            {fileData.type === 'csv' && (
              <CsvViewer data={fileData.preview} />
            )}

            {fileData.type === 'xlsx' && (
              <XlsxViewer data={fileData.preview} />
            )}

            {fileData.type === 'docx' && (
              <DocxViewer content={fileData.preview} />
            )}

            {fileData.type === 'video' && (
              <div className="flex items-center justify-center h-full">
                <video
                  key={fileData.url}
                  src={fileData.url}
                  controls
                  autoPlay
                  className="max-h-full max-w-full bg-black rounded"
                >
                  <source src={fileData.url} type={fileData.mime} />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}

            {/* Large file display with appropriate icon */}
            {fileData.type === 'too_large' && (
              <LargeFilePreview fileData={fileData} />
            )}

            {/* Zip file display with appropriate icon */}
            {fileData.type === 'zip' && (
              <div className="text-center p-8">
                <div className="mb-6 text-9xl">🗜️</div>
                <h2 className="text-xl font-medium mb-4">{file.name}</h2>
                <p className="mb-4 text-amber-600">{fileData.preview}</p>
                <p className="text-gray-600 mb-8">
                  Archive files cannot be previewed directly in the browser.
                </p>
                <button
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={handleDownload}
                >
                  Download Archive
                </button>
              </div>
            )}

            {(fileData.type === 'binary' || fileData.type === 'unsupported') && (
              <div className="text-center p-8">
                <div className="mb-6 text-9xl">{getFileIcon(file.extension) || '📄'}</div>
                <h2 className="text-xl font-medium mb-4">{file.name}</h2>
                <p className="mb-4 text-gray-600">{fileData.preview}</p>
                <p className="text-gray-600 mb-8">
                  This file type cannot be previewed in the browser.
                </p>
                <button
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onClick={handleDownload}
                >
                  Download File
                </button>
              </div>
            )}

            {fileData.type === 'error' && (
              <div className="text-center p-8 text-red-500">
                <p>{fileData.preview}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default FileViewer;
