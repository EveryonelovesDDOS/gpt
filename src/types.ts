export type EventKind = 'thinking' | 'tool' | 'success' | 'approval' | 'denied' | 'final' | 'error';
export type AgentEvent = { id: string; kind: EventKind; title: string; detail: string; at: string };
export type AgentRun = {
  id: string; prompt: string; status: 'thinking' | 'approval' | 'resuming' | 'completed' | 'failed' | 'cancelled';
  events: AgentEvent[]; answer?: string; error?: string;
  pending?: { name: string; path: string; preview: string } | null;
};
export type Health = { online: boolean; model: string; modelReady: boolean };

export type NetworkDevice = { id: string; name: string; role: string; managementIp: string; ipAddresses: string[]; macAddress: string; interfaces: number; status: string; reachabilityStatus: string; collectionStatus: string; lastUpdated: string };
export type NetworkHealth = { controllerOnline: boolean; deviceCount: number; reachableCount: number; unreachableCount: number; allReachable: boolean; checkedAt: string; devices: NetworkDevice[] };

export type NetworkHost = { id: string; name: string; ip: string; ipAddresses: string[]; macAddress: string; hostType: string; connectedDeviceIp: string; connectedInterface: string; vlan: number | null; zone: string; trust: string; labThreatMarker: boolean };
export type TopologyNode = { id: string; kind: string; label: string; role: string; ip: string; status: string; zone: string; vlan?: number | null; trust?: string };
export type TopologyLink = { id: string; source: string; target: string; label: string; sourceType: string };
export type NetworkTopology = { nodes: TopologyNode[]; links: TopologyLink[]; physicalAvailable: boolean; rawPhysicalSummary: { keys: string[]; source: string } | null; generatedAt: string };
export type SecurityAlert = { id: string; severity: string; category: string; title: string; detail: string; evidence: Record<string, unknown> };
export type SecurityAnalysis = { posture: string; alertCount: number; criticalCount: number; highCount: number; hostCount: number; alerts: SecurityAlert[]; policy: { source: string; note: string }; checkedAt: string };

export type Incident = { id: string; severity: string; category: string; title: string; detail: string; evidence: Record<string, unknown>; status: string; firstSeen: string; lastSeen: string };
export type IncidentFrame = { id: string; at: string; posture: string; alertCount: number; incidents: Incident[] };
export type IncidentTimeline = { current: IncidentFrame; timeline: IncidentFrame[]; generatedAt: string };
export type DefensiveAction = { id: string; kind: string; title: string; target: string; summary: string; commands: string[]; rollback: string[]; risk: string; requiresApproval: boolean; executionMode: string; status: string; createdAt: string; decidedAt?: string; approved?: boolean; note: string };
