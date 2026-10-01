import { randomUUID } from 'node:crypto';
import { definitions, executeTool, isWrite, safeName, toolNames } from './tools.mjs';

const system = `You are NEXUS, a local-first AI network operations agent. Reply in the user's language. You can inspect local workspace documents, calculate, and query the connected Cisco Packet Tracer controller for devices, hosts, topology, health, and defensive security analysis.

NETWORK RULES
- Use live network observations instead of guessing.
- Never claim a tool ran unless it did.
- Treat controller output as observations and NEXUS heuristics as heuristics, not proof of compromise.
- Never invent VLAN, ACL, routing, interface, reachability, attack-path, or host facts that tools do not expose.
- A host named ATTACKER-PC is a lab simulation marker, not proof of malicious activity.
- Never imply a configuration change was executed unless an execution tool reports success.
- File writes require explicit approval.

ANSWER FORMAT
For network questions, always give a substantive final answer after using tools. Never finish with only "task completed" or an equivalent status sentence.
Prefer this compact mobile-friendly structure:
OBSERVED
Concrete facts from tools.

INFERRED
Reasoning that follows from the facts. Say "Not enough evidence" when appropriate.

RISK
What deserves attention, without overstating certainty.

NEXT CHECKS
A short numbered list of the next 1-4 checks.

CONFIDENCE
High / Medium / Low, with one short reason.

Keep the response concise. Do not dump raw JSON into the final answer.`;

const limit = 8;
const note = (run, kind, title, detail = '') => run.events.push({ id: randomUUID(), kind, title, detail: String(detail).slice(0, 650), at: new Date().toISOString() });

function parseResult(result) {
  try { return JSON.parse(result); } catch { return result; }
}

function summarizeTool(name, result) {
  const data = parseResult(result);
  try {
    if (name === 'get_network_health') {
      return `${data.reachableCount}/${data.deviceCount} infrastructure devices reachable; ${data.alertCount ?? 0} security signals; posture ${data.securityPosture || 'unknown'}.`;
    }
    if (name === 'get_network_devices') {
      const devices = Array.isArray(data) ? data : [];
      return `${devices.length} devices: ${devices.map(d => `${d.name} (${d.managementIp || 'no IP'}, ${d.status})`).join(', ')}.`;
    }
    if (name === 'get_network_hosts') {
      const hosts = Array.isArray(data) ? data : [];
      return `${hosts.length} hosts observed${hosts.length ? ': ' + hosts.map(h => `${h.name} ${h.ip || ''} ${h.zone || ''}`).join(', ') : ''}.`;
    }
    if (name === 'get_network_topology') {
      return `${data.nodes?.length || 0} topology nodes and ${data.links?.length || 0} links assembled; physical topology endpoint ${data.physicalAvailable ? 'available' : 'not exposed'}.`;
    }
    if (name === 'get_security_analysis') {
      return `Posture ${data.posture}; ${data.alertCount || 0} alerts (${data.criticalCount || 0} critical, ${data.highCount || 0} high).`;
    }
    if (name === 'list_files') return `${Array.isArray(data) ? data.length : 0} workspace documents found.`;
    if (name === 'search_files') return `${Array.isArray(data) ? data.length : 0} matching lines found.`;
    if (name === 'read_file') return 'Workspace document read successfully.';
    if (name === 'calculate') return `Calculation result: ${String(result).slice(0,120)}`;
    if (name === 'write_file') return String(result).slice(0,180);
  } catch {}
  return 'Tool completed successfully.';
}

function preloadTools(prompt) {
  const p = prompt.toLowerCase();
  if (/health|healthy|status|健康|状态/.test(p)) return ['get_network_health','get_security_analysis'];
  if (/attacker|intruder|guest|where is|位于|攻击/.test(p)) return ['get_network_hosts','get_security_analysis'];
  if (/device|inventory|discovered|设备|清单/.test(p)) return ['get_network_devices'];
  if (/alert|security|risk|threat|安全|风险|告警/.test(p)) return ['get_security_analysis','get_network_topology'];
  if (/topology|fabric|vlan|segment|reach|path|拓扑|网络|路径/.test(p)) return ['get_network_topology','get_security_analysis'];
  return [];
}

