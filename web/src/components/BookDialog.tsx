import { useEffect, useRef } from 'react';

interface BookDialogProps {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

/**
 * 自定义历史档案弹窗，替代原生 alert。
 * 支持：点击遮罩关闭、Esc 关闭、关闭按钮、确定按钮。
 */
export function BookDialog({
  open,
  title,
  content,
  onClose,
}: BookDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-dialog-title"
        aria-describedby="book-dialog-content"
      >
        <button
          type="button"
          className="dialog-close"
          aria-label="关闭弹窗"
          onClick={onClose}
        >
          ✕
        </button>

        <p className="dialog-eyebrow">历史档案 · 1935</p>
        <h2 className="dialog-title" id="book-dialog-title">
          {title}
        </h2>
        <p className="dialog-content" id="book-dialog-content">
          {content}
        </p>

        <div className="dialog-actions">
          <button
            ref={confirmRef}
            type="button"
            className="dialog-confirm"
            onClick={onClose}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}
