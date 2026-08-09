/**
 * Honest labeling per AGENTS.md: never imply a real model call or outbound
 * message happened while execution is simulated.
 */
export function SimulationNote() {
  return (
    <aside className="exec-sim-note">
      <b>Simulated execution</b>
      <p>
        Sarvam model calls and outbound messages are simulated in this prototype. Run state,
        approvals and logs are real and persisted.
      </p>
    </aside>
  );
}
