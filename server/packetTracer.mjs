const DEFAULT_TIMEOUT_MS = 4000;

function cleanBase(url) {
  return String(url || 'http://127.0.0.1:58000/api/v1').replace(/\/+$/, '');
}

async function parseResponse(response) {
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const detail = payload?.response?.message || payload?.response?.detail || payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`Packet Tracer Controller: ${detail}`);
  }
  return payload;
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

  function normalizeDevice(device) {
    const addresses = Array.isArray(device?.ipAddresses) ? device.ipAddresses : [];
    const managementIp = String(device?.managementIpAddress || addresses[0] || '');
    const isCore = managementIp === coreIp || addresses.includes(coreIp);
    const isEdge = managementIp === edgeIp || addresses.includes(edgeIp);
    return {
      id: String(device?.id || ''),
      name: isCore ? 'CORE-SW' : isEdge ? 'EDGE-RTR' : managementIp || 'Network Device',
      role: isCore ? 'core-switch' : isEdge ? 'edge-router' : 'network-device',
      managementIp,
      ipAddresses: addresses,
      macAddress: String(device?.macAddress || ''),
      interfaces: Number(device?.interfaceCount || 0),
      status: device?.reachabilityStatus === 'Reachable' ? 'online' : 'offline',
      reachabilityStatus: String(device?.reachabilityStatus || 'Unknown'),
      collectionStatus: String(device?.collectionStatus || 'Unknown'),
      lastUpdated: String(device?.lastUpdated || ''),
    };
  }

  async function getNetworkDevices() {
    const payload = await controllerGet('/network-device');
    const raw = Array.isArray(payload?.response) ? payload.response : [];
    return raw.map(normalizeDevice);
  }

  async function getNetworkHealth() {
    const devices = await getNetworkDevices();
    const reachable = devices.filter(device => device.status === 'online').length;
    return {
      controllerOnline: true,
      deviceCount: devices.length,
      reachableCount: reachable,
      unreachableCount: devices.length - reachable,
      allReachable: devices.length > 0 && reachable === devices.length,
      checkedAt: new Date().toISOString(),
      devices,
    };
  }

  return { authenticate, getNetworkDevices, getNetworkHealth, get baseUrl() { return base; } };
}
