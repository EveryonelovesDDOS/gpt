const DEFAULT_TIMEOUT_MS = 4000;

function cleanBase(url) {
  return String(url || 'http://127.0.0.1:58000/api/v1').replace(/\/+$/, '');
}

async function parseResponse(response) {
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.response?.message || payload?.response?.detail || payload?.message || payload?.error || `HTTP ${response.status}`;
    const error = new Error(`Packet Tracer Controller: ${detail}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

const first = (...values) => values.find(v => v !== undefined && v !== null && String(v).length > 0);
const list = value => Array.isArray(value) ? value : value ? [value] : [];
const text = value => value === undefined || value === null ? '' : String(value);

function subnetZone(ip) {
  if (/^192\.168\.10\./.test(ip)) return { vlan: 10, zone: 'ADMIN', trust: 'trusted' };
  if (/^192\.168\.20\./.test(ip)) return { vlan: 20, zone: 'FINANCE', trust: 'sensitive' };
  if (/^192\.168\.30\./.test(ip)) return { vlan: 30, zone: 'STAFF', trust: 'trusted' };
  if (/^192\.168\.40\./.test(ip)) return { vlan: 40, zone: 'GUEST', trust: 'untrusted' };
  if (/^192\.168\.50\./.test(ip)) return { vlan: 50, zone: 'SERVER', trust: 'critical' };
  if (/^192\.168\.99\./.test(ip)) return { vlan: 99, zone: 'MANAGEMENT', trust: 'critical' };
  if (/^203\.0\.113\./.test(ip)) return { vlan: null, zone: 'PUBLIC', trust: 'external' };
  return { vlan: null, zone: 'UNKNOWN', trust: 'unknown' };
}

export function createPacketTracerClient({
  baseUrl = process.env.PT_CONTROLLER_URL || 'http://127.0.0.1:58000/api/v1',
  username = process.env.PT_CONTROLLER_USERNAME || '',
  password = process.env.PT_CONTROLLER_PASSWORD || '',
  coreIp = process.env.NEXUS_CORE_IP || '10.0.0.2',
  edgeIp = process.env.NEXUS_EDGE_IP || '10.0.0.1',
  fetcher = fetch,
  timeoutMs = Number(process.env.PT_CONTROLLER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
} = {}) {
  const base = cleanBase(baseUrl);
  let ticket = '';
  let ticketExpiresAt = 0;

  async function authenticate() {
    if (!username || !password) throw new Error('Packet Tracer Controller credentials are not configured');
    if (ticket && Date.now() < ticketExpiresAt) return ticket;
    let response;
    try {
      response = await fetcher(`${base}/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      throw new Error(error?.name === 'TimeoutError'
        ? 'Packet Tracer Controller authentication timed out'
        : 'Cannot reach Packet Tracer Controller on localhost:58000');
    }
    const payload = await parseResponse(response);
    const nextTicket = payload?.response?.serviceTicket;
    if (!nextTicket) throw new Error('Packet Tracer Controller did not return a service ticket');
    ticket = nextTicket;
    const sessionSeconds = Number(payload?.response?.sessionTimeout || 3600);
    ticketExpiresAt = Date.now() + Math.max(30, sessionSeconds - 30) * 1000;
    return ticket;
  }

  async function controllerGet(path, retry = true) {
    const authToken = await authenticate();
    let response;
    try {
      response = await fetcher(`${base}${path}`, {
        headers: { 'X-Auth-Token': authToken },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new Error(error?.name === 'TimeoutError'
        ? 'Packet Tracer Controller request timed out'
        : 'Cannot reach Packet Tracer Controller on localhost:58000');
    }
    if ((response.status === 401 || response.status === 403) && retry) {
      ticket = '';
      ticketExpiresAt = 0;
      return controllerGet(path, false);
    }
    return parseResponse(response);
  }

  async function controllerGetOptional(path) {
    try { return await controllerGet(path); }
    catch (error) {
      if ([404, 501].includes(Number(error?.status))) return null;
      throw error;
    }
  }

  function normalizeDevice(device) {
    const addresses = list(device?.ipAddresses).map(text).filter(Boolean);
    const managementIp = text(first(device?.managementIpAddress, addresses[0]));
    const isCore = managementIp === coreIp || addresses.includes(coreIp);
    const isEdge = managementIp === edgeIp || addresses.includes(edgeIp);
    return {
      id: text(first(device?.id, device?.serialNumber, managementIp)),
      name: isCore ? 'CORE-SW' : isEdge ? 'EDGE-RTR' : text(first(device?.hostname, device?.name, managementIp, 'Network Device')),
      role: isCore ? 'core-switch' : isEdge ? 'edge-router' : 'network-device',
      managementIp,
      ipAddresses: addresses,
      macAddress: text(device?.macAddress),
      interfaces: Number(device?.interfaceCount || 0),
      status: device?.reachabilityStatus === 'Reachable' ? 'online' : 'offline',
      reachabilityStatus: text(first(device?.reachabilityStatus, 'Unknown')),
      collectionStatus: text(first(device?.collectionStatus, 'Unknown')),
      lastUpdated: text(device?.lastUpdated),
    };
  }

  function normalizeHost(host, index) {
    const ips = list(first(host?.hostIp, host?.ipAddresses, host?.ipAddress)).map(text).filter(Boolean);
    const ip = text(first(ips[0], host?.hostIpAddress));
    const zone = subnetZone(ip);
    const name = text(first(host?.hostName, host?.hostname, host?.name, `HOST-${index + 1}`));
    const connectedDeviceIp = text(first(host?.connectedNetworkDeviceIpAddress, host?.connectedDeviceIp, host?.networkDeviceIpAddress));
    const connectedInterface = text(first(host?.connectedInterfaceName, host?.interfaceName, host?.portName));
    const mac = text(first(host?.hostMac, host?.macAddress, host?.mac));
    const type = text(first(host?.hostType, host?.type, 'Wired'));
    const marker = /ATTACK|INTRUDER|HACK|RED[-_ ]?TEAM/i.test(name);
    return {
      id: text(first(host?.id, host?.hostId, mac, ip, name)),
      name,
      ip,
      ipAddresses: ips,
      macAddress: mac,
      hostType: type,
      connectedDeviceIp,
      connectedInterface,
      vlan: zone.vlan,
      zone: zone.zone,
      trust: zone.trust,
      labThreatMarker: marker,
    };
  }

  async function getNetworkDevices() {
    const payload = await controllerGet('/network-device');
    const raw = Array.isArray(payload?.response) ? payload.response : [];
    return raw.map(normalizeDevice);
  }

  async function getHosts() {
    const payload = await controllerGetOptional('/host');
    if (!payload) return [];
    const raw = Array.isArray(payload?.response)
      ? payload.response
      : Array.isArray(payload?.response?.items)
        ? payload.response.items
        : Array.isArray(payload?.response?.hosts)
          ? payload.response.hosts
          : [];
    return raw.map(normalizeHost);
  }

  async function getPhysicalTopologyRaw() {
    const payload = await controllerGetOptional('/topology/physical-topology');
    return payload?.response || null;
  }

  async function getTopology() {
    const [devices, hosts, physical] = await Promise.all([
      getNetworkDevices(),
      getHosts(),
      getPhysicalTopologyRaw(),
    ]);

    const nodes = [
      ...devices.map(d => ({ id: `device:${d.id}`, kind: 'device', label: d.name, role: d.role, ip: d.managementIp, status: d.status, zone: d.role === 'edge-router' ? 'EDGE' : 'CORE' })),
      ...hosts.map(h => ({ id: `host:${h.id}`, kind: 'host', label: h.name, role: h.labThreatMarker ? 'attacker' : 'endpoint', ip: h.ip, status: 'online', zone: h.zone, vlan: h.vlan, trust: h.trust })),
    ];

    const links = [];
    const deviceByIp = new Map();
    devices.forEach(d => d.ipAddresses.concat(d.managementIp).filter(Boolean).forEach(ip => deviceByIp.set(ip, d)));

    for (const h of hosts) {
      const device = deviceByIp.get(h.connectedDeviceIp) || devices.find(d => d.role === 'core-switch');
      if (device) links.push({
        id: `hostlink:${h.id}:${device.id}`,
        source: `device:${device.id}`,
        target: `host:${h.id}`,
        label: h.connectedInterface || (h.vlan ? `VLAN ${h.vlan}` : ''),
        sourceType: h.connectedDeviceIp ? 'controller' : 'inferred',
      });
    }

    const core = devices.find(d => d.role === 'core-switch');
    const edge = devices.find(d => d.role === 'edge-router');
    if (core && edge) links.push({
      id: 'backbone:edge-core',
      source: `device:${edge.id}`,
      target: `device:${core.id}`,
      label: '10.0.0.0/30 backbone',
      sourceType: 'known-lab',
    });

    return {
      nodes,
      links,
      physicalAvailable: Boolean(physical),
      rawPhysicalSummary: physical ? {
        keys: Object.keys(physical).slice(0, 12),
        source: 'Packet Tracer physical-topology endpoint',
      } : null,
      generatedAt: new Date().toISOString(),
    };
  }

  async function getSecurityAnalysis() {
    const [devices, hosts] = await Promise.all([getNetworkDevices(), getHosts()]);
    const alerts = [];

    for (const d of devices) {
      if (d.status !== 'online') alerts.push({
        id: `device-offline:${d.id}`,
        severity: 'high',
        category: 'availability',
        title: `${d.name} is unreachable`,
        detail: `Controller reachability is ${d.reachabilityStatus}.`,
        evidence: { device: d.name, managementIp: d.managementIp },
      });
    }

    for (const h of hosts) {
      if (h.labThreatMarker) alerts.push({
        id: `lab-threat:${h.id}`,
        severity: 'critical',
        category: 'lab-threat-marker',
        title: `${h.name} detected`,
        detail: 'Host name matches the lab threat-marker convention. Treat this as a simulation signal, not proof of malicious activity.',
        evidence: { host: h.name, ip: h.ip, zone: h.zone, vlan: h.vlan, interface: h.connectedInterface },
      });
      if (h.zone === 'GUEST') alerts.push({
        id: `guest-zone:${h.id}`,
        severity: h.labThreatMarker ? 'high' : 'info',
        category: 'segmentation',
        title: `${h.name} is in the untrusted guest zone`,
        detail: 'VLAN 40 is classified by the NEXUS lab policy as untrusted. Verify ACL isolation from server and management zones.',
        evidence: { host: h.name, ip: h.ip, vlan: 40, interface: h.connectedInterface },
      });
    }

    const critical = alerts.filter(a => a.severity === 'critical').length;
    const high = alerts.filter(a => a.severity === 'high').length;
    const posture = critical ? 'critical' : high ? 'warning' : 'normal';
    return {
      posture,
      alertCount: alerts.length,
      criticalCount: critical,
      highCount: high,
      hostCount: hosts.length,
      alerts,
      policy: {
        source: 'NEXUS lab heuristics',
        note: 'Alerts are based on controller reachability, lab naming conventions, and the known VLAN address plan. They are not IDS/IPS verdicts.',
      },
      checkedAt: new Date().toISOString(),
    };
  }

  async function getNetworkHealth() {
    const [devices, hosts, security] = await Promise.all([getNetworkDevices(), getHosts(), getSecurityAnalysis()]);
    const reachable = devices.filter(device => device.status === 'online').length;
    return {
      controllerOnline: true,
      deviceCount: devices.length,
      reachableCount: reachable,
      unreachableCount: devices.length - reachable,
      allReachable: devices.length > 0 && reachable === devices.length,
      hostCount: hosts.length,
      securityPosture: security.posture,
      alertCount: security.alertCount,
      checkedAt: new Date().toISOString(),
      devices,
    };
  }

  return {
    authenticate,
    getNetworkDevices,
    getNetworkHealth,
    getHosts,
    getTopology,
    getSecurityAnalysis,
    get baseUrl() { return base; },
  };
}
