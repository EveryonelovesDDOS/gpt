import { randomUUID } from 'node:crypto';
import { definitions, executeTool, isWrite, safeName, toolNames } from './tools.mjs';

const system = `You are NEXUS, a local-first AI network operations agent. Reply in the user's language. You can inspect local workspace documents, calculate, query the connected Cisco Packet Tracer controller, and reason over the NEXUS digital twin for devices, hosts, topology, trust zones, graph relationships, path analysis, and blast radius.

NETWORK RULES
- Use live network observations instead of guessing.
- Never claim a tool ran unless it did.
- Treat controller output as observations and NEXUS heuristics as heuristics, not proof of compromise.
- Never invent VLAN, ACL, routing, interface, reachability, attack-path, or host facts that tools do not expose.
- A host named ATTACKER-PC is a lab simulation marker, not proof of malicious activity.
- Never imply a configuration change was executed unless an execution tool reports success.
- For questions such as "can A reach B?", use analyze_network_path when possible and clearly distinguish relationship-path evidence from verified IP reachability.
- For "what is connected to X?" use get_connected_assets when possible.
- For blast-radius questions, use get_blast_radius and state that graph adjacency is not proof of compromise propagation.
- For what-if outage/failure questions, use simulate_asset_failure. It is a graph simulation only and never changes a device.
- For redundancy/alternate-path questions, use get_resilience_paths and state that relationship paths are not verified routing paths.
- For segmentation/isolation policy questions, use audit_segmentation_policy and keep enforcement explicitly unverified unless controller evidence proves it.
- Prefer the digital twin for relationship questions; prefer controller observations for live state.
- If policy enforcement cannot be verified from controller data, say so plainly.
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

const limit = 10;
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
    if (name === 'get_network_digital_twin') {
      return `Digital twin ready: ${data.nodes?.length || 0} assets, ${data.links?.length || 0} relationships, ${data.zones?.length || 0} trust zones; policy enforcement ${data.confidence?.policyEnforcement || 'unknown'}.`;
    }
    if (name === 'analyze_network_path') {
      return data.found
        ? `Relationship path ${data.source} → ${data.target}: ${data.hops?.length || 0} nodes; reachability ${data.reachability}; certainty ${data.certainty || 'unknown'}.`
        : `No current digital-twin relationship path established between ${data.source} and ${data.target}.`;
    }
    if (name === 'get_blast_radius') {
      return data.found
        ? `Blast-radius graph for ${data.asset?.label}: ${data.affected?.length || 0} adjacent/dependent assets, ${data.criticalAssets?.length || 0} critical assets.`
        : `Blast-radius asset not found: ${data.asset}.`;
    }
    if (name === 'get_connected_assets') {
      return data.found
        ? `${data.asset?.label} has ${data.neighbors?.length || 0} directly connected assets in the digital twin.`
        : `Connected-assets lookup could not find ${data.asset}.`;
    }
    if (name === 'simulate_asset_failure') {
      return data.found
        ? `What-if outage for ${data.asset?.label}: ${data.affected?.length || 0} graph-separated assets, ${data.criticalAffected?.length || 0} protected assets; severity ${data.severity || 'unknown'}.`
        : `What-if outage asset not found: ${data.asset}.`;
    }
    if (name === 'get_resilience_paths') {
      return data.found
        ? `${data.source} → ${data.target}: ${data.pathCount || data.paths?.length || 0} relationship path(s); redundancy ${data.redundancy || 'unknown'}.`
        : `No current relationship path found between ${data.source} and ${data.target}.`;
    }
    if (name === 'audit_segmentation_policy') {
      return `Segmentation policy audit: ${data.checks?.length || 0} expectation(s); enforcement confidence ${data.confidence || 'unknown'}.`;
    }
    if (name === 'list_files') return `${Array.isArray(data) ? data.length : 0} workspace documents found.`;
    if (name === 'search_files') return `${Array.isArray(data) ? data.length : 0} matching lines found.`;
    if (name === 'read_file') return 'Workspace document read successfully.';
    if (name === 'calculate') return `Calculation result: ${String(result).slice(0,120)}`;
    if (name === 'write_file') return String(result).slice(0,180);
  } catch {}
  return 'Tool completed successfully.';
}

function mentionedAssets(prompt) {
  const known=['CORE-SW','EDGE-RTR','ATTACKER-PC','SERVER','ADMIN-PC','FINANCE-PC','STAFF-PC','PUBLIC-WEB'];
  const upper=prompt.toUpperCase();
  return known.filter(name=>upper.includes(name));
}

function preloadPlan(prompt) {
  const p = prompt.toLowerCase();
  const assets=mentionedAssets(prompt);
  if (/(what if|fails|failure|offline|goes down|unavailable|outage|down impact|故障|宕机|离线)/.test(p) && assets[0]) {
    return [
      { name:'get_network_digital_twin', args:{} },
      { name:'simulate_asset_failure', args:{ asset:assets[0] } },
    ];
  }
  if (/(redundan|resilien|alternate path|backup path|single point|备用路径|冗余|单点)/.test(p) && assets.length >= 2) {
    return [
      { name:'get_network_digital_twin', args:{} },
      { name:'get_resilience_paths', args:{ source:assets[0], target:assets[1], maxPaths:3 } },
    ];
  }
  if (/(segment|segmentation|isolation|isolated|policy|acl|隔离|策略|分段)/.test(p)) {
    return [
      { name:'get_network_digital_twin', args:{} },
      { name:'audit_segmentation_policy', args:{} },
    ];
  }
  if (/blast|impact|affected|dependency|radius|影响|波及/.test(p) && assets[0]) {
    return [
      { name:'get_network_digital_twin', args:{} },
      { name:'get_blast_radius', args:{ asset:assets[0], depth:3 } },
    ];
  }
  if (/connected to|connects to|neighbor|attached|what is connected|连接到|相连/.test(p) && assets[0]) {
    return [
      { name:'get_network_digital_twin', args:{} },
      { name:'get_connected_assets', args:{ asset:assets[0] } },
    ];
  }
  if (/reach|reachable|path|can .* reach|可达|路径/.test(p) && assets.length >= 2) {
    return [
      { name:'get_network_digital_twin', args:{} },
      { name:'analyze_network_path', args:{ source:assets[0], target:assets[1] } },
    ];
  }
  if (/health|healthy|status|健康|状态/.test(p)) return [{name:'get_network_health',args:{}},{name:'get_security_analysis',args:{}}];
  if (/attacker|intruder|guest|where is|位于|攻击/.test(p)) return [{name:'get_network_hosts',args:{}},{name:'get_security_analysis',args:{}}];
  if (/device|inventory|discovered|设备|清单/.test(p)) return [{name:'get_network_devices',args:{}}];
  if (/alert|security|risk|threat|安全|风险|告警/.test(p)) return [{name:'get_security_analysis',args:{}},{name:'get_network_topology',args:{}}];
  if (/topology|fabric|vlan|network|拓扑|网络/.test(p)) return [{name:'get_network_digital_twin',args:{}},{name:'get_security_analysis',args:{}}];
  return [];
}

function buildActionCards(run) {
  const cards=[];
  const security=run.context.get_security_analysis;
  const path=run.context.analyze_network_path;
  const blast=run.context.get_blast_radius;
  const connected=run.context.get_connected_assets;
  const failure=run.context.simulate_asset_failure;
  const resilience=run.context.get_resilience_paths;
  const policyAudit=run.context.audit_segmentation_policy;
  const twin=run.context.get_network_digital_twin;
  const topAlert=security?.alerts?.find?.(alert=>['critical','high'].includes(alert.severity)) || security?.alerts?.[0];

  if (topAlert) cards.push({
    id:`incident:${topAlert.id}`,
    type:'open-incident',
    label:'Open incident workspace',
    description:`Investigate ${topAlert.title} with evidence and human-controlled response.`,
    icon:'shield',
    tone:'danger',
    payload:{ alertId:topAlert.id },
  });
  if (path?.found) cards.push({
    id:`path:${path.source}:${path.target}`,
    type:'show-path',
    label:'Show path on Digital Twin',
    description:`${path.source} → ${path.target} · reachability ${path.reachability || 'unknown'}.`,
    icon:'git-branch',
    tone:'violet',
    payload:{ source:path.source, target:path.target },
  });
  if (blast?.found) cards.push({
    id:`blast:${blast.asset?.label || blast.asset}`,
    type:'show-blast-radius',
    label:'Open blast radius',
    description:`${blast.affected?.length || 0} graph-adjacent assets · ${blast.criticalAssets?.length || 0} critical.`,
    icon:'radio',
    tone:'amber',
    payload:{ asset:blast.asset?.label || blast.asset },
  });
  if (connected?.found) cards.push({
    id:`focus:${connected.asset?.label}`,
    type:'focus-twin',
    label:`Focus ${connected.asset?.label}`,
    description:`${connected.neighbors?.length || 0} direct digital-twin relationships.`,
    icon:'crosshair',
    tone:'mint',
    payload:{ asset:connected.asset?.label },
  });
  if (failure?.found) cards.push({
    id:`failure:${failure.asset?.label || failure.asset}`,
    type:'show-failure-impact',
    label:'Show what-if outage',
    description:`${failure.affected?.length || 0} graph-separated assets · simulation only.`,
    icon:'power',
    tone:'danger',
    payload:{ asset:failure.asset?.label || failure.asset },
  });
  if (resilience?.found) cards.push({
    id:`resilience:${resilience.source}:${resilience.target}`,
    type:'show-path',
    label:'Show resilience path',
    description:`${resilience.pathCount || 0} relationship path(s) · ${resilience.redundancy || 'unknown'} redundancy.`,
    icon:'shuffle',
    tone:'violet',
    payload:{ source:resilience.source, target:resilience.target },
  });
  if (policyAudit?.checks?.length) {
    const first=policyAudit.checks[0];
    cards.push({
      id:`policy:${first.id}`,
      type:'show-policy',
      label:'Open policy overlay',
      description:`${first.sourceZone} → ${first.targetZone} · enforcement ${first.verification}.`,
      icon:'shield',
      tone:'amber',
      payload:{ sourceZone:first.sourceZone, targetZone:first.targetZone },
    });
  }
  if (!cards.some(card=>card.type==='focus-twin') && twin?.nodes?.length) {
    const marker=twin.nodes.find(node=>node.labThreatMarker);
    if(marker) cards.push({
      id:`focus:${marker.label}`,
      type:'focus-twin',
      label:`Focus ${marker.label}`,
      description:`${marker.zone} · ${marker.trustTier} · inspect graph relationships.`,
      icon:'crosshair',
      tone:'mint',
      payload:{ asset:marker.label },
    });
  }
  cards.push({
    id:'ask:changes',
    type:'ask',
    label:'What changed recently?',
    description:'Continue the investigation with live change context.',
    icon:'activity',
    tone:'neutral',
    payload:{ prompt:'What changed recently in this network, and does it matter for the current investigation?' },
  });
  return cards.slice(0,3);
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
  const twin = context.get_network_digital_twin;
  const pathAnalysis = context.analyze_network_path;
  const blastRadius = context.get_blast_radius;
  const connected = context.get_connected_assets;
  const failureImpact = context.simulate_asset_failure;
  const resilience = context.get_resilience_paths;
  const policyAudit = context.audit_segmentation_policy;

  if (failureImpact) {
    const affected=(failureImpact.affected || []).map(a=>a.label).join(', ') || 'none';
    const protectedAssets=(failureImpact.criticalAffected || []).map(a=>a.label).join(', ') || 'none';
    return `OBSERVED
