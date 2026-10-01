import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryManager } from './telemetry.mjs';

let deviceStatus = 'online';
let hostVlan = 40;
let alertOn = true;

const networkClient = {
  async getNetworkHealth() {
    return {
      controllerOnline:true,
      deviceCount:2,
      reachableCount:deviceStatus==='online'?2:1,
      unreachableCount:deviceStatus==='online'?0:1,
      allReachable:deviceStatus==='online',
      devices:[
        { id:'core', name:'CORE-SW', managementIp:'10.0.0.2', status:deviceStatus },
        { id:'edge', name:'EDGE-RTR', managementIp:'10.0.0.1', status:'online' },
      ],
    };
  },
  async getHosts() {
    return [{ id:'attacker', name:'ATTACKER-PC', ip:'192.168.40.66', zone:hostVlan===40?'GUEST':'STAFF', vlan:hostVlan, connectedInterface:'FastEthernet0/4', labThreatMarker:true }];
  },
  async getSecurityAnalysis() {
    return {
      posture:alertOn?'critical':'normal',
      alertCount:alertOn?1:0,
      alerts:alertOn?[{ id:'lab-threat:attacker', severity:'critical', title:'ATTACKER-PC detected', detail:'Simulation marker.', evidence:{host:'ATTACKER-PC'} }]:[],
    };
  },
};

test('telemetry manager establishes a baseline then detects changes', async () => {
  deviceStatus='online'; hostVlan=40; alertOn=true;
  const manager=createTelemetryManager({networkClient});
  const baseline=await manager.sample();
  assert.equal(baseline.changes[0].type,'baseline');

  deviceStatus='offline';
  hostVlan=30;
  alertOn=false;
  const changed=await manager.sample();
  assert.equal(changed.changes.some(x=>x.type==='device-status'),true);
  assert.equal(changed.changes.some(x=>x.type==='host-segment-change'),true);
  assert.equal(changed.changes.some(x=>x.type==='alert-resolved'),true);
  assert.equal(changed.changes.some(x=>x.type==='posture-change'),true);
});
