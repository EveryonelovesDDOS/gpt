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


test('network health questions produce a substantive evidence-based answer even when model final is generic', async () => {
  const networkClient = {
    async getNetworkHealth() {
      return { controllerOnline:true, deviceCount:2, reachableCount:2, unreachableCount:0, allReachable:true, hostCount:6, securityPosture:'critical', alertCount:2, devices:[] };
    },
    async getSecurityAnalysis() {
      return { posture:'critical', alertCount:2, criticalCount:1, highCount:1, hostCount:6, alerts:[{ id:'lab', detail:'Simulation marker only.' }] };
    },
  };
  const fetcher = async () => ({ ok:true, status:200, json:async()=>({ message:{ role:'assistant', content:'任务已完成。' } }) });
  const agent = createAgent({ root, model:'mock', fetcher, networkClient });
  const run = agent.start('Is my network healthy?');
  const done = await wait(() => {
    const current = agent.get(run.id);
    return current.status === 'completed' ? current : null;
  });
  assert.match(done.answer, /OBSERVED/);
  assert.match(done.answer, /2\/2/);
  assert.match(done.answer, /critical/i);
  assert.equal(done.evidence.length >= 2, true);
  assert.equal(done.events.some(event => event.detail.includes('{"')), false);
});


test('graph questions preload the matching digital-twin tool and emit operator action cards', async () => {
  const digitalTwin = {
    async build() {
      return {
        nodes:[
          { id:'attack', label:'ATTACKER-PC', zone:'GUEST', labThreatMarker:true },
          { id:'core', label:'CORE-SW', zone:'CORE' },
          { id:'server', label:'SERVER', zone:'SERVER', critical:true },
        ],
        links:[
          { id:'a', source:'attack', target:'core', certainty:'observed' },
          { id:'b', source:'core', target:'server', certainty:'observed' },
        ],
        zones:[{id:'guest',name:'GUEST'}],
        confidence:{ policyEnforcement:'not-verified' },
      };
    },
    async path(source,target) {
      return {
        found:true,
        source,
        target,
        relationshipPath:true,
        reachability:'not-verified',
        certainty:'observed',
        hops:[
          { node:{label:'ATTACKER-PC'} },
          { node:{label:'CORE-SW'} },
          { node:{label:'SERVER'} },
        ],
        generatedAt:new Date().toISOString(),
      };
    },
  };
  const networkClient = {};
  const fetcher = async () => ({ ok:true, status:200, json:async()=>({ message:{ role:'assistant', content:'任务已完成。' } }) });
  const agent = createAgent({ root, model:'mock', fetcher, networkClient, digitalTwin });
  const run = agent.start('Can ATTACKER-PC reach SERVER?');
  const done = await wait(() => {
    const current = agent.get(run.id);
    return current.status === 'completed' ? current : null;
  });
  assert.match(done.answer, /Relationship path/i);
  assert.match(done.answer, /not-verified/i);
  assert.equal(done.evidence.some(item => item.tool === 'analyze_network_path'), true);
  assert.equal(done.actions.some(item => item.type === 'show-path'), true);
});