- What-if asset: ${failureImpact.asset?.label || failureImpact.asset}.
- Graph-separated assets if it becomes unavailable: ${affected}.
- Protected assets in the simulated impact set: ${protectedAssets}.

INFERRED
This suggests a ${failureImpact.severity || 'review'} graph-dependency impact if that asset is unavailable.

RISK
The result identifies structural dependency, not proven packet loss or a real outage.

NEXT CHECKS
1. Review alternate relationships or redundancy.
2. Verify the affected services from live controller observations if an outage actually occurs.

CONFIDENCE
Medium — deterministic graph simulation; no device was changed.`;
  }

  if (resilience) {
    const paths=(resilience.paths || []).map(path=>`- ${path.hops.join(' → ')}`).join('\n') || '- No graph relationship path found.';
    return `OBSERVED
${paths}
- Relationship redundancy: ${resilience.redundancy || 'unknown'}.

INFERRED
${resilience.redundancy==='single'?'Only one relationship path is represented, so the graph has no represented alternate for this pair.':resilience.redundancy==='multiple'?'Multiple relationship paths are represented in the current twin.':'No represented relationship path exists for this pair.'}

RISK
Relationship redundancy is not the same as routing convergence or verified forwarding redundancy.

NEXT CHECKS
1. Verify routing and interface state where controller data is available.
2. Test the relevant service path separately if required.

