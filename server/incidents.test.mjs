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
