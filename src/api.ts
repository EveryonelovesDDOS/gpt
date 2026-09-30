import { AgentRun, Health, NetworkDevice, NetworkHealth, NetworkHost, NetworkTopology, SecurityAnalysis } from './types';

export const defaultEndpoint = () => {
  if (typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')) {
    if (window.location.port === '8787') return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}:8787`;
  }
  return 'http://127.0.0.1:8787';
};
async function request<T>(base: string, path: string, token = '', method = 'GET', payload?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      body: payload ? JSON.stringify(payload) : undefined, signal: controller.signal,
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || `请求失败（${response.status}）`);
    return json as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('本地服务响应超时');
    throw e;
  } finally { clearTimeout(timeout); }
}
export const checkHealth = (base: string) => request<Health>(base, '/api/health');
export const getFiles = (base: string, token: string) => request<{ files: string[] }>(base, '/api/files', token);
export const getFile = (base: string, token: string, name: string) => request<{ name: string; content: string }>(base, `/api/files/${encodeURIComponent(name)}`, token);
export const startRun = (base: string, token: string, prompt: string) => request<AgentRun>(base, '/api/runs', token, 'POST', { prompt });
export const getRun = (base: string, token: string, id: string) => request<AgentRun>(base, `/api/runs/${id}`, token);
export const decideRun = (base: string, token: string, id: string, approved: boolean) => request<AgentRun>(base, `/api/runs/${id}/decision`, token, 'POST', { approved });
export const cancelRun = (base: string, token: string, id: string) => request<AgentRun>(base, `/api/runs/${id}/cancel`, token, 'POST');

export const getNetworkDevices = (base: string, token: string) => request<{ devices: NetworkDevice[] }>(base, '/api/network/devices', token);
export const getNetworkHealth = (base: string, token: string) => request<NetworkHealth>(base, '/api/network/health', token);

export const getNetworkHosts = (base: string, token: string) => request<{ hosts: NetworkHost[] }>(base, '/api/network/hosts', token);
export const getNetworkTopology = (base: string, token: string) => request<NetworkTopology>(base, '/api/network/topology', token);
export const getSecurityAnalysis = (base: string, token: string) => request<SecurityAnalysis>(base, '/api/network/security', token);
