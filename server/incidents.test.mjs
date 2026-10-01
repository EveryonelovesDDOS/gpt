import test from 'node:test';
import assert from 'node:assert/strict';
import { createIncidentManager } from './incidents.mjs';

const networkClient = {
  async getSecurityAnalysis() {
    return {
      posture: 'critical',
      alerts: [
        {
          id: 'lab-threat:attack',
          severity: 'critical',
          category: 'lab-threat-marker',
          title: 'ATTACKER-PC detected',
          detail: 'Simulation marker only.',
          evidence: { host: 'ATTACKER-PC', ip: '192.168.40.66', vlan: 40 },
        },
      ],
    };
  },
  async getHosts() {
    return [
      {
        id: 'attack',
        name: 'ATTACKER-PC',
        ip: '192.168.40.66',
        connectedInterface: 'FastEthernet0/4',
        labThreatMarker: true,
      },
    ];
  },
  async getTopology() {
    return {
      nodes:[
        { id:'device:core', kind:'device', label:'CORE-SW', role:'core-switch', ip:'10.0.0.2', zone:'CORE' },
        { id:'host:attack', kind:'host', label:'ATTACKER-PC', role:'attacker', ip:'192.168.40.66', zone:'GUEST', vlan:40 },
        { id:'host:server', kind:'host', label:'SERVER', role:'endpoint', ip:'192.168.50.10', zone:'SERVER', vlan:50 },
      ],
      links:[
        { id:'link', source:'device:core', target:'host:attack', label:'FastEthernet0/4', sourceType:'controller' },
      ],
      physicalAvailable:false,
    };
  },
};

test('incident timeline records current security snapshot', async () => {
  const manager = createIncidentManager({ networkClient });
  const result = await manager.getTimeline();
  assert.equal(result.current.posture, 'critical');
  assert.equal(result.current.alertCount, 1);
  assert.equal(result.current.incidents[0].title, 'ATTACKER-PC detected');
  assert.equal(result.timeline.length, 1);
});

test('quarantine proposal resolves the discovered access interface', async () => {
  const manager = createIncidentManager({ networkClient });
  const proposal = await manager.propose('quarantine_attacker_port');
  assert.equal(proposal.status, 'pending');
  assert.equal(proposal.executionMode, 'preview-only');
  assert.equal(proposal.commands.includes('interface FastEthernet0/4'), true);
  assert.equal(proposal.rollback.includes('interface FastEthernet0/4'), true);

  const approved = manager.decide(proposal.id, true);
  assert.equal(approved.status, 'approved-preview');
  assert.equal(approved.approved, true);
});

test('guest isolation proposal is reversible and approval gated', async () => {
  const manager = createIncidentManager({ networkClient });
  const proposal = await manager.propose('isolate_guest_from_server');
  assert.equal(proposal.requiresApproval, true);
  assert.match(proposal.commands.join('\n'), /192\.168\.40\.0/);
  assert.match(proposal.commands.join('\n'), /192\.168\.50\.0/);
  assert.match(proposal.rollback.join('\n'), /no ip access-list extended/);
});


test('incident workspace correlates evidence and safe response options', async () => {
  const manager = createIncidentManager({ networkClient });
  const incidentCase = await manager.openCase('lab-threat:attack');
  assert.equal(incidentCase.status, 'investigating');
  assert.equal(incidentCase.source.name, 'ATTACKER-PC');
  assert.equal(incidentCase.evidence.some(x => x.label === 'Trust zone'), true);
  assert.equal(incidentCase.path.some(x => x.label === 'SERVER'), true);
  assert.equal(incidentCase.recommendations.some(x => x.kind === 'quarantine_attacker_port'), true);

  const plan = await manager.propose('quarantine_attacker_port', incidentCase.id);
  assert.equal(plan.incidentCaseId, incidentCase.id);

  const closed = manager.closeCase(incidentCase.id);
  assert.equal(closed.status, 'closed');
});


test('verified action loop keeps execution human-controlled and checks live evidence', async () => {
  const manager = createIncidentManager({ networkClient });
  const proposal = await manager.propose('quarantine_attacker_port');
  const approved = manager.decide(proposal.id, true);
  assert.equal(approved.status, 'approved-preview');
  assert.equal(approved.lifecycle.some(x => x.step === 'approved'), true);

  const simulated = await manager.simulate(proposal.id);
  assert.equal(simulated.status, 'simulated');
  assert.equal(simulated.simulation.result, 'safe-preview');
  assert.match(simulated.simulation.limitation, /does not emulate/i);

  const applied = manager.markApplied(proposal.id);
  assert.equal(applied.status, 'verification-pending');
  assert.equal(applied.lifecycle.some(x => x.step === 'manual-apply'), true);

  const verified = await manager.verify(proposal.id);
  assert.equal(verified.status, 'verification-failed');
  assert.match(verified.verification.detail, /still visible/i);

  const rollback = manager.requestRollback(proposal.id);
  assert.equal(rollback.rollbackState, 'operator-required');
  assert.equal(rollback.lifecycle.some(x => x.step === 'rollback-ready'), true);
});
