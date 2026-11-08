import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { URL } from 'node:url';

const fromApp = createRequire(
  new URL('../apps/playground/package.json', import.meta.url),
);
const reactDom = fromApp.resolve('react-dom/package.json');
const fromReactDom = createRequire(reactDom);
const packages = [
  fromApp.resolve('react/package.json'),
  reactDom,
  fromReactDom.resolve('scheduler/package.json'),
];
const sections = [
  'ReplicaLab\n\n' +
    (await readFile(new URL('../LICENSE', import.meta.url), 'utf8')),
];
for (const path of packages) {
  const metadata = JSON.parse(await readFile(path, 'utf8'));
  const license = await readFile(join(dirname(path), 'LICENSE'), 'utf8');
  sections.push(
    `${metadata.name} ${metadata.version}\nhttps://github.com/facebook/react\n\n${license}`,
  );
}
await writeFile(
  new URL('../apps/playground/dist/NOTICE.txt', import.meta.url),
  sections.join('\n---\n\n'),
);
