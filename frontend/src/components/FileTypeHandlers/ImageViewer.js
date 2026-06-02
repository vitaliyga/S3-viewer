import React from 'react';

function ImageViewer({ base64Data, mime, src }) {
  const imageSrc = src || `data:${mime};base64,${base64Data}`;

  return (
    <div className="flex justify-center">
      <img
        src={imageSrc}
        alt="Preview"
        className="max-w-full shadow-lg rounded"
      />
    </div>
  );
}

export default ImageViewer;
