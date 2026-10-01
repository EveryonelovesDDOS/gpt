import { randomUUID } from 'node:crypto';

const nowIso = () => new Date().toISOString();

function toMap(items, key) {
  const map = new Map();
  for (const item of items || []) map.set(key(item), item);
  return map;
}

export function createTelemetryManager({ networkClient }) {
  let previous = null;
  const history = [];

  const add = event => {
    const item = { id: randomUUID(), at: nowIso(), ...event };
    history.unshift(item);
    if (history.length > 80) history.length = 80;
    return item;
  };

  function compare(next) {
    if (!previous) {
      previous = next;
      add({
        type: 'baseline',
        severity: 'info',
        entity: 'network',
        title: 'Live baseline established',
        detail: `${next.health.deviceCount} infrastructure devices, ${next.hosts.length} hosts and ${next.security.alertCount} security signals are now being tracked.`,
      });
      return;
    }

    const oldDevices = toMap(previous.health.devices, x => x.id);
    const nextDevices = toMap(next.health.devices, x => x.id);
    for (const [id, device] of nextDevices) {
      const before = oldDevices.get(id);
      if (!before) {
        add({ type:'device-added', severity:'info', entity:device.name, title:`${device.name} discovered`, detail:`Management IP ${device.managementIp || 'unknown'} is now visible to NEXUS.`, before:null, after:device.status });
      } else if (before.status !== device.status) {
        add({ type:'device-status', severity:device.status === 'online' ? 'info' : 'high', entity:device.name, title:`${device.name} is now ${device.status}`, detail:`Reachability changed from ${before.status} to ${device.status}.`, before:before.status, after:device.status });
      }
    }
    for (const [id, device] of oldDevices) if (!nextDevices.has(id)) {
      add({ type:'device-removed', severity:'high', entity:device.name, title:`${device.name} disappeared from inventory`, detail:'The device was present in the previous live snapshot but is no longer returned by the controller.', before:'present', after:'missing' });
    }

    const oldHosts = toMap(previous.hosts, x => x.id || x.ip || x.name);
    const nextHosts = toMap(next.hosts, x => x.id || x.ip || x.name);
    for (const [id, host] of nextHosts) {
      const before = oldHosts.get(id);
      if (!before) {
        add({ type:'host-added', severity:host.labThreatMarker ? 'critical' : 'info', entity:host.name, title:`${host.name} appeared on the network`, detail:`${host.ip || 'Unknown IP'} · ${host.zone || 'UNKNOWN'}${host.vlan ? ` · VLAN ${host.vlan}` : ''}`, before:null, after:host.zone });
        continue;
      }
      if (before.vlan !== host.vlan || before.zone !== host.zone) {
        add({
          type:'host-segment-change',
          severity:host.zone === 'GUEST' ? 'high' : 'medium',
          entity:host.name,
          title:`${host.name} changed network segment`,
          detail:`${before.zone || 'UNKNOWN'}${before.vlan ? ` / VLAN ${before.vlan}` : ''} → ${host.zone || 'UNKNOWN'}${host.vlan ? ` / VLAN ${host.vlan}` : ''}.`,
          before:{ zone:before.zone, vlan:before.vlan },
          after:{ zone:host.zone, vlan:host.vlan },
        });
      }
      if (before.connectedInterface !== host.connectedInterface && (before.connectedInterface || host.connectedInterface)) {
        add({
          type:'host-port-change',
          severity:'medium',
          entity:host.name,
          title:`${host.name} attachment changed`,
          detail:`${before.connectedInterface || 'unknown port'} → ${host.connectedInterface || 'unknown port'}.`,
          before:before.connectedInterface || null,
          after:host.connectedInterface || null,
        });
      }
    }
    for (const [id, host] of oldHosts) if (!nextHosts.has(id)) {
      add({ type:'host-removed', severity:host.labThreatMarker ? 'high' : 'medium', entity:host.name, title:`${host.name} left the network`, detail:`${host.ip || 'Unknown IP'} was present in the previous snapshot.`, before:'present', after:'missing' });
    }

    const oldAlerts = toMap(previous.security.alerts, x => x.id);
    const nextAlerts = toMap(next.security.alerts, x => x.id);
    for (const [id, alert] of nextAlerts) if (!oldAlerts.has(id)) {
      add({ type:'alert-opened', severity:alert.severity, entity:alert.evidence?.host || alert.evidence?.device || 'network', title:alert.title, detail:alert.detail, before:'clear', after:'active' });
    }
    for (const [id, alert] of oldAlerts) if (!nextAlerts.has(id)) {
      add({ type:'alert-resolved', severity:'info', entity:alert.evidence?.host || alert.evidence?.device || 'network', title:`${alert.title} cleared`, detail:'This signal is no longer present in the latest NEXUS security analysis.', before:'active', after:'clear' });
    }

    if (previous.security.posture !== next.security.posture) {
      add({
        type:'posture-change',
        severity:next.security.posture === 'critical' ? 'critical' : next.security.posture === 'warning' ? 'high' : 'info',
        entity:'network',
        title:`Security posture changed to ${next.security.posture}`,
        detail:`${previous.security.posture} → ${next.security.posture}.`,
        before:previous.security.posture,
        after:next.security.posture,
      });
    }

    previous = next;
  }

  async function sample() {
    const [health, hosts, security] = await Promise.all([
      networkClient.getNetworkHealth(),
      networkClient.getHosts(),
      networkClient.getSecurityAnalysis(),
    ]);
    const snapshot = { at: nowIso(), health, hosts, security };
    compare(snapshot);
    return {
      current: snapshot,
      changes: history.slice(0, 30),
      generatedAt: nowIso(),
    };
  }

  function list() {
    return { changes: history.slice(0, 30), generatedAt: nowIso() };
  }

  return { sample, list };
}
