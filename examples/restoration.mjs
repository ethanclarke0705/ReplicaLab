import assert from 'node:assert/strict';
import { log } from 'node:console';
import { Replica } from '../packages/core/dist/index.js';

const laptop = new Replica('laptop');
const phone = new Replica('phone');
phone.receive(laptop.set('note', 'Shared draft'));
laptop.delete('note');

// A storage adapter must commit this complete record atomically, not only state().
const stored = JSON.stringify(laptop.checkpoint());
const restored = Replica.restore(JSON.parse(stored));
assert.deepEqual(restored.checkpoint(), laptop.checkpoint());
assert.equal(restored.winner('note')?.type, 'DELETE');
const next = restored.set('after-restart', true);
assert.equal(next.sequence, 3);
assert.equal(next.logicalTimestamp, 3);
for (const operation of restored.missingOperations(phone.knownOperationIds()))
  phone.receive(operation);
assert.deepEqual(restored.history(), phone.history());
assert.equal(phone.get('note'), undefined);
log(
  'Restored identity and counters; tombstone survived; peer histories converged.',
);
