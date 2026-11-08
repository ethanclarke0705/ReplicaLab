import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

/** Check the exact static artifact, including project-subpath asset resolution. */
export async function inspectDemo(directory) {
  const root = resolve(directory);
  const files = [];
  async function walk(folder) {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const path = resolve(folder, entry.name);
      assert(!entry.isSymbolicLink(), 'Demo must not contain symbolic links');
      if (entry.isDirectory()) await walk(path);
      else {
        const name = relative(root, path).split(sep).join('/');
        assert(
          /\.(?:html|js|css|svg|png|jpe?g|webp|ico|txt|woff2?)$/.test(name),
          `Unexpected public artifact: ${name}`,
        );
        const bytes = await readFile(path);
        files.push({
          path: name,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
    }
  }
  await walk(root);
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  assert(html.includes('type="module"'), 'Missing browser module entry');
  const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert(
    references.some((ref) => ref.endsWith('.js')),
    'Missing JavaScript asset',
  );
  assert(
    references.some((ref) => ref.endsWith('.css')),
    'Missing stylesheet',
  );
  for (const ref of references) {
    assert(ref.startsWith('./'), `Demo assets must be relative: ${ref}`);
    for (const base of [
      'https://demo.invalid/',
      'https://demo.invalid/ReplicaLab/',
    ]) {
      const url = new URL(ref, base);
      assert(
        url.href.startsWith(base),
        `Asset escapes deployment path: ${ref}`,
      );
      const name = decodeURIComponent(
        url.pathname.slice(new URL(base).pathname.length),
      );
      assert(
        files.some((file) => file.path === name),
        `Missing asset: ${name}`,
      );
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
