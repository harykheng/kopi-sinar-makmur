import { useRef } from 'react';
import { useDialogKeyboard } from '../hooks/useDialogKeyboard.js';

// Generic modal shell, reused by admin's ProductFormModal/PromoFormModal/OrderDetailModal.
// Mirrors the original .modal-overlay/.modal-box/.modal-header/.modal-close markup,
// toggled via the "active" class (opacity/pointer-events transition in main.css).
export default function Modal({ isOpen, onClose, title, boxClassName = '', overlayClassName = '', children }) {
  const boxRef = useRef(null);
  useDialogKeyboard({ active: isOpen, onClose, containerRef: boxRef });

  return (
    <div
      className={`modal-overlay${isOpen ? ' active' : ''}${overlayClassName ? ` ${overlayClassName}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal-box${boxClassName ? ` ${boxClassName}` : ''}`} ref={boxRef}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
