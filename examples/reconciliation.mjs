import assert from 'node:assert/strict';
import { log } from 'node:console';
import { Replica } from '../packages/core/dist/index.js';

const laptop = new Replica('laptop');
const phone = new Replica('phone');
laptop.set('title', 'Laptop draft');
phone.set('title', 'Phone draft');
laptop.set('obsolete', true);
laptop.delete('obsolete');
log('Before exchange:', [...laptop.state()], [...phone.state()]);

for (const operation of laptop.missingOperations(phone.knownOperationIds())) {
  phone.receive(operation);
}
for (const operation of phone.missingOperations(laptop.knownOperationIds())) {
  laptop.receive(operation);
}

assert.deepEqual(laptop.state(), phone.state());
assert.deepEqual(laptop.history(), phone.history());
assert.equal(laptop.get('title'), 'Phone draft');
assert.equal(phone.winner('obsolete')?.type, 'DELETE');
log('After exchange:', [...laptop.state()]);
log('Retained operations:', laptop.operationCount);
