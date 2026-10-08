import { useEffect, useRef, useState } from 'react';
import { useToast } from '../../shared/components/Toast.jsx';
import { onKeyActivate } from '../../shared/hooks/useDialogKeyboard.js';

// Reusable drag/drop + click-to-upload image picker with preview.
// Reports the selected File via onFileSelect; parent owns the "existing URL"
// (already-saved image) vs "new file" (pending upload) distinction.
export default function ImageUploadDropzone({ existingUrl, onFileSelect, onRemove, maxSizeMB = 5, hint, accept = 'image/png,image/jpeg,image/webp' }) {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const showToast = useToast();

  const objectUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(existingUrl || null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(existingUrl || null);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, existingUrl]);

  function acceptFile(f) {
    if (!f) return;
    if (f.size > maxSizeMB * 1024 * 1024) {
      showToast(`Ukuran foto maks ${maxSizeMB} MB ya!`, 'error');
      return;
    }
    setFile(f);
    onFileSelect(f);
  }

  function handleRemove(e) {
    e.stopPropagation();
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  }

  return (
    <div
      className={`image-upload-area${dragOver ? ' dragover' : ''}`}
      role="button"
      tabIndex={0}
      aria-label="Pilih atau seret foto"
      onClick={() => inputRef.current?.click()}
      onKeyDown={onKeyActivate(() => inputRef.current?.click())}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) acceptFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        className="image-upload-input"
        accept={accept}
        onChange={(e) => acceptFile(e.target.files[0])}
        style={{ display: 'none' }}
      />
      {previewUrl ? (
        <div className="image-preview-wrap">
          <img src={previewUrl} alt="Preview" />
          <button type="button" className="image-remove-btn" onClick={handleRemove} aria-label="Hapus foto">✕</button>
        </div>
      ) : (
        <div>
          <div className="image-upload-text">Klik atau seret foto ke sini</div>
          <div className="image-upload-sub">{hint}</div>
        </div>
      )}
    </div>
  );
}