CONFIDENCE
Medium — graph relationships are certainty-labelled, but forwarding is not proven.`;
  }

  if (policyAudit) {
    const checks=(policyAudit.checks || []).map(check=>`- ${check.sourceZone} → ${check.targetZone}: expected ${check.expectation}; graph relationship ${check.relationshipPath?'present':'not found'}; enforcement ${check.verification}.`).join('\n');
    return `OBSERVED
${checks || '- No segmentation policy checks are configured.'}

INFERRED
The digital twin can compare intended isolation with represented relationships, but it cannot infer ACL enforcement from graph structure alone.

RISK
Any protected-zone isolation marked not-verified should be validated before relying on it.

NEXT CHECKS
1. Inspect ACL/routing state if Packet Tracer exposes it.
2. Validate the relevant source and destination VLANs.

CONFIDENCE
Medium — policy intent is known; enforcement remains ${policyAudit.confidence || 'not-verified'}.`;
  }

  if (pathAnalysis) {
    const hopText=(pathAnalysis.hops || []).map(h=>h.node?.label).filter(Boolean).join(' → ');
    return `OBSERVED
- Relationship path: ${pathAnalysis.found ? (hopText || pathAnalysis.source + ' → ' + pathAnalysis.target) : 'not found in the current digital twin'}.
- Relationship certainty: ${pathAnalysis.certainty || 'unknown'}.
- IP reachability: ${pathAnalysis.reachability || 'not-verified'}.

