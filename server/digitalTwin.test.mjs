import test from 'node:test';
import assert from 'node:assert/strict';
import { createDigitalTwin } from './digitalTwin.mjs';

const networkClient = {
  async getNetworkDevices() {
    return [
      { id:'core', name:'CORE-SW', role:'core-switch', managementIp:'10.0.0.2', ipAddresses:['10.0.0.2'], macAddress:'aa', status:'online' },
      { id:'edge', name:'EDGE-RTR', role:'edge-router', managementIp:'10.0.0.1', ipAddresses:['10.0.0.1'], macAddress:'bb', status:'online' },
    ];
  },
  async getHosts() {
    return [
      { id:'attack', name:'ATTACKER-PC', ip:'192.168.40.66', macAddress:'cc', connectedInterface:'FastEthernet0/4', vlan:40, zone:'GUEST', trust:'untrusted', labThreatMarker:true },
      { id:'server', name:'SERVER', ip:'192.168.50.10', macAddress:'dd', connectedInterface:'FastEthernet0/5', vlan:50, zone:'SERVER', trust:'critical', labThreatMarker:false },
    ];
  },
  async getTopology() {
    return {
      nodes:[
        { id:'device:edge', kind:'device', label:'EDGE-RTR', role:'edge-router', ip:'10.0.0.1', status:'online', zone:'EDGE' },
        { id:'device:core', kind:'device', label:'CORE-SW', role:'core-switch', ip:'10.0.0.2', status:'online', zone:'CORE' },
        { id:'host:attack', kind:'host', label:'ATTACKER-PC', role:'attacker', ip:'192.168.40.66', status:'online', zone:'GUEST', vlan:40, trust:'untrusted' },
        { id:'host:server', kind:'host', label:'SERVER', role:'endpoint', ip:'192.168.50.10', status:'online', zone:'SERVER', vlan:50, trust:'critical' },
      ],
      links:[
        { id:'backbone', source:'device:edge', target:'device:core', label:'10.0.0.0/30 backbone', sourceType:'known-lab' },
        { id:'attack-link', source:'device:core', target:'host:attack', label:'FastEthernet0/4', sourceType:'controller' },
        { id:'server-link', source:'device:core', target:'host:server', label:'FastEthernet0/5', sourceType:'controller' },
      ],
      physicalAvailable:false,
    };
  },
  async getSecurityAnalysis() {
    return { posture:'critical', alertCount:2, criticalCount:1, highCount:1 };
  },
};

test('digital twin builds zones and confidence-labelled relationships', async () => {
  const twin=createDigitalTwin({networkClient});
  const model=await twin.build();
  assert.equal(model.nodes.length,4);
  assert.equal(model.links.length,3);
  assert.equal(model.zones.some(z=>z.name==='GUEST'&&z.vlan===40),true);
  assert.equal(model.relationships.find(r=>r.id==='attack-link').certainty,'observed');
  assert.equal(model.confidence.policyEnforcement,'not-verified');
});

test('path analysis distinguishes graph relationship from verified reachability', async () => {
  const twin=createDigitalTwin({networkClient});
  const result=await twin.path('ATTACKER-PC','SERVER');
  assert.equal(result.found,true);
  assert.equal(result.relationshipPath,true);
  assert.equal(result.reachability,'not-verified');
  assert.equal(result.hops.map(h=>h.node.label).join('>'),'ATTACKER-PC>CORE-SW>SERVER');
  assert.equal(result.policyExpectation.id,'guest-server-isolation');
});

test('blast radius returns adjacent critical assets with an explicit limitation', async () => {
  const twin=createDigitalTwin({networkClient});
  const result=await twin.blastRadius('CORE-SW',2);
  assert.equal(result.found,true);
  assert.equal(result.affected.some(a=>a.label==='SERVER'&&a.critical),true);
  assert.match(result.note,/not proof/i);
});
