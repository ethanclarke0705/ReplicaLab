import { useState } from 'react';
import { scenarioNames, type ScenarioName } from '@replicalab/simulator';
import type { LabActions } from './useLab.js';

export const scenarioLabels: Record<
  ScenarioName,
  { title: string; description: string }
> = {
  normal: {
    title: 'Normal synchronisation',
    description: 'One edit travels to the other two replicas.',
  },
  'offline-recovery': {
    title: 'Offline edit & reconnect',
    description:
      'A disconnected device edits locally, then exchanges missing operations.',
  },
  'concurrent-edits': {
    title: 'Concurrent conflicting edits',
    description:
      'Three devices edit the same key before delivery. Replica ID breaks the timestamp tie.',
  },
  'delayed-delivery': {
    title: 'Delayed delivery',
    description:
      'A write remains local until its packet reaches the scheduled deadline.',
  },
  'duplicate-delivery': {
    title: 'Duplicate delivery',
    description:
      'Each packet arrives twice; the second copy is ignored by the engine.',
  },
  'out-of-order': {
    title: 'Out-of-order delivery',
    description:
      'A newer operation arrives before an older one. The newer value stays visible.',
  },
  'delete-vs-stale': {
    title: 'Deletion vs. stale update',
    description:
      'A tombstone arrives before an older SET and prevents the key from returning.',
  },
  'partition-recovery': {
    title: 'Partition & recovery',
    description:
      'Split the network, edit on both sides, then restore links and reconcile.',
  },
};

export function ScenarioPanel({ lab }: { lab: LabActions }) {
  const [scenario, setScenario] = useState<ScenarioName>('concurrent-edits');
  return (
    <section className="scenario-panel panel" aria-labelledby="scenarios-title">
      <div className="panel-heading">
        <span className="scenario-icon" aria-hidden="true">
          ⌁
        </span>
        <h2 id="scenarios-title">Try a scenario</h2>
      </div>
      <label htmlFor="scenario" className="sr-only">
        Scenario
      </label>
      <select
        id="scenario"
        value={scenario}
        onChange={(event) => {
          const choice = scenarioNames.find(
            (item) => item === event.target.value,
          );
          if (choice) setScenario(choice);
        }}
      >
        {scenarioNames.map((name) => (
          <option key={name} value={name}>
            {scenarioLabels[name].title}
          </option>
        ))}
      </select>
      <p>{scenarioLabels[scenario].description}</p>
      <button
        className="secondary full"
        onClick={() => lab.replace(lab.view.seed, scenario)}
      >
        Run scenario <span aria-hidden="true">↗</span>
      </button>
      <small>
        Starts fresh with seed {lab.view.seed}, runs to completion, then pauses
        for inspection.
      </small>
    </section>
  );
}
