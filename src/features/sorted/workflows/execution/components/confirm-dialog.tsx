'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  /** Collect an optional note (rejection reason, customer reply, …). */
  withNote?: boolean;
  noteLabel?: string;
  busy: boolean;
  danger: boolean;
  onConfirm: (note?: string) => void;
  onClose: () => void;
}

/**
 * Confirmation for deliberate actions, built on the native <dialog> element
 * so focus management, Escape handling and backdrop behavior are correct by
 * default.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  withNote,
  noteLabel = 'Add a note (optional)',
  busy,
  danger,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState('');
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setNote('');
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="exec-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{body}</p>
      {withNote && (
        <label className="exec-dialog-note">
          {noteLabel}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={500}
            disabled={busy}
          />
        </label>
      )}
      <div className="exec-dialog-actions">
        <button type="button" className="secondary" onClick={onClose} disabled={busy}>
          Go back
        </button>
        <button
          type="button"
          className={danger ? 'exec-btn-danger' : 'primary'}
          onClick={() => onConfirm(note.trim() || undefined)}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
