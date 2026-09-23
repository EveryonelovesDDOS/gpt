import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from './index.mjs';

let server; let base;
before(async () => {
  process.env.OPENAI_API_KEY ||= 'test-key';
  server = createServer(async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.store, false);
    assert.equal(request.text.format.type, 'json_schema');
    return { ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify({ title: '完成报告', summary: '先列出轮廓', category: '工作', minutes: 25, steps: ['打开文档', '列出三点'] }) }] }] }) };
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
test('rejects short input', async () => {
  const r = await fetch(`${base}/plan`, { method: 'POST', body: JSON.stringify({ text: 'abc' }) });
  assert.equal(r.status, 400);
});
test('produces validated plan with no stored AI response', async () => {
  const r = await fetch(`${base}/plan`, { method: 'POST', body: JSON.stringify({ text: '下周要完成工作报告' }) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).steps.length, 2);
});
