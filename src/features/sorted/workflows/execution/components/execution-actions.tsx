'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { performRunAction } from '../actions';
import { actionsForRunStatus, RUN_ACTION_META, RUN_STATUS_META } from '../state';
import type { RunAction, RunStatus } from '../types';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Context-aware actions for a run. Which buttons appear is derived entirely
 * from the run state (state.ts); this component only handles interaction:
 * confirmation for destructive actions, double-submit protection, pending
 * state, and success/error feedback.
 */
export function ExecutionActions({ runId, status }: { runId: string; status: RunStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<RunAction | null>(null);
  const [confirming, setConfirming] = useState<RunAction | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(
    null,
  );

  const actions = actionsForRunStatus(status);

  const execute = (action: RunAction, note?: string) => {
    if (isPending) return;
    setConfirming(null);
    setPendingAction(action);
    setFeedback(null);

    startTransition(async () => {
      const result = await performRunAction({ runId, action, note });
      setPendingAction(null);

      if (result.ok) {
        setFeedback({ kind: 'success', message: result.message });
        if (result.runId !== runId) {
          // "Run again" starts a fresh run — take the user to it.
          router.push(`/workflows/runs/${result.runId}`);
        } else {
          router.refresh();
        }
      } else {
        setFeedback({ kind: 'error', message: result.error.message });
        if (result.error.code === 'INVALID_TRANSITION') {
          // The run moved on while the user was looking at stale state.
          router.refresh();
        }
      }
    });
  };

  const handleClick = (action: RunAction) => {
    if (RUN_ACTION_META[action].confirm) {
      setFeedback(null);
      setConfirming(action);
    } else {
      execute(action);
    }
  };

  const confirmingMeta = confirming ? RUN_ACTION_META[confirming] : null;

  return (
    <section className="exec-card exec-actions" aria-label="Run actions">
      <div className="exec-card-head">
        <h2>Actions</h2>
      </div>

      {actions.length === 0 ? (
        <p className="exec-empty">No actions are available while this run is {RUN_STATUS_META[status].label.toLowerCase()}.</p>
      ) : (
        <div className="exec-actions-buttons">
          {actions.map((action) => {
            const meta = RUN_ACTION_META[action];
            const isActing = pendingAction === action;
            const className =
              meta.variant === 'primary'
                ? 'primary'
                : meta.variant === 'danger'
                  ? 'exec-btn-danger'
                  : 'secondary';

            return (
              <button
                key={action}
                type="button"
                className={className}
                disabled={isPending}
                aria-busy={isActing || undefined}
                onClick={() => handleClick(action)}
              >
                {isActing ? meta.pendingLabel : meta.label}
              </button>
            );
          })}
        </div>
      )}

      <div role="status" aria-live="polite" className="exec-actions-feedback">
        {feedback && (
          <p className={`exec-feedback exec-feedback-${feedback.kind}`}>
            <span aria-hidden="true">{feedback.kind === 'success' ? '✓' : '✕'}</span>{' '}
            {feedback.message}
          </p>
        )}
      </div>

      {confirmingMeta?.confirm && confirming && (
        <ConfirmDialog
          open
          title={confirmingMeta.confirm.title}
          body={confirmingMeta.confirm.body}
          confirmLabel={confirmingMeta.confirm.confirmLabel}
          withNote={confirmingMeta.confirm.withNote}
          busy={isPending}
          danger={confirmingMeta.variant === 'danger'}
          onConfirm={(note) => execute(confirming, note)}
          onClose={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
