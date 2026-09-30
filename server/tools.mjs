import { readdir, readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export const definitions = [
  { type: 'function', function: { name: 'list_files', description: 'List the local workspace documents.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_file', description: 'Read a .md or .txt document from the local workspace.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'search_files', description: 'Find lines containing a phrase in local documents.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'calculate', description: 'Calculate a basic arithmetic expression.', parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } } },
  { type: 'function', function: { name: 'get_network_devices', description: 'Read the current Packet Tracer controller inventory and return discovered network devices, management IPs, interface counts, and reachability.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_network_health', description: 'Check the Packet Tracer lab health and summarize how many discovered devices are reachable.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_network_hosts', description: 'Read endpoint hosts discovered by the Packet Tracer controller, including IP, MAC, connected interface, VLAN-derived zone and trust classification.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_network_topology', description: 'Build a topology view from controller-discovered devices and hosts plus known lab backbone relationships.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_security_analysis', description: 'Run defensive lab security analysis using reachability, VLAN segmentation, and lab threat markers. This does not claim IDS certainty.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'write_file', description: 'Create or update one .md or .txt document in the local workspace. Requires user approval.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
];

export const isWrite = name => name === 'write_file';
export const toolNames = new Set(definitions.map(x => x.function.name));

export function safeName(name) {
  if (typeof name !== 'string' || !/^[\p{L}\p{N} _.-]{1,70}\.(md|txt)$/u.test(name) || name.startsWith('.')) throw new Error('只允许工作区内的 .md 或 .txt 文件名');
  return name;
}
async function target(root, name) {
  safeName(name);
  const base = await realpath(root);
  const full = path.join(base, name);
  try { if ((await lstat(full)).isSymbolicLink()) throw new Error('不允许符号链接'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return full;
}
export async function listFiles(root) {
  await mkdir(root, { recursive: true });
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter(x => x.isFile() && !x.isSymbolicLink() && (() => { try { safeName(x.name); return true; } catch { return false; } })()).map(x => x.name).sort().slice(0, 60);
}
export async function readDocument(root, name) {
  const file = await target(root, name);
  const value = await readFile(file, 'utf8');
  return value.slice(0, 18000);
}
export async function writeDocument(root, name, content) {
  if (typeof content !== 'string' || content.length > 4000) throw new Error('文件内容不能超过 4000 字');
  await mkdir(root, { recursive: true });
  const file = await target(root, name);
  await writeFile(file, content, { encoding: 'utf8', flag: 'w' });
  return `已保存 ${name}（${content.length} 字）`;
}
export function calculate(expression) {
  if (typeof expression !== 'string' || expression.length > 120 || !/^[\d\s.+*/()\-]+$/.test(expression)) throw new Error('只支持基础四则运算');
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+*/-]/g) || [];
  let i = 0;
  const factor = () => {
    if (tokens[i] === '-') { i++; return -factor(); }
    if (tokens[i] === '(') { i++; const n = sum(); if (tokens[i++] !== ')') throw new Error('括号不匹配'); return n; }
    const n = Number(tokens[i++]); if (!Number.isFinite(n)) throw new Error('表达式无效'); return n;
  };
  const product = () => { let n = factor(); while (tokens[i] === '*' || tokens[i] === '/') { const op = tokens[i++]; const x = factor(); n = op === '*' ? n * x : n / x; } return n; };
  const sum = () => { let n = product(); while (tokens[i] === '+' || tokens[i] === '-') { const op = tokens[i++]; const x = product(); n = op === '+' ? n + x : n - x; } return n; };
  const result = sum();
  if (i !== tokens.length || !Number.isFinite(result)) throw new Error('表达式无效');
  return String(Number(result.toPrecision(12)));
}
export async function executeTool(root, name, args, { networkClient } = {}) {
  if (!toolNames.has(name) || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('未知工具或参数');
  switch (name) {
    case 'list_files': return JSON.stringify(await listFiles(root));
    case 'read_file': return await readDocument(root, args.path);
    case 'search_files': {
      const q = String(args.query || '').trim().slice(0, 100).toLowerCase();
      if (q.length < 2) throw new Error('搜索词至少 2 字');
      const results = [];
      for (const name of await listFiles(root)) {
        const lines = (await readDocument(root, name)).split('\n');
        lines.forEach((line, index) => { if (line.toLowerCase().includes(q) && results.length < 20) results.push({ file: name, line: index + 1, text: line.slice(0, 180) }); });
      }
      return JSON.stringify(results);
    }
    case 'calculate': return calculate(args.expression);
    case 'get_network_devices':
      if (!networkClient) throw new Error('Packet Tracer integration is unavailable');
      return JSON.stringify(await networkClient.getNetworkDevices());
    case 'get_network_health':
      if (!networkClient) throw new Error('Packet Tracer integration is unavailable');
      return JSON.stringify(await networkClient.getNetworkHealth());
    case 'get_network_hosts':
      if (!networkClient) throw new Error('Packet Tracer integration is unavailable');
      return JSON.stringify(await networkClient.getHosts());
    case 'get_network_topology':
      if (!networkClient) throw new Error('Packet Tracer integration is unavailable');
      return JSON.stringify(await networkClient.getTopology());
    case 'get_security_analysis':
      if (!networkClient) throw new Error('Packet Tracer integration is unavailable');
      return JSON.stringify(await networkClient.getSecurityAnalysis());
    case 'write_file': return await writeDocument(root, args.path, args.content);
  }
}
