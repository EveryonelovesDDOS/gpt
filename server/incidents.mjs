import { randomUUID } from 'node:crypto';

const severityRank = { critical: 4, high: 3, medium: 2, info: 1 };

export function createIncidentManager({ networkClient, digitalTwin = null }) {
  const history = [];
  const proposals = new Map();
  const incidentRegistry = new Map();
  const cases = new Map();

  async function snapshot() {
    const analysis = await networkClient.getSecurityAnalysis();
    const now = new Date().toISOString();
    const seen = new Set();
    const incidents = (analysis.alerts || []).map(alert => {
      seen.add(alert.id);
      const existing = incidentRegistry.get(alert.id);
      const incident = {
        id: alert.id,
        severity: alert.severity,
        category: alert.category,
        title: alert.title,
        detail: alert.detail,
        evidence: alert.evidence,
        status: 'active',
        firstSeen: existing?.firstSeen || now,
        lastSeen: now,
        occurrences: (existing?.occurrences || 0) + 1,
      };
      incidentRegistry.set(alert.id, incident);
      return incident;
    });

    for (const [id, incident] of incidentRegistry) {
      if (!seen.has(id) && incident.status === 'active') {
        incidentRegistry.set(id, { ...incident, status:'resolved', lastSeen:now });
      }
    }

    const frame = {
      id: randomUUID(),
      at: now,
      posture: analysis.posture,
      alertCount: incidents.length,
      incidents,
    };
    history.unshift(frame);
    if (history.length > 40) history.length = 40;
    return frame;
  }

  function listCases() {
    return [...cases.values()].sort((a,b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async function getTimeline() {
    const current = await snapshot();
    return {
      current,
      timeline: history.slice(0, 20),
      cases: listCases(),
      generatedAt: new Date().toISOString(),
    };
  }

  async function openCase(alertId) {
    const [analysis, hosts, topology] = await Promise.all([
      networkClient.getSecurityAnalysis(),
      networkClient.getHosts(),
      networkClient.getTopology(),
    ]);
    const alert = (analysis.alerts || []).find(item => item.id === alertId);
    if (!alert) throw new Error('The selected incident is no longer active');

    const existing = [...cases.values()].find(item => item.alertId === alertId && item.status !== 'closed');
    if (existing) return existing;

    const hostName = String(alert.evidence?.host || '');
    const host = hosts.find(item => item.name === hostName || item.id === alert.evidence?.hostId || item.ip === alert.evidence?.ip);
    const core = topology.nodes.find(node => node.role === 'core-switch');
    const sourceNode = topology.nodes.find(node => node.label === hostName || node.ip === host?.ip);
    const sourceLink = topology.links.find(link => link.target === sourceNode?.id || link.source === sourceNode?.id);
    const protectedZones = [...new Set(topology.nodes.filter(node => ['SERVER','MANAGEMENT','PUBLIC'].includes(node.zone)).map(node => node.zone))];

    const evidence = [
      { label:'Signal', value:alert.title, source:'NEXUS security analysis', certainty:'observed' },
      ...(host ? [
        { label:'Source host', value:`${host.name} · ${host.ip || 'unknown IP'}`, source:'Packet Tracer host inventory', certainty:'observed' },
        { label:'Trust zone', value:`${host.zone}${host.vlan ? ` · VLAN ${host.vlan}` : ''} · ${host.trust}`, source:'NEXUS VLAN policy mapping', certainty:'observed' },
        { label:'Attachment', value:host.connectedInterface || 'Interface not exposed by controller', source:host.connectedInterface ? 'Packet Tracer host inventory' : 'Controller limitation', certainty:host.connectedInterface ? 'observed' : 'unknown' },
      ] : []),
      { label:'Security posture', value:analysis.posture, source:'NEXUS heuristics', certainty:'heuristic' },
    ];

    const path = [
      {
        label: host?.name || hostName || 'Alert source',
        kind:'source',
        detail:host ? `${host.ip} · ${host.zone}${host.vlan ? ` / VLAN ${host.vlan}` : ''}` : 'Source asset',
        certainty:'observed',
      },
      ...(sourceLink || core ? [{
        label: core?.label || 'CORE-SW',
        kind:'fabric',
        detail:sourceLink?.label ? `Attachment context: ${sourceLink.label}` : 'Core fabric context',
        certainty:sourceLink?.sourceType === 'controller' ? 'observed' : 'inferred',
      }] : []),
      ...protectedZones.map(zone => ({
        label:zone,
        kind:'review-target',
        detail:'Protected-zone exposure must be verified against ACL/routing policy.',
        certainty:'not-verified',
      })),
    ];

    const recommendations = [
      { kind:'isolate_guest_from_server', label:'Verify / prepare guest-to-server isolation', priority:1 },
      ...(host?.connectedInterface ? [{ kind:'quarantine_attacker_port', label:`Prepare quarantine for ${host.connectedInterface}`, priority:2 }] : []),
      { kind:'protect_management', label:'Verify / prepare management-zone protection', priority:3 },
    ];

    const now = new Date().toISOString();
    const incidentCase = {
      id: randomUUID(),
      alertId,
      status:'investigating',
      severity:alert.severity,
      category:alert.category,
      title:alert.title,
      summary:alert.detail,
      openedAt:now,
      updatedAt:now,
      source: host ? {
        name:host.name,
        ip:host.ip,
        zone:host.zone,
        vlan:host.vlan,
        trust:host.trust,
        interface:host.connectedInterface,
      } : null,
      evidence,
      path,
      recommendations,
      assessment: alert.category === 'lab-threat-marker'
        ? 'This is a simulation marker from the NEXUS lab convention. It justifies investigation, but it is not proof of malicious activity.'
        : 'NEXUS correlated the active signal with current controller observations. Validate policy and reachability before taking action.',
    };
    cases.set(incidentCase.id, incidentCase);
    return incidentCase;
  }

  function closeCase(id) {
    const incidentCase = cases.get(id);
    if (!incidentCase) throw new Error('Incident case not found');
    if (incidentCase.status === 'closed') return incidentCase;
    const updated = { ...incidentCase, status:'closed', closedAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    cases.set(id, updated);
    return updated;
  }

  function getCase(id) {
    return cases.get(id) || null;
  }

  function actionTemplates() {
    return {
      isolate_guest_from_server: {
        title: 'Isolate GUEST VLAN from SERVER VLAN',
        target: 'VLAN 40 → VLAN 50',
        summary: 'Prepare an extended ACL that blocks guest-zone traffic from reaching the protected server subnet while leaving unrelated traffic unchanged.',
        commands: [
          'ip access-list extended NEXUS_GUEST_ISOLATION',
          ' deny ip 192.168.40.0 0.0.0.255 192.168.50.0 0.0.0.255',
          ' permit ip any any',
          'interface Vlan40',
          ' ip access-group NEXUS_GUEST_ISOLATION in',
        ],
        rollback: [
          'interface Vlan40',
          ' no ip access-group NEXUS_GUEST_ISOLATION in',
          'no ip access-list extended NEXUS_GUEST_ISOLATION',
        ],
        risk: 'medium',
      },
      quarantine_attacker_port: {
        title: 'Quarantine ATTACKER-PC switch port',
        target: 'ATTACKER-PC / access port',
        summary: 'Prepare a shutdown of the access interface currently associated with the lab threat-marker host.',
        commands: [
          'interface <ATTACKER_CONNECTED_INTERFACE>',
          ' description NEXUS-QUARANTINE',
          ' shutdown',
        ],
        rollback: [
          'interface <ATTACKER_CONNECTED_INTERFACE>',
          ' no shutdown',
        ],
        risk: 'high',
      },
      protect_management: {
        title: 'Restrict GUEST access to MANAGEMENT',
        target: 'VLAN 40 → VLAN 99',
        summary: 'Prepare a policy that prevents the untrusted guest subnet from reaching the management subnet.',
        commands: [
          'ip access-list extended NEXUS_MGMT_PROTECT',
          ' deny ip 192.168.40.0 0.0.0.255 192.168.99.0 0.0.0.255',
          ' permit ip any any',
          'interface Vlan40',
          ' ip access-group NEXUS_MGMT_PROTECT in',
        ],
        rollback: [
          'interface Vlan40',
          ' no ip access-group NEXUS_MGMT_PROTECT in',
          'no ip access-list extended NEXUS_MGMT_PROTECT',
        ],
        risk: 'medium',
      },
    };
  }

  async function propose(kind, incidentCaseId = '') {
    const template = actionTemplates()[kind];
    if (!template) throw new Error('Unknown defensive action');
    const hosts = await networkClient.getHosts();
    const attacker = hosts.find(h => h.labThreatMarker);
    if (kind === 'quarantine_attacker_port' && !attacker?.connectedInterface) throw new Error('Cannot prepare port quarantine because the controller did not report the attacker host interface');
    if (incidentCaseId && !cases.has(incidentCaseId)) throw new Error('Incident case not found');
    const commands = template.commands.map(line => line.replace('<ATTACKER_CONNECTED_INTERFACE>', attacker?.connectedInterface || '<unknown-interface>'));
    const rollback = template.rollback.map(line => line.replace('<ATTACKER_CONNECTED_INTERFACE>', attacker?.connectedInterface || '<unknown-interface>'));
    const proposal = {
      id: randomUUID(),
      kind,
      incidentCaseId: incidentCaseId || null,
      title: template.title,
      target: template.target,
      summary: template.summary,
      commands,
      rollback,
      risk: template.risk,
      requiresApproval: true,
      executionMode: 'preview-only',
      status: 'pending',
      createdAt: new Date().toISOString(),
      note: 'NEXUS generates reversible change plans but does not push IOS configuration automatically because this Packet Tracer integration has no verified write transport.',
      lifecycle: [{ at:new Date().toISOString(), step:'proposed', detail:'Reversible response plan generated.' }],
      simulation: null,
      verification: null,
      rollbackState: 'ready',
    };
    proposals.set(proposal.id, proposal);
    if (incidentCaseId) {
      const incidentCase = cases.get(incidentCaseId);
      cases.set(incidentCaseId, { ...incidentCase, updatedAt:new Date().toISOString(), linkedActionIds:[...(incidentCase.linkedActionIds || []), proposal.id] });
    }
    return proposal;
  }

  function decide(id, approved) {
    const proposal = proposals.get(id);
    if (!proposal) throw new Error('Action proposal not found');
    if (proposal.status !== 'pending') return proposal;
    proposal.status = approved ? 'approved-preview' : 'rejected';
    proposal.decidedAt = new Date().toISOString();
    proposal.approved = approved;
    proposal.lifecycle = [...(proposal.lifecycle || []), {
      at:proposal.decidedAt,
      step:approved ? 'approved' : 'rejected',
      detail:approved ? 'Human approved the plan for simulation / manual application. No IOS command was pushed.' : 'Human rejected the plan. No network change was made.',
    }];
    proposals.set(id, proposal);
    return proposal;
  }

  async function simulate(id) {
    const proposal = proposals.get(id);
    if (!proposal) throw new Error('Action proposal not found');
    if (!['approved-preview','simulated','verification-pending','verification-limited','verification-failed','verified'].includes(proposal.status)) throw new Error('Approve the response plan before simulation');

    const [twin, security, hosts] = await Promise.all([
      digitalTwin ? digitalTwin.build() : null,
      networkClient.getSecurityAnalysis(),
      networkClient.getHosts(),
    ]);
    const attacker = hosts.find(host => host.labThreatMarker);
    const expected = proposal.kind === 'quarantine_attacker_port'
      ? {
          outcome:'The lab threat-marker host should disappear from controller host inventory or cease to be observed on the quarantined access attachment.',
          measurable:['ATTACKER-PC host visibility','Current host attachment / zone'],
        }
      : proposal.kind === 'isolate_guest_from_server'
        ? {
            outcome:'Guest-to-server traffic should be denied by policy while unrelated traffic remains unchanged.',
            measurable:['Policy intent is known','ACL enforcement is not exposed by this controller API'],
          }
        : {
            outcome:'Guest-to-management traffic should be denied by policy.',
            measurable:['Policy intent is known','ACL enforcement is not exposed by this controller API'],
          };

    proposal.simulation = {
      at:new Date().toISOString(),
      before:{
        posture:security.posture,
        alertCount:security.alertCount,
        attacker:attacker ? { name:attacker.name, ip:attacker.ip, zone:attacker.zone, vlan:attacker.vlan, interface:attacker.connectedInterface } : null,
        twinAssets:twin?.nodes?.length ?? null,
        twinRelationships:twin?.links?.length ?? null,
      },
      expected,
      result:'safe-preview',
      limitation:'Simulation predicts intent and measurable observations only. It does not emulate IOS packet forwarding or prove ACL enforcement.',
    };
    proposal.status = 'simulated';
    proposal.lifecycle = [...(proposal.lifecycle || []), { at:proposal.simulation.at, step:'simulated', detail:'Expected outcome and verification evidence were prepared without changing the network.' }];
    proposals.set(id, proposal);
    return proposal;
  }

  function markApplied(id) {
    const proposal = proposals.get(id);
    if (!proposal) throw new Error('Action proposal not found');
    if (!['approved-preview','simulated','verification-failed','verification-limited'].includes(proposal.status)) throw new Error('The action is not ready to be marked as manually applied');
    const at=new Date().toISOString();
    proposal.status='verification-pending';
    proposal.appliedExternallyAt=at;
    proposal.lifecycle=[...(proposal.lifecycle || []), { at, step:'manual-apply', detail:'Operator reported that the preview commands were applied externally. NEXUS did not execute them.' }];
    proposals.set(id, proposal);
    return proposal;
  }

  async function verify(id) {
    const proposal = proposals.get(id);
    if (!proposal) throw new Error('Action proposal not found');
    if (!proposal.approved) throw new Error('Only an approved plan can enter verification');

    const [hosts, security, twin] = await Promise.all([
      networkClient.getHosts(),
      networkClient.getSecurityAnalysis(),
      digitalTwin ? digitalTwin.build() : null,
    ]);
    const attacker=hosts.find(host => host.labThreatMarker);
    const at=new Date().toISOString();
    let outcome='limited';
    let status='verification-limited';
    let detail='The current controller API does not expose enough forwarding or ACL state to prove this policy change.';

    if (proposal.kind==='quarantine_attacker_port') {
      if (!attacker) {
        outcome='verified-observation';
        status='verified';
        detail='The lab threat-marker host is no longer present in current controller host inventory. This supports containment, although it does not independently prove the exact IOS command applied.';
      } else {
        outcome='not-observed';
        status='verification-failed';
        detail=`The lab threat-marker host is still visible at ${attacker.ip || 'unknown IP'} on ${attacker.connectedInterface || 'an unreported interface'}.`;
      }
    } else {
      const rule=twin?.policy?.find(item => proposal.kind==='isolate_guest_from_server'
        ? item.id==='guest-server-isolation'
        : item.id==='guest-management-isolation');
      detail=rule?.reason || detail;
    }

    proposal.status=status;
    proposal.verification={
      at,
      outcome,
      detail,
      observed:{
        posture:security.posture,
        alertCount:security.alertCount,
        attacker:attacker ? { name:attacker.name, ip:attacker.ip, zone:attacker.zone, vlan:attacker.vlan, interface:attacker.connectedInterface } : null,
      },
    };
    proposal.lifecycle=[...(proposal.lifecycle || []), { at, step:'verified', detail }];
    proposals.set(id, proposal);
    return proposal;
  }

  function requestRollback(id) {
    const proposal=proposals.get(id);
    if (!proposal) throw new Error('Action proposal not found');
    if (!proposal.approved) throw new Error('Rollback is only relevant after an approved plan');
    const at=new Date().toISOString();
    proposal.rollbackState='operator-required';
    proposal.lifecycle=[...(proposal.lifecycle || []), { at, step:'rollback-ready', detail:'Rollback commands are ready for manual application. NEXUS did not execute them.' }];
    proposals.set(id, proposal);
    return proposal;
  }

  function listProposals() {
    return [...proposals.values()].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  return { getTimeline, openCase, closeCase, getCase, listCases, propose, decide, simulate, markApplied, verify, requestRollback, listProposals };
}
