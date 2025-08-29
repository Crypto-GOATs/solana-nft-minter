import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function DropzonePreview({ onFileSelected }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const f = acceptedFiles[0];
    if (f) {
      setFile(f);
      onFileSelected && onFileSelected(f);
    }
  }, [onFileSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.webm', '.m4v']
    }
  });

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className={`dropzone ${isDragActive ? 'active' : ''}`} {...getRootProps()}>
      <input {...getInputProps()} />
      {!file && (
        <>
          <p><strong>Drag & drop</strong> an image or video here, or click to select.</p>
          <p className="small">Supported: PNG, JPG, GIF, WEBP, MP4, MOV, WEBM, M4V</p>
        </>
      )}
      {file && (
        <div style={{ width: '100%' }}>
          {file.type.startsWith('image') ? (
            <img className="preview" src={previewUrl} alt="preview" />
          ) : (
            <video className="preview" src={previewUrl} controls />
          )}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: 12 }}>
            <span className="tag">{file.name} • {(file.size/1024/1024).toFixed(2)} MB</span>
            <button type="button" className="button" onClick={(e) => { e.stopPropagation(); setFile(null); onFileSelected && onFileSelected(null); }}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
