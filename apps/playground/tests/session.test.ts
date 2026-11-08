import { expect, test } from 'vitest';
import { LabSession } from '../src/session.js';

test('initial content is produced and replicated by real operations', () => {
  const session = new LabSession();
  const view = session.snapshot();
  expect(view.converged).toBe(true);
  expect(view.replicas.every((replica) => replica.count === 1)).toBe(true);
  expect(view.events.some((event) => event.type === 'delivered')).toBe(true);
});

test('offline edits remain independent and recover through simulated delivery', () => {
  const session = new LabSession();
  session.simulation.setConnected('c', false);
  session.write('c', 'title', 'offline', 'text');
  session.simulation.advanceBy(200);
  expect(session.replicas[0]?.get('title')).toBe('A shared starting point');
  expect(session.snapshot().converged).toBe(false);
  session.simulation.setConnected('c', true);
  session.simulation.advanceBy(500);
  expect(session.snapshot().converged).toBe(true);
  expect(session.replicas[0]?.get('title')).toBe('offline');
});

test('invalid input does not alter state and JSON values use engine validation', () => {
  const session = new LabSession();
  const before = session.replicas[0]?.operationCount;
  expect(() => session.write('a', '', 'value', 'text')).toThrow(/key/);
  expect(() => session.write('a', 'x', '{', 'json')).toThrow(/valid JSON/);
  expect(() => session.write('a', 'x', '1e999', 'json')).toThrow();
  expect(session.replicas[0]?.operationCount).toBe(before);
  session.write('a', 'x', '{"done":true}', 'json');
  expect(session.replicas[0]?.get('x')).toEqual({ done: true });
});

test('scenario sessions retain real events and new sessions reset transient state', () => {
  const session = new LabSession(17, 'delete-vs-stale');
  expect(session.replicas[0]?.winner('title')?.type).toBe('DELETE');
  const reset = new LabSession(17);
  expect(reset.snapshot().seed).toBe(17);
  expect(reset.replicas[0]?.winner('title')?.type).toBe('SET');
});
