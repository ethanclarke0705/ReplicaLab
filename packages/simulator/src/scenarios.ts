import { Replica } from '@replicalab/core';
import { Simulation } from './simulation.js';

export const scenarioNames = Object.freeze([
  'normal',
  'offline-recovery',
  'concurrent-edits',
  'delayed-delivery',
  'duplicate-delivery',
  'out-of-order',
  'delete-vs-stale',
  'partition-recovery',
] as const);

export type ScenarioName = (typeof scenarioNames)[number];

export interface ScenarioResult {
  readonly simulation: Simulation;
  readonly replicas: readonly Replica[];
}

/** Runs real operations and packet delivery; creates fresh state for every replay. */
export function runScenario(name: ScenarioName, seed = 1): ScenarioResult {
  const replicas = Object.freeze([
    new Replica('a'),
    new Replica('b'),
    new Replica('c'),
  ]);
  const simulation = new Simulation(replicas, { seed });
  switch (name) {
    case 'normal':
      simulation.set('a', 'title', 'Shared draft');
      simulation.advanceBy(10);
      break;
    case 'offline-recovery':
      simulation.set('a', 'title', 'Shared draft');
      simulation.advanceBy(10);
      simulation.setConnected('c', false);
      simulation.set('a', 'title', 'Laptop edit');
      simulation.set('c', 'title', 'Offline edit');
      simulation.advanceBy(40);
      simulation.setConnected('c', true);
      simulation.advanceBy(30);
      break;
    case 'concurrent-edits':
      simulation.set('a', 'title', 'Draft A');
      simulation.set('b', 'title', 'Draft B');
      simulation.set('c', 'title', 'Draft C');
      simulation.advanceBy(10);
      break;
    case 'delayed-delivery':
      simulation.network.configure({ latency: 50 });
      simulation.set('a', 'title', 'Slow message');
      simulation.advanceBy(49);
      simulation.advanceBy(1);
      break;
    case 'duplicate-delivery':
      simulation.network.configure({ duplication: 1 });
      simulation.set('a', 'title', 'Delivered twice');
      simulation.advanceBy(10);
      break;
    case 'out-of-order':
      simulation.set('a', 'title', 'Older', { delay: 50 });
      simulation.set('a', 'title', 'Newer', { delay: 1 });
      simulation.advanceBy(50);
      break;
    case 'delete-vs-stale':
      simulation.set('a', 'title', 'Delayed update', { delay: 50 });
      simulation.delete('a', 'title', { delay: 1 });
      simulation.advanceBy(50);
      break;
    case 'partition-recovery':
      simulation.setLink('a', 'c', false);
      simulation.setLink('b', 'c', false);
      simulation.set('a', 'title', 'Partition AB');
      simulation.set('c', 'title', 'Partition C');
      simulation.advanceBy(50);
      simulation.setLink('a', 'c', true);
      simulation.setLink('b', 'c', true);
      simulation.advanceBy(30);
      break;
    default:
      throw new TypeError(`Unknown scenario: ${String(name)}`);
  }
  return Object.freeze({ simulation, replicas });
}
