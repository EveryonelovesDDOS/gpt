import test from 'node:test';
import assert from 'node:assert/strict';
import { createPacketTracerClient } from './packetTracer.mjs';

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('authenticates and normalizes CORE-SW and EDGE-RTR', async () => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/ticket')) {
      return jsonResponse(200, {
        response: { serviceTicket: 'test-ticket', sessionTimeout: 3600 },
        version: '1.0',
      });
    }
    if (String(url).endsWith('/network-device')) {
      assert.equal(options.headers['X-Auth-Token'], 'test-ticket');
      return jsonResponse(200, {
        response: [
          {
            id: 'core-id',
            interfaceCount: '33',
            ipAddresses: ['10.0.0.2'],
            managementIpAddress: '10.0.0.2',
            macAddress: '0001.4388.3D5C',
            reachabilityStatus: 'Reachable',
            collectionStatus: 'Unsupported',
          },
          {
            id: 'edge-id',
            interfaceCount: '4',
            ipAddresses: ['10.0.0.1', '203.0.113.1'],
            managementIpAddress: '10.0.0.1',
            macAddress: '0030.F219.26E7',
            reachabilityStatus: 'Reachable',
            collectionStatus: 'Unsupported',
          },
        ],
      });
    }
    throw new Error('unexpected request');
  };

  const client = createPacketTracerClient({
    username: 'controller-user',
    password: 'controller-password',
    fetcher,
  });

  const devices = await client.getNetworkDevices();
  assert.equal(devices.length, 2);
  assert.equal(devices[0].name, 'CORE-SW');
  assert.equal(devices[0].role, 'core-switch');
  assert.equal(devices[0].interfaces, 33);
  assert.equal(devices[0].status, 'online');
  assert.equal(devices[1].name, 'EDGE-RTR');
  assert.equal(devices[1].role, 'edge-router');

  const ticketCalls = calls.filter(call => call.url.endsWith('/ticket'));
  assert.equal(ticketCalls.length, 1);
});

test('summarizes network health', async () => {
  const fetcher = async url => {
    if (String(url).endsWith('/ticket')) {
      return jsonResponse(200, { response: { serviceTicket: 'ticket', sessionTimeout: 3600 } });
    }
    return jsonResponse(200, {
      response: [
        { managementIpAddress: '10.0.0.2', reachabilityStatus: 'Reachable', interfaceCount: '33' },
        { managementIpAddress: '10.0.0.1', reachabilityStatus: 'Unreachable', interfaceCount: '4' },
      ],
    });
  };

  const client = createPacketTracerClient({
    username: 'controller-user',
    password: 'controller-password',
    fetcher,
  });

  const health = await client.getNetworkHealth();
  assert.equal(health.deviceCount, 2);
  assert.equal(health.reachableCount, 1);
  assert.equal(health.unreachableCount, 1);
  assert.equal(health.allReachable, false);
});


test('discovers hosts, builds topology, and flags the lab attacker marker without claiming compromise', async () => {
  const fetcher = async url => {
    const value = String(url);
    if (value.endsWith('/ticket')) return jsonResponse(200, { response: { serviceTicket: 'ticket', sessionTimeout: 3600 } });
    if (value.endsWith('/network-device')) return jsonResponse(200, {
      response: [
        { id: 'core', managementIpAddress: '10.0.0.2', ipAddresses: ['10.0.0.2'], reachabilityStatus: 'Reachable', interfaceCount: '33' },
        { id: 'edge', managementIpAddress: '10.0.0.1', ipAddresses: ['10.0.0.1','203.0.113.1'], reachabilityStatus: 'Reachable', interfaceCount: '4' },
      ],
    });
    if (value.endsWith('/host')) return jsonResponse(200, {
      response: [
        { id: 'admin', hostName: 'ADMIN-PC', hostIp: '192.168.10.10', hostMac: 'AAAA.BBBB.0001', connectedNetworkDeviceIpAddress: '10.0.0.2', connectedInterfaceName: 'Fa0/1' },
        { id: 'attack', hostName: 'ATTACKER-PC', hostIp: '192.168.40.10', hostMac: 'AAAA.BBBB.0004', connectedNetworkDeviceIpAddress: '10.0.0.2', connectedInterfaceName: 'Fa0/4' },
      ],
    });
    if (value.endsWith('/topology/physical-topology')) return jsonResponse(404, { response: { message: 'not available' } });
    throw new Error('unexpected request ' + value);
  };

  const client = createPacketTracerClient({ username: 'user', password: 'pass', fetcher });
  const hosts = await client.getHosts();
  assert.equal(hosts.length, 2);
  assert.equal(hosts[1].zone, 'GUEST');
  assert.equal(hosts[1].vlan, 40);
  assert.equal(hosts[1].labThreatMarker, true);

  const topology = await client.getTopology();
  assert.equal(topology.nodes.some(node => node.label === 'ATTACKER-PC'), true);
  assert.equal(topology.links.some(link => link.label === 'Fa0/4'), true);

  const security = await client.getSecurityAnalysis();
  assert.equal(security.posture, 'critical');
  assert.equal(security.criticalCount, 1);
  assert.match(security.alerts[0].detail, /simulation signal/i);
});
