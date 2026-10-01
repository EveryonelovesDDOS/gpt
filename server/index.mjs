import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgent } from './agent.mjs';
import { createPacketTracerClient } from './packetTracer.mjs';
import { createIncidentManager } from './incidents.mjs';
import { createTelemetryManager } from './telemetry.mjs';
import { listFiles, readDocument } from './tools.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDefault = path.resolve(here, '..');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json' };
function localOrigin(origin) {
  try {
    const u = new URL(origin);
    const h = u.hostname;
    return u.protocol === 'http:' && (['localhost', '127.0.0.1'].includes(h) || /^192\.168\.\d+\.\d+$/.test(h) || /^10\.\d+\.\d+\.\d+$/.test(h) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(h));
  } catch { return false; }
}
const json = (res, code, payload, origin) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) });
  res.end(JSON.stringify(payload));
};
async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 16000) throw new Error('请求太长');
  }
  return JSON.parse(data || '{}');
}
export function createServer({
  projectRoot = rootDefault, token = process.env.NOVA_PAIR_TOKEN || randomBytes(12).toString('hex'),
  model = process.env.OLLAMA_MODEL || 'qwen3:4b', ollama = process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  fetcher = fetch,
} = {}) {
  const workspace = path.join(projectRoot, 'data', 'workspace');
  const dist = path.join(projectRoot, 'dist');
  const networkClient = createPacketTracerClient({ fetcher });
  const agent = createAgent({ root: workspace, model, ollama, fetcher, networkClient });
  const incidents = createIncidentManager({ networkClient });
  const telemetry = createTelemetryManager({ networkClient });
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !localOrigin(origin)) return json(res, 403, { error: '此来源不允许访问本地服务' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': origin || '', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }); return res.end();
    }
    const url = new URL(req.url, 'http://local');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, origin);
      let file;
      try {
        file = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(dist + path.sep) && file !== dist) throw new Error('Invalid path');
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        const bytes = await readFile(file);
        res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) });
        return res.end(bytes);
      } catch { return json(res, 404, { error: '先运行 npm run build:web 生成电脑页面' }, origin); }
    }
    if (url.pathname === '/api/health' && req.method === 'GET') {
      let modelReady = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);
        try {
          const response = await fetcher(`${ollama}/api/tags`, { signal: controller.signal });
          if (response.ok) { const payload = await response.json(); const installed = payload.models?.map(x => x.name || x.model).filter(Boolean) || []; modelReady = installed.includes(agent.getActiveModel()) || installed.length > 0; }
        } finally { clearTimeout(timeout); }
      } catch { /* Ollama is optional until installed. */ }
      return json(res, 200, { online: true, model: agent.getActiveModel(), requestedModel: model, modelReady }, origin);
    }
    const supplied = req.headers.authorization?.replace(/^Bearer /i, '');
    if (supplied !== token) return json(res, 401, { error: '配对码无效' }, origin);
    try {
      if (url.pathname === '/api/network/devices' && req.method === 'GET') return json(res, 200, { devices: await networkClient.getNetworkDevices() }, origin);
      if (url.pathname === '/api/network/health' && req.method === 'GET') return json(res, 200, await networkClient.getNetworkHealth(), origin);
      if (url.pathname === '/api/network/hosts' && req.method === 'GET') return json(res, 200, { hosts: await networkClient.getHosts() }, origin);
      if (url.pathname === '/api/network/topology' && req.method === 'GET') return json(res, 200, await networkClient.getTopology(), origin);
      if (url.pathname === '/api/network/security' && req.method === 'GET') return json(res, 200, await networkClient.getSecurityAnalysis(), origin);
      if (url.pathname === '/api/incidents' && req.method === 'GET') return json(res, 200, await incidents.getTimeline(), origin);
      if (url.pathname === '/api/incidents/cases' && req.method === 'GET') return json(res, 200, { cases: incidents.listCases() }, origin);
      const openIncidentMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/open$/);
      if (openIncidentMatch && req.method === 'POST') return json(res, 201, await incidents.openCase(decodeURIComponent(openIncidentMatch[1])), origin);
      const incidentCaseMatch = url.pathname.match(/^\/api\/incidents\/cases\/([\da-f-]+)(?:\/(close))?$/);
      if (incidentCaseMatch) {
        const [, id, action] = incidentCaseMatch;
        if (!action && req.method === 'GET') {
          const incidentCase = incidents.getCase(id);
          return json(res, incidentCase ? 200 : 404, incidentCase || { error:'Incident case not found' }, origin);
        }
        if (action === 'close' && req.method === 'POST') return json(res, 200, incidents.closeCase(id), origin);
      }
      if (url.pathname === '/api/network/changes' && req.method === 'GET') return json(res, 200, await telemetry.sample(), origin);
      if (url.pathname === '/api/actions' && req.method === 'GET') return json(res, 200, { proposals: incidents.listProposals() }, origin);
      if (url.pathname === '/api/actions/propose' && req.method === 'POST') {
        const { kind, incidentCaseId } = await body(req);
        return json(res, 201, await incidents.propose(kind, incidentCaseId || ''), origin);
      }
      const actionMatch = url.pathname.match(/^\/api\/actions\/([\da-f-]+)\/decision$/);
      if (actionMatch && req.method === 'POST') { const { approved } = await body(req); if (typeof approved !== 'boolean') throw new Error('Approval must be boolean'); return json(res, 200, incidents.decide(actionMatch[1], approved), origin); }
      if (url.pathname === '/api/files' && req.method === 'GET') {
        const files = await listFiles(workspace); return json(res, 200, { files }, origin);
      }
      if (url.pathname.startsWith('/api/files/') && req.method === 'GET') {
        const name = decodeURIComponent(url.pathname.slice('/api/files/'.length));
        return json(res, 200, { name, content: await readDocument(workspace, name) }, origin);
      }
      if (url.pathname === '/api/runs' && req.method === 'POST') {
        const { prompt } = await body(req);
        return json(res, 202, agent.start(prompt), origin);
      }
      const match = url.pathname.match(/^\/api\/runs\/([\da-f-]+)(?:\/(decision|cancel))?$/);
      if (match) {
        const [, id, action] = match;
        if (!action && req.method === 'GET') {
          const run = agent.get(id); return json(res, run ? 200 : 404, run || { error: '找不到任务' }, origin);
        }
        if (action === 'decision' && req.method === 'POST') {
          const { approved } = await body(req);
          if (typeof approved !== 'boolean') throw new Error('审批结果无效');
          return json(res, 200, agent.decide(id, approved), origin);
        }
        if (action === 'cancel' && req.method === 'POST') return json(res, 200, agent.cancel(id), origin);
      }
      return json(res, 404, { error: '找不到接口' }, origin);
    } catch (e) { return json(res, 400, { error: e instanceof Error ? e.message : '请求失败' }, origin); }
  });
  return { server, token, model, workspace };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, token, model, workspace } = createServer();
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 8787);
  await mkdir(workspace, { recursive: true });
  server.listen(port, host, () => {
    console.log(`NEXUS running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    console.log(`Local model: ${model} | Pairing code: ${token}`);
    if (host === '0.0.0.0') console.log('Phone: open http://<your-computer-LAN-IP>:8787 on the same Wi-Fi; use the pairing code above.');
  });
}
