import { currentStep } from '../state';
import type { WorkflowRun } from '../types';
import { ExecutionStep } from './execution-step';

/** Vertical step visualization of a run. */
export function ExecutionTimeline({ run }: { run: WorkflowRun }) {
  const current = currentStep(run);
  const completed = run.steps.filter((step) => step.status === 'completed').length;

  return (
    <section className="exec-card" aria-label="Execution steps">
      <div className="exec-card-head">
        <h2>Execution</h2>
        <span className="meta">
          {completed} of {run.steps.length} steps completed
        </span>
      </div>
      <ol className="exec-timeline">
        {run.steps.map((step, index) => (
          <ExecutionStep
            key={step.id}
            step={step}
            isCurrent={current?.id === step.id}
            isLast={index === run.steps.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}
