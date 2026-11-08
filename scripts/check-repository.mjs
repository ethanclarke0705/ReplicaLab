import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { log } from 'node:console';
import process from 'node:process';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) =>
  execFileSync('git', args, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const tracked = git('ls-files', '-z').toString().split('\0').filter(Boolean);
const failures = [];
const forbiddenPath =
  /(?:^|\/)(?:node_modules|dist|output|\.aws|\.ssh)(?:\/|$)|(?:^|\/)\.env(?:$|\.(?!example$))|\.(?:pem|p12|pfx|key)$/i;
const signatures = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  [
    'GitHub token',
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/,
  ],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['API token', /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/],
  ['credential URL', /https?:\/\/[^\s/:]+:[^\s/@]+@/],
];
function scan(label, bytes) {
  if (bytes.includes(0)) return; // Binary images are reviewed visually.
  const text = bytes.toString('utf8');
  for (const [name, expression] of signatures) {
    if (expression.test(text))
      failures.push(`${label}: possible ${name} (value redacted)`);
  }
}
for (const path of tracked) {
  if (forbiddenPath.test(path))
    failures.push(`${path}: private or generated path tracked`);
  const bytes = await readFile(resolve(root, path));
  scan(path, bytes);
  if (path.endsWith('.md')) {
    const text = bytes.toString();
    for (const match of text.matchAll(
      /!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g,
    )) {
      const target = match[1];
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const local = decodeURIComponent(target.split('#')[0]);
      const destination = resolve(root, dirname(path), local);
      if (relative(root, destination).startsWith('..'))
        failures.push(`${path}: link outside repository`);
      else {
        try {
          await stat(destination);
        } catch {
          failures.push(`${path}: broken link ${target}`);
        }
      }
    }
  }
}
let blobs = 0;
if (process.argv.includes('--history')) {
  const objects = git('rev-list', '--objects', '--all')
    .toString()
    .trim()
    .split('\n');
  for (const line of objects) {
    const [id, ...parts] = line.split(' ');
    const path = parts.join(' ');
    if (path && forbiddenPath.test(path))
      failures.push(`${id}: private or generated historical path ${path}`);
    if (git('cat-file', '-t', id).toString().trim() !== 'blob') continue;
    scan(`history blob ${id}`, git('cat-file', 'blob', id));
    blobs++;
  }
}
assert.equal(failures.length, 0, failures.join('\n'));
log(
  `Checked ${tracked.length} tracked files, local Markdown links and ${blobs} historical blobs; no configured credential signatures found.`,
);
log(
  'This bounded signature scan is not a guarantee that every possible secret is absent.',
);
