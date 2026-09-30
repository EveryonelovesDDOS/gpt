import { randomUUID } from 'node:crypto';
import { definitions, executeTool, isWrite, safeName, toolNames } from './tools.mjs';

const system = `You are NEXUS, a local-first AI network operations agent. Reply in the user's language. You can inspect local workspace documents, calculate, and query the connected Cisco Packet Tracer controller for devices, hosts, topology, health, and defensive security analysis. Use network tools instead of guessing. Never claim a tool ran unless it did. Treat controller output as observations and NEXUS heuristics as heuristics, not proof of compromise. Do not invent VLAN, ACL, routing, interface, or host facts that tools do not expose. File writes require explicit approval. For network analysis, prefer a compact operator format: OBSERVED (facts returned by tools), INFERRED (clearly labeled reasoning), RISK, NEXT CHECKS, and CONFIDENCE. For security incidents, state explicitly when a signal is only a lab marker. Never imply that a configuration change was executed unless an execution tool actually reports success. Keep answers operational and evidence-based.`;
const limit = 8;
const note = (run, kind, title, detail = '') => run.events.push({ id: randomUUID(), kind, title, detail: String(detail).slice(0, 650), at: new Date().toISOString() });

export function createAgent({ root, model, ollama = 'http://127.0.0.1:11434', fetcher = fetch, networkClient = null }) {
  const runs = new Map();
  let activeModel = model;
  async function availableModels(signal) {
    try {
      const response = await fetcher(`${ollama}/api/tags`, { signal: AbortSignal.any([signal, AbortSignal.timeout(3500)]) });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload?.models) ? payload.models.map(x => x.name || x.model).filter(Boolean) : [];
    } catch { return []; }
  }
  async function requestChat(messages, signal, selectedModel) {
    return fetcher(`${ollama}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.any([signal, AbortSignal.timeout(90_000)]),
      body: JSON.stringify({ model: selectedModel, messages, tools: definitions, stream: false, options: { num_predict: 1200 } }),
    });
  }
  async function chat(messages, signal) {
    let response;
    try {
      response = await requestChat(messages, signal, activeModel);
      if (response.status === 404) {
        const installed = await availableModels(signal);
        const fallback = installed.find(x => x !== activeModel) || installed[0];
        if (!fallback) throw new Error('Ollama 已启动，但没有安装任何模型。请先运行 ollama pull qwen3:4b，或在 Settings 选择已安装模型。');
        activeModel = fallback;
        response = await requestChat(messages, signal, activeModel);
      }
    } catch (e) {
      if (signal.aborted) throw e;
      if (e instanceof Error && e.message.startsWith('Ollama 已启动')) throw e;
      throw new Error(e.name === 'TimeoutError' ? '本地模型响应超时' : '无法连接 Ollama，请检查它是否已启动');
    }
    if (!response.ok) {
      const installed = await availableModels(signal);
      throw new Error(`Ollama 返回 ${response.status}。当前模型：${activeModel}。已安装模型：${installed.join(', ') || 'none'}`);
    }
    const payload = await response.json();
    if (!payload?.message || payload.message.role !== 'assistant') throw new Error('模型响应无效');
    return payload.message;
  }
  async function proceed(run, messages, steps = 0) {
    try {
      while (steps < limit && !run.cancelled) {
        run.status = 'thinking';
        note(run, 'thinking', steps ? '整理工具结果' : '理解你的目标');
        const message = await chat(messages, run.controller.signal);
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls.slice(0, 1) : [];
        messages.push(calls.length ? { ...message, tool_calls: calls } : message);
        if (!calls.length) {
          run.answer = String(message.content || '任务已完成。').slice(0, 10000);
          run.status = 'completed'; note(run, 'final', '任务完成', run.answer); return;
        }
        for (const call of calls) {
          if (run.cancelled) return;
          const name = call?.function?.name;
          const args = call?.function?.arguments;
          if (!toolNames.has(name) || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('模型请求了未知工具');
          if (name === 'write_file') {
            safeName(args.path);
            if (typeof args.content !== 'string' || args.content.length > 4000) throw new Error('待写入内容过长');
          }
          const networkTool = ['get_network_devices','get_network_health','get_network_hosts','get_network_topology','get_security_analysis'].includes(name);
          note(run, 'tool', name, networkTool ? '读取 Packet Tracer Controller' : name === 'write_file' ? `准备写入 ${args.path}` : JSON.stringify(args).slice(0, 140));
          if (isWrite(name)) {
            run.pending = { name, args, preview: args.content };
            run.status = 'approval';
            note(run, 'approval', '等待你批准写入', args.path);
            run.resume = async approved => {
              if (run.cancelled) return;
              try {
                run.pending = null;
                const result = approved ? await executeTool(root, name, args, { networkClient }) : '用户拒绝写入；请继续提供不修改文件的答复。';
                note(run, approved ? 'success' : 'denied', approved ? '文件已保存' : '已拒绝写入', approved ? args.path : '');
                messages.push({ role: 'tool', tool_name: name, content: result });
                await proceed(run, messages, steps + 1);
              } catch (e) {
                run.status = 'failed'; run.error = e.message; note(run, 'error', '写入失败', e.message);
              }
            };
            return;
          }
          let result;
          try { result = await executeTool(root, name, args, { networkClient }); }
          catch (e) { result = `工具错误：${e.message}`; }
          note(run, 'success', `${name} 已完成`, result);
          messages.push({ role: 'tool', tool_name: name, content: result });
        }
        steps++;
      }
      if (run.cancelled) return;
      run.answer = '已达到本次任务的工具步骤上限。你可以继续提出更具体的请求。';
      run.status = 'completed'; note(run, 'final', '已停止自动执行', run.answer);
    } catch (e) {
      if (run.cancelled) return;
      run.status = 'failed';
      run.error = e.name === 'AbortError' ? '模型请求超时或已取消' : e.message;
      note(run, 'error', '执行中断', run.error);
    }
  }
  function start(prompt) {
    if (typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.length > 2000) throw new Error('请输入 3 至 2000 个字符');
    for (const [id, run] of runs) if (Date.now() - run.created > 86_400_000) runs.delete(id);
    if ([...runs.values()].filter(x => ['thinking', 'approval'].includes(x.status)).length >= 2) throw new Error('最多同时执行 2 项任务');
    const run = { id: randomUUID(), prompt: prompt.trim(), created: Date.now(), status: 'thinking', events: [], answer: '', pending: null, cancelled: false, controller: new AbortController() };
    runs.set(run.id, run);
    void proceed(run, [{ role: 'system', content: system }, { role: 'user', content: run.prompt }]);
    return publicRun(run);
  }
  function publicRun(run) {
    if (!run) return null;
    return { id: run.id, prompt: run.prompt, status: run.status, events: run.events, answer: run.answer, error: run.error, pending: run.pending ? { name: run.pending.name, path: run.pending.args.path, preview: run.pending.preview } : null };
  }
  return {
    start, get: id => publicRun(runs.get(id)), getActiveModel: () => activeModel,
    decide(id, approved) {
      const run = runs.get(id);
      if (!run || run.status !== 'approval' || !run.resume) throw new Error('没有待审批操作');
      const resume = run.resume;
      run.status = 'resuming'; run.resume = null;
      void resume(approved);
      return publicRun(run);
    },
    cancel(id) {
      const run = runs.get(id);
      if (!run) throw new Error('找不到任务');
      run.cancelled = true; run.controller.abort(); run.pending = null; run.resume = null; run.status = 'cancelled';
      note(run, 'denied', '任务已停止');
      return publicRun(run);
    },
  };
}
