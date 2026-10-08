import { useEffect } from 'react';

// Locks background scroll while a modal/sheet is open, matches the original
// vanilla code's `document.body.style.overflow = 'hidden'` pattern.
export function useBodyScrollLock(isOpen) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);
}
