import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectDemo } from '../demo-files.mjs';

test('static verification rejects root-only links, missing assets and accidental private artifacts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'replicalab-demo-'));
  try {
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'assets/app.js'), 'export {};');
    await writeFile(join(dir, 'assets/app.css'), 'body {}');
    const page = (js) =>
      `<script type="module" src="${js}"></script><link href="./assets/app.css">`;
    await writeFile(join(dir, 'index.html'), page('./assets/app.js'));
    assert.equal((await inspectDemo(dir)).length, 3);
    await writeFile(join(dir, 'index.html'), page('/assets/app.js'));
    await assert.rejects(inspectDemo(dir), /must be relative/);
    await writeFile(join(dir, 'index.html'), page('./assets/missing.js'));
    await assert.rejects(inspectDemo(dir), /Missing asset/);
    await writeFile(join(dir, 'index.html'), page('../app.js'));
    await assert.rejects(inspectDemo(dir), /must be relative/);
    await writeFile(join(dir, '.env'), 'EXAMPLE=value');
    await assert.rejects(inspectDemo(dir), /Unexpected public artifact/);
  } finally {
    // The path is created by mkdtemp inside the system temp directory above.
    assert(dir.startsWith(join(tmpdir(), 'replicalab-demo-')));
    await rm(dir, { recursive: true, force: true });
  }
});
