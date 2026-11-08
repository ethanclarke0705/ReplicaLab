import { log } from 'node:console';
import { inspectDemo } from './demo-files.mjs';
import { fileURLToPath, URL } from 'node:url';

const files = await inspectDemo(
  fileURLToPath(new URL('../apps/playground/dist/', import.meta.url)),
);
log(`Verified ${files.length} static files for root and /ReplicaLab/ hosting.`);
for (const file of files)
  log(`${file.sha256}  ${file.path} (${file.bytes} bytes)`);
