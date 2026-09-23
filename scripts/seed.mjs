import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'examples', 'workspace');
const to = path.join(root, 'data', 'workspace');
await mkdir(to, { recursive: true });
for (const name of await readdir(from)) {
  try { await stat(path.join(to, name)); console.log(`Skipped existing ${name}`); }
  catch { await cp(path.join(from, name), path.join(to, name)); console.log(`Added ${name}`); }
}
