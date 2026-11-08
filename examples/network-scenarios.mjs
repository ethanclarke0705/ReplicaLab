import assert from 'node:assert/strict';
import { log } from 'node:console';
import {
  runScenario,
  scenarioNames,
} from '../packages/simulator/dist/index.js';

for (const name of scenarioNames) {
  const { simulation, replicas } = runScenario(name, 2026);
  assert.equal(simulation.converged, true);
  for (const replica of replicas)
    assert.deepEqual(replica.history(), replicas[0].history());
  const events = simulation.events();
  log(
    `${name}: converged=${simulation.converged}; elapsed=${simulation.now} simulated ms; ${events.filter((event) => event.type === 'delivered').length} delivered, ${events.filter((event) => event.type === 'dropped').length} dropped`,
  );
}
