import { RUN_STATUS_META } from '../state';
import type { RunStatus } from '../types';

/** Status chip. Symbol + text so state never relies on color alone. */
export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = RUN_STATUS_META[status];
  return (
    <span className={`exec-badge exec-tone-${meta.tone}`}>
      <span aria-hidden="true">{meta.symbol}</span>
      {meta.label}
    </span>
  );
}
