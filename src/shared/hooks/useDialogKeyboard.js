import { useEffect, useRef } from 'react';

// Keyboard behaviour every modal/sheet needs (R-32): Escape closes it, focus
// moves into the dialog when it opens, and focus returns to whatever opened it
// when it closes. Pass `active: false` while a child dialog is stacked on top,
// so only the topmost dialog reacts to Escape.
//
// onClose is kept in a ref on purpose. Callers pass inline arrow functions
// (`onClose={() => setOpen(false)}`), which get a new identity every render;
// if the effect depended on it, every keystroke inside the dialog would re-run
// the effect and yank focus back to the container. Only `active` may re-run it.
//
// No Tab trap: these overlays cover the viewport and lock body scroll, the
// close button is always reachable, and Escape always works.
export function useDialogKeyboard({ active, onClose, containerRef }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;

    const opener = document.activeElement;
    const container = containerRef?.current;
    let rafId = null;

    if (container) {
      if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
      // Defer a frame so a display:none -> flex toggle has been applied before
      // focusing; focusing a hidden element is a no-op.
      rafId = requestAnimationFrame(() => container.focus({ preventScroll: true }));
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        onCloseRef.current?.();
      }
    }
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

// onKeyDown handler for a non-<button> element acting as a button
// (role="button" tabIndex={0}): Enter and Space trigger the click handler,
// matching native button semantics.
export function onKeyActivate(handler) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler(e);
    }
  };
}
