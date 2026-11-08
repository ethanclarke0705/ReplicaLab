import { expect, test } from 'vitest';
import { runScenario } from '@replicalab/simulator';
import { eventExplanation, eventMatches } from '../src/eventPresentation.js';

test('resolution explanations distinguish timestamp ordering, ID ties and tombstones', () => {
  const stale = runScenario('delete-vs-stale')
    .simulation.events()
    .find(
      (event) =>
        event.type === 'received' && event.result.status === 'superseded',
    );
  const tied = runScenario('concurrent-edits')
    .simulation.events()
    .find(
      (event) =>
        event.type === 'received' && event.result.status === 'superseded',
    );
  if (!stale || !tied)
    throw new Error('Scenario did not emit its expected resolution event');
  expect(eventExplanation(stale)).toContain('greater logical timestamp');
  expect(eventExplanation(stale)).toContain('tombstone keeps the key deleted');
  expect(eventExplanation(tied)).toContain('greater replica ID');
  expect(eventMatches(tied, 'superseded')).toBe(true);
  expect(eventExplanation(tied)).toContain('does not prove');
});
