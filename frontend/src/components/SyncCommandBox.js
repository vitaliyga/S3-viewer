import React, { useState, useEffect, useRef } from 'react';

function SyncCommandBox({ bucket, endpoint, currentPath }) {
  const [showToast, setShowToast] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const localBasePath = `./s3_${bucket.split('-').join('_')}`;
  const dropdownRef = useRef(null);

  // Handle clicks outside the dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calculate the full local path that mirrors the S3 path structure
  const getFullLocalPath = () => {
    let path = localBasePath;
    if (currentPath) {
      path += `/${currentPath}`;
    }
    return path;
  };

  // Don't render if there's no bucket
  if (!bucket) {
    return null;
  }

  // Build the URL for the real ZIP archive download
  const buildArchiveUrl = () => {
    const params = new URLSearchParams();
    params.set('prefix', currentPath || '');
    if (endpoint) params.set('endpoint', endpoint);
    if (bucket) params.set('bucket', bucket);
    return `/api/download-archive?${params.toString()}`;
  };

  // Trigger a real archive download via a hidden anchor (browser handles streaming)
  const downloadArchive = () => {
    const a = document.createElement('a');
    a.href = buildArchiveUrl();
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Briefly surface that the archive is being prepared server-side
    setIsPreparing(true);
    setShowToast(true);
    setTimeout(() => {
      setIsPreparing(false);
      setShowToast(false);
    }, 3000);
  };

  // AWS CLI sync command (kept as an advanced alternative)
  const syncCommand = `aws s3 sync s3://${bucket}${currentPath ? '/' + currentPath : ''} ${getFullLocalPath()} --no-sign-request ${endpoint ? '--endpoint-url ' + endpoint : ''}`;

  const copyCommandToClipboard = () => {
    navigator.clipboard.writeText(syncCommand)
      .then(() => {
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  const folderLabel = currentPath ? currentPath.replace(/\/$/, '').split('/').pop() || bucket : bucket;

  return (
    <div className="relative">
      <button
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        Batch Download
      </button>

      {isOpen && (
        <div ref={dropdownRef} className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded shadow-lg z-50 w-96">
          <div className="p-3 text-gray-800">
            <h3 className="font-medium mb-1">Download “{folderLabel}”</h3>
            <p className="text-xs text-gray-600 mb-3">
              Downloads every file in this folder and its subfolders as a single ZIP archive.
            </p>

            <button
              className={`w-full px-3 py-2 rounded text-sm text-white flex items-center justify-center ${
                isPreparing ? 'bg-green-400 cursor-wait' : 'bg-green-600 hover:bg-green-700'
              } focus:outline-none focus:ring-2 focus:ring-green-500`}
              onClick={downloadArchive}
              disabled={isPreparing}
            >
              {isPreparing ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Preparing archive…
                </>
              ) : (
                <>⬇️ Download ZIP</>
              )}
            </button>
            <p className="text-[11px] text-gray-500 mt-2">
              Large folders may take a while to build. Your browser will show the download progress.
            </p>

            <div className="mt-3 border-t border-gray-100 pt-2">
              <button
                className="text-xs text-blue-600 hover:underline focus:outline-none"
                onClick={() => setShowCommand(!showCommand)}
                type="button"
              >
                {showCommand ? 'Hide' : 'Or use the AWS CLI sync command'}
              </button>

              {showCommand && (
                <div className="mt-2">
                  <div className="bg-gray-100 p-2 rounded font-mono text-xs mb-2 overflow-x-auto text-gray-800">
                    {syncCommand}
                  </div>
                  <div className="flex justify-end">
                    <button
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={copyCommandToClipboard}
                    >
                      Copy Command
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="absolute top-full mt-2 right-0 bg-gray-800 text-white px-4 py-2 rounded shadow-lg text-sm whitespace-nowrap z-50">
          {isPreparing ? 'Archive download started…' : 'Command copied to clipboard!'}
        </div>
      )}
    </div>
  );
}

export default SyncCommandBox;