INFERRED
A digital-twin relationship is not the same as verified end-to-end traffic reachability.

RISK
Treat unverified forwarding or isolation as a review item, especially around protected zones.

NEXT CHECKS
1. Verify routing and policy enforcement where available.
2. Confirm the source and target VLAN assignments.
3. Refresh the twin after topology changes.

CONFIDENCE
Medium — relationship evidence is available, while forwarding policy is only partially observable.`;
  }

  if (blastRadius) {
    const critical=(blastRadius.criticalAssets || []).map(a=>a.label).join(', ') || 'none identified';
    return `OBSERVED
- ${blastRadius.affected?.length || 0} graph-adjacent assets are within the selected depth.
- Critical assets in that graph set: ${critical}.

INFERRED
This is structural impact context from the digital twin, not a forwarding verdict.

RISK
Critical assets in the highlighted set deserve priority verification.

NEXT CHECKS
1. Inspect highlighted critical assets.
2. Verify segmentation and recent network changes.

CONFIDENCE
Medium — based on certainty-labelled graph relationships.`;
  }

  if (connected) {
    const neighbors=(connected.neighbors || []).map(n=>`- ${n.label}: ${n.zone} via ${n.via} (${n.certainty})`).join('\n') || '- No direct neighbors are represented.';
    return `OBSERVED
${neighbors}

INFERRED
These are direct relationships for ${connected.asset?.label || 'the selected asset'} in the current digital twin.

RISK
A direct graph relationship does not itself prove IP reachability.

NEXT CHECKS
1. Review untrusted or protected neighbors.
2. Verify the relationship certainty and VLAN context.

CONFIDENCE
High for the listed graph relationships; forwarding behavior remains separately verified.`;
  }

  if (twin && /topology|fabric|digital twin|network|拓扑|网络/.test(p)) {
    return `OBSERVED
- Digital twin contains ${twin.nodes?.length || 0} assets, ${twin.links?.length || 0} relationships, and ${twin.zones?.length || 0} trust zones.
- Policy enforcement confidence: ${twin.confidence?.policyEnforcement || 'unknown'}.

INFERRED
The twin preserves certainty labels instead of treating every relationship as verified traffic flow.

RISK
Inferred links require separate verification.

NEXT CHECKS
1. Inspect a selected asset and its direct neighbors.
2. Run path or impact analysis for the current incident.

CONFIDENCE
High for represented inventory; policy enforcement remains separately verified.`;
  }


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

export function createAgent({ root, model, ollama = 'http://127.0.0.1:11434', fetcher = fetch, networkClient = null, digitalTwin = null }) {
  const runs = new Map();
  const recentTurns = [];
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
    try { result = await executeTool(root, name, args, { networkClient, digitalTwin }); }
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
    const plan = preloadPlan(run.prompt).slice(0,3);
    for (const step of plan) {
      if (run.cancelled) return;
      const result = await collect(run, step.name, step.args);
      messages.splice(messages.length - 1, 0, { role:'system', content:`Preloaded live NEXUS observation from ${step.name}: ${result}` });
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
          run.followUps = [
            'Show me the evidence behind this assessment.',
            'What should I verify next?',
            ...(run.context.get_security_analysis?.alertCount ? ['Explain the highest-priority signal.'] : []),
          ].slice(0,3);
          run.actions = buildActionCards(run);
          recentTurns.push({ prompt:run.prompt, answer:run.answer });
          if (recentTurns.length > 6) recentTurns.shift();
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
                const result = approved ? await executeTool(root, name, args, { networkClient, digitalTwin }) : 'User declined the write. Continue without modifying files.';
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
      run.followUps = ['Show me the evidence behind this assessment.','What should I verify next?'];
      run.actions = buildActionCards(run);
      recentTurns.push({ prompt:run.prompt, answer:run.answer });
      if (recentTurns.length > 6) recentTurns.shift();
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
    const messages = [{ role:'system', content:system }];
    for (const turn of recentTurns.slice(-3)) {
      messages.push({ role:'user', content:turn.prompt });
      messages.push({ role:'assistant', content:turn.answer });
    }
    messages.push({ role:'user', content:run.prompt });
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
      events:[], evidence:[], context:{}, answer:'', followUps:[], actions:[], pending:null, cancelled:false, controller:new AbortController(),
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
      followUps:run.followUps || [],
      actions:run.actions || [],
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
