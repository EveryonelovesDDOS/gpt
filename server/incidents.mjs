import { randomUUID } from 'node:crypto';

const severityRank = { critical: 4, high: 3, medium: 2, info: 1 };

export function createIncidentManager({ networkClient }) {
  const history = [];
  const proposals = new Map();

  async function snapshot() {
    const analysis = await networkClient.getSecurityAnalysis();
    const now = new Date().toISOString();
    const incidents = analysis.alerts.map(alert => ({
      id: alert.id,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      detail: alert.detail,
      evidence: alert.evidence,
      status: 'active',
      firstSeen: now,
      lastSeen: now,
    }));
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

  async function getTimeline() {
    const current = await snapshot();
    return {
      current,
      timeline: history.slice(0, 20),
      generatedAt: new Date().toISOString(),
    };
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

  async function propose(kind) {
    const template = actionTemplates()[kind];
    if (!template) throw new Error('Unknown defensive action');
    const hosts = await networkClient.getHosts();
    const attacker = hosts.find(h => h.labThreatMarker);
    if (kind === 'quarantine_attacker_port' && !attacker?.connectedInterface) throw new Error('Cannot prepare port quarantine because the controller did not report the attacker host interface');
    const commands = template.commands.map(line => line.replace('<ATTACKER_CONNECTED_INTERFACE>', attacker?.connectedInterface || '<unknown-interface>'));
    const rollback = template.rollback.map(line => line.replace('<ATTACKER_CONNECTED_INTERFACE>', attacker?.connectedInterface || '<unknown-interface>'));
    const proposal = {
      id: randomUUID(),
      kind,
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
      note: 'NEXUS currently generates validated change plans but does not push IOS configuration automatically because this Packet Tracer integration has no verified write transport.',
    };
    proposals.set(proposal.id, proposal);
    return proposal;
  }

  function decide(id, approved) {
    const proposal = proposals.get(id);
    if (!proposal) throw new Error('Action proposal not found');
    if (proposal.status !== 'pending') return proposal;
    proposal.status = approved ? 'approved-preview' : 'rejected';
    proposal.decidedAt = new Date().toISOString();
    proposal.approved = approved;
    proposals.set(id, proposal);
    return proposal;
  }

  function listProposals() {
    return [...proposals.values()].sort((a,b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  return { getTimeline, propose, decide, listProposals };
}
