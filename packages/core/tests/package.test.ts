import { expect, test } from 'vitest';
import * as core from '../src/index.js';

test('core can be imported in a headless Node environment', () => {
  expect(core).toBeDefined();
});