function isGenericFinal(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const compact = text.replace(/[\s。.!！]/g,'').toLowerCase();
  return compact === '任务已完成' || compact === '任务完成' || compact === 'taskcompleted' || compact === 'completed' || compact === 'done';
}

function formatList(items) {
  return items.filter(Boolean).join('\n');
}

function synthesizeFinal(prompt, context) {
  const p = prompt.toLowerCase();
  const health = context.get_network_health;
  const security = context.get_security_analysis;
  const hosts = context.get_network_hosts;
  const devices = context.get_network_devices;
  const topology = context.get_network_topology;

  if (health && /health|healthy|status|健康|状态/.test(p)) {
    const stable = health.allReachable;
    const posture = security?.posture || health.securityPosture || 'unknown';
    return `OBSERVED
- ${health.reachableCount}/${health.deviceCount} infrastructure devices are reachable.
- ${health.hostCount ?? security?.hostCount ?? 'Unknown'} hosts are observed.
- NEXUS security posture is ${posture} with ${security?.alertCount ?? health.alertCount ?? 0} active signal(s).

INFERRED
The infrastructure is ${stable ? 'reachable and operational' : 'not fully reachable'}. ${posture === 'normal' ? 'No current NEXUS heuristic requires urgent security attention.' : 'Reachability is stable, but the security posture still requires review.'}

RISK
${security?.criticalCount ? `${security.criticalCount} critical signal(s) require investigation.` : security?.highCount ? `${security.highCount} high-severity signal(s) require review.` : 'No critical NEXUS signal is currently present.'}

NEXT CHECKS
1. Review the active security signals.
2. Verify segmentation for any guest or untrusted endpoint.
3. Confirm protected services remain isolated as intended.

CONFIDENCE
High — based on live controller reachability and the current NEXUS security analysis.`;
  }

  const allHosts = Array.isArray(hosts) ? hosts : [];
  const attacker = allHosts.find(h => h.labThreatMarker || /ATTACKER/i.test(h.name || ''));
  if (attacker && /attacker|intruder|where is|攻击|位于/.test(p)) {
    const matchingAlerts = (security?.alerts || []).filter(a => a.evidence?.host === attacker.name);
    return `OBSERVED
- ${attacker.name} is ${attacker.ip || 'at an unknown IP'}.
- Zone: ${attacker.zone || 'UNKNOWN'}${attacker.vlan ? ` · VLAN ${attacker.vlan}` : ''}.
- Trust classification: ${attacker.trust || 'unknown'}.
- Connected interface: ${attacker.connectedInterface || 'not exposed by the controller'}.
- ${matchingAlerts.length} NEXUS security signal(s) currently reference this host.

INFERRED
The host is positioned in the ${attacker.zone || 'unknown'} segment. Its lab threat-marker name is a simulation signal only; malicious activity is not established.

RISK
${attacker.zone === 'GUEST' ? 'An untrusted guest-zone endpoint should be checked for isolation from protected server and management zones.' : 'Review the endpoint against the intended trust policy.'}

NEXT CHECKS
1. Verify VLAN and port assignment.
2. Confirm ACL isolation from SERVER and MANAGEMENT zones.
3. Review the active security signals before considering containment.

CONFIDENCE
High — the location and classification come from current host inventory and NEXUS policy mapping.`;
  }

  if (Array.isArray(devices) && /device|inventory|discovered|设备|清单/.test(p)) {
    return `OBSERVED
${formatList(devices.map(d => `- ${d.name}: ${d.managementIp || 'no management IP'} · ${d.status} · ${d.interfaces} interfaces`))}

INFERRED
${devices.every(d => d.status === 'online') ? 'All discovered infrastructure devices are currently reachable.' : 'At least one discovered infrastructure device is not currently reachable.'}

RISK
Inventory visibility alone does not prove segmentation or policy correctness.

NEXT CHECKS
1. Review endpoint inventory and VLAN placement.
2. Review the current security posture.

CONFIDENCE
High — based on the live Packet Tracer controller inventory.`;
  }

  if (security) {
    return `OBSERVED
- NEXUS posture: ${security.posture}.
- Active signals: ${security.alertCount || 0}.
- Critical: ${security.criticalCount || 0}; High: ${security.highCount || 0}.

INFERRED
The current observations justify ${security.posture === 'normal' ? 'routine monitoring' : 'a focused security review'}.

RISK
${security.alerts?.[0]?.detail || 'No additional risk statement is available from current heuristics.'}

NEXT CHECKS
1. Review the evidence behind each active signal.
2. Validate segmentation before making configuration changes.

CONFIDENCE
Medium — based on NEXUS heuristics and controller-visible state, not IDS/IPS telemetry.`;
  }

  if (topology) {
    return `OBSERVED
- ${topology.nodes?.length || 0} topology nodes and ${topology.links?.length || 0} relationships are visible.
- Physical topology detail is ${topology.physicalAvailable ? 'available' : 'not exposed by the controller'}.

INFERRED
NEXUS can describe the visible fabric, but it should not claim end-to-end reachability without routing or ACL evidence.

RISK
No additional risk conclusion can be made from topology alone.

NEXT CHECKS
1. Inspect trust zones.
2. Review the current security analysis.

CONFIDENCE
Medium — topology combines controller observations with explicitly labelled lab relationships.`;
  }

  return 'I completed the available checks, but the current tool evidence is not sufficient for a substantive network assessment. Ask me to inspect network health, topology, devices, hosts, or security posture.';
}

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
        if (!fallback) throw new Error('Ollama is running but no model is installed. Run ollama pull qwen3:4b or configure an installed model.');
        activeModel = fallback;
        response = await requestChat(messages, signal, activeModel);
      }
    } catch (e) {
      if (signal.aborted) throw e;
      if (e instanceof Error && e.message.startsWith('Ollama is running')) throw e;
      throw new Error(e.name === 'TimeoutError' ? 'Local model response timed out' : 'Cannot reach Ollama. Check that it is running.');
    }
    if (!response.ok) {
      const installed = await availableModels(signal);
      throw new Error(`Ollama returned ${response.status}. Active model: ${activeModel}. Installed models: ${installed.join(', ') || 'none'}`);
    }
    const payload = await response.json();
    if (!payload?.message || payload.message.role !== 'assistant') throw new Error('Invalid model response');
    return payload.message;
  }

  async function collect(run, name, args = {}) {
    note(run, 'tool', name, name.startsWith('get_network_') || name === 'get_security_analysis' ? 'Reading live Packet Tracer context' : 'Running local tool');
    let result;
    try { result = await executeTool(root, name, args, { networkClient }); }
    catch (e) { result = `Tool error: ${e.message}`; }
    const parsed = parseResult(result);
    run.context[name] = parsed;
    const summary = summarizeTool(name, result);
    run.evidence.push({ tool:name, summary, at:new Date().toISOString() });
    note(run, String(result).startsWith('Tool error:') ? 'error' : 'success', summary, '');
    return result;
  }

  async function prime(run, messages) {
    if (!networkClient) return;
    const names = preloadTools(run.prompt).slice(0,2);
    for (const name of names) {
      if (run.cancelled) return;
      const result = await collect(run, name, {});
      messages.splice(messages.length - 1, 0, { role:'system', content:`Preloaded live NEXUS observation from ${name}: ${result}` });
    }
  }

  async function proceed(run, messages, steps = 0) {
    try {
      while (steps < limit && !run.cancelled) {
        run.status = 'thinking';
        note(run, 'thinking', steps ? 'Reasoning over evidence' : 'Understanding request', steps ? 'Correlating live observations.' : 'Selecting the safest evidence sources.');
        const message = await chat(messages, run.controller.signal);
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls.slice(0, 1) : [];
        messages.push(calls.length ? { ...message, tool_calls: calls } : message);

        if (!calls.length) {
          const content = String(message.content || '').trim();
          run.answer = (isGenericFinal(content) ? synthesizeFinal(run.prompt, run.context) : content).slice(0,10000);
          run.status = 'completed';
          note(run, 'final', 'Assessment ready', 'NEXUS produced an evidence-based response.');
          return;
        }

        for (const call of calls) {
          if (run.cancelled) return;
          const name = call?.function?.name;
          const args = call?.function?.arguments;
          if (!toolNames.has(name) || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Model requested an unknown tool');
          if (name === 'write_file') {
            safeName(args.path);
            if (typeof args.content !== 'string' || args.content.length > 4000) throw new Error('Pending write is too large');
          }

          if (isWrite(name)) {
            note(run, 'tool', name, `Preparing write to ${args.path}`);
            run.pending = { name, args, preview: args.content };
            run.status = 'approval';
            note(run, 'approval', 'Approval required', args.path);
            run.resume = async approved => {
              if (run.cancelled) return;
              try {
                run.pending = null;
                const result = approved ? await executeTool(root, name, args, { networkClient }) : 'User declined the write. Continue without modifying files.';
                note(run, approved ? 'success' : 'denied', approved ? 'Workspace updated' : 'Write declined', approved ? args.path : 'No file was changed.');
                messages.push({ role: 'tool', tool_name: name, content: result });
                await proceed(run, messages, steps + 1);
              } catch (e) {
                run.status = 'failed'; run.error = e.message; note(run, 'error', 'Write failed', e.message);
              }
            };
            return;
          }

          const result = await collect(run, name, args);
          messages.push({ role: 'tool', tool_name: name, content: result });
        }
        steps++;
      }

      if (run.cancelled) return;
      run.answer = synthesizeFinal(run.prompt, run.context);
      run.status = 'completed';
      note(run, 'final', 'Assessment ready', 'Tool step limit reached; NEXUS summarized the evidence collected so far.');
    } catch (e) {
      if (run.cancelled) return;
      run.status = 'failed';
      run.error = e.name === 'AbortError' ? 'Model request timed out or was cancelled' : e.message;
      note(run, 'error', 'Investigation interrupted', run.error);
    }
  }

  async function startRun(run) {
    const messages = [{ role:'system', content:system }, { role:'user', content:run.prompt }];
    try {
      await prime(run, messages);
      if (!run.cancelled) await proceed(run, messages);
    } catch (e) {
      if (run.cancelled) return;
      run.status = 'failed'; run.error = e.message; note(run, 'error', 'Investigation interrupted', e.message);
    }
  }

  function start(prompt) {
    if (typeof prompt !== 'string' || prompt.trim().length < 3 || prompt.length > 2000) throw new Error('Enter 3 to 2000 characters');
    for (const [id, run] of runs) if (Date.now() - run.created > 86_400_000) runs.delete(id);
    if ([...runs.values()].filter(x => ['thinking', 'approval'].includes(x.status)).length >= 2) throw new Error('A maximum of 2 agent runs can execute at once');
    const run = {
      id:randomUUID(), prompt:prompt.trim(), created:Date.now(), status:'thinking',
      events:[], evidence:[], context:{}, answer:'', pending:null, cancelled:false, controller:new AbortController(),
    };
    runs.set(run.id, run);
    void startRun(run);
    return publicRun(run);
  }

  function publicRun(run) {
    if (!run) return null;
    return {
      id:run.id,
      prompt:run.prompt,
      status:run.status,
      events:run.events,
      evidence:run.evidence,
      answer:run.answer,
      error:run.error,
      pending:run.pending ? { name:run.pending.name, path:run.pending.args.path, preview:run.pending.preview } : null,
    };
  }

  return {
    start, get:id => publicRun(runs.get(id)), getActiveModel:() => activeModel,
    decide(id, approved) {
      const run = runs.get(id);
      if (!run || run.status !== 'approval' || !run.resume) throw new Error('No operation is awaiting approval');
      const resume = run.resume;
      run.status = 'resuming'; run.resume = null;
      void resume(approved);
      return publicRun(run);
    },
    cancel(id) {
      const run = runs.get(id);
      if (!run) throw new Error('Run not found');
      run.cancelled = true; run.controller.abort(); run.pending = null; run.resume = null; run.status = 'cancelled';
      note(run, 'denied', 'Run stopped');
      return publicRun(run);
    },
  };
}
