import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAgent } from './agent.mjs';
import { calculate, safeName } from './tools.mjs';
import { createServer } from './index.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'nova-test-'));
after(() => rm(root, { recursive: true, force: true }));
const wait = async (fn) => {
  for (let i = 0; i < 100; i++) {
    const result = fn();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  throw new Error('Timed out');
};
test('safe arithmetic and workspace names', () => {
  assert.equal(calculate('(8+4)*3/2'), '18');
  assert.throws(() => calculate('process.exit()'));
  assert.throws(() => safeName('../secret.md'));
  assert.throws(() => safeName('.env'));
});
test('agent calls tools and pauses before a write', async () => {
  let calls = 0;
  const fetcher = async (_, options) => {
    const req = JSON.parse(options.body);
    assert.equal(req.stream, false);
    const message = calls++ === 0
      ? { role: 'assistant', content: '', tool_calls: [{ function: { name: 'write_file', arguments: { path: 'brief.md', content: '# Brief\nDone.' } } }] }
      : { role: 'assistant', content: '已完成文档。' };
    return { ok: true, json: async () => ({ message }) };
  };
  const agent = createAgent({ root, model: 'mock', fetcher });
  const run = agent.start('写一份简报');
  await wait(() => agent.get(run.id).status === 'approval');
  await assert.rejects(() => readFile(path.join(root, 'brief.md')));
  agent.decide(run.id, true);
  await wait(() => agent.get(run.id).status === 'completed');
  assert.equal(await readFile(path.join(root, 'brief.md'), 'utf8'), '# Brief\nDone.');
  assert.equal(calls, 2);
});
test('HTTP interface rejects requests without pairing token', async () => {
  const { server } = createServer({ projectRoot: root, token: 'test-secret', fetcher: async () => { throw new Error('offline'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${base}/api/files`);
    assert.equal(response.status, 401);
    const accepted = await fetch(`${base}/api/files`, { headers: { Authorization: 'Bearer test-secret' } });
    assert.equal(accepted.status, 200);
  } finally { server.close(); }
});
