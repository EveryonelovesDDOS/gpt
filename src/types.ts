export type EventKind = 'thinking' | 'tool' | 'success' | 'approval' | 'denied' | 'final' | 'error';
export type AgentEvent = { id: string; kind: EventKind; title: string; detail: string; at: string };
export type AgentEvidence = { tool: string; summary: string; at: string };
export type AgentAction = {
  id:string;
  type:'open-incident'|'show-path'|'show-blast-radius'|'focus-twin'|'ask';
  label:string;
  description:string;
  icon:string;
  tone:'danger'|'violet'|'amber'|'mint'|'neutral';
  payload:{ alertId?:string; source?:string; target?:string; asset?:string; prompt?:string };
};
export type AgentRun = {
  id: string;
  prompt: string;
  status: 'thinking' | 'approval' | 'resuming' | 'completed' | 'failed' | 'cancelled';
  events: AgentEvent[];
  evidence?: AgentEvidence[];
  answer?: string;
  followUps?: string[];
  actions?: AgentAction[];
  error?: string;
  pending?: { name: string; path: string; preview: string } | null;
};

export type Health = { online: boolean; model: string; modelReady: boolean };

export type NetworkDevice = {
  id: string; name: string; role: string; managementIp: string; ipAddresses: string[];
  macAddress: string; interfaces: number; status: string; reachabilityStatus: string;
  collectionStatus: string; lastUpdated: string;
};

export type NetworkHealth = {
  controllerOnline: boolean;
  deviceCount: number;
  reachableCount: number;
  unreachableCount: number;
  allReachable: boolean;
  hostCount?: number;
  securityPosture?: string;
  alertCount?: number;
  checkedAt: string;
  devices: NetworkDevice[];
};

export type NetworkHost = {
  id: string; name: string; ip: string; ipAddresses: string[]; macAddress: string; hostType: string;
  connectedDeviceIp: string; connectedInterface: string; vlan: number | null; zone: string; trust: string;
  labThreatMarker: boolean;
};

export type TopologyNode = {
  id: string; kind: string; label: string; role: string; ip: string; status: string; zone: string;
  vlan?: number | null; trust?: string;
};
export type TopologyLink = { id: string; source: string; target: string; label: string; sourceType: string };
export type NetworkTopology = {
  nodes: TopologyNode[];
  links: TopologyLink[];
  physicalAvailable: boolean;
  rawPhysicalSummary: { keys: string[]; source: string } | null;
  generatedAt: string;
};

export type SecurityAlert = {
  id: string; severity: string; category: string; title: string; detail: string; evidence: Record<string, unknown>;
};
export type SecurityAnalysis = {
  posture: string; alertCount: number; criticalCount: number; highCount: number; hostCount: number;
  alerts: SecurityAlert[]; policy: { source: string; note: string }; checkedAt: string;
};

export type Incident = {
  id: string; severity: string; category: string; title: string; detail: string;
  evidence: Record<string, unknown>; status: string; firstSeen: string; lastSeen: string; occurrences?: number;
};
export type IncidentFrame = { id: string; at: string; posture: string; alertCount: number; incidents: Incident[] };

export type IncidentEvidence = { label: string; value: string; source: string; certainty: string };
export type IncidentPathStep = { label: string; kind: string; detail: string; certainty: string };
export type IncidentRecommendation = { kind: string; label: string; priority: number };
export type IncidentCase = {
  id: string;
  alertId: string;
  status: string;
  severity: string;
  category: string;
  title: string;
  summary: string;
  openedAt: string;
  updatedAt: string;
  closedAt?: string;
  source: { name:string; ip:string; zone:string; vlan:number|null; trust:string; interface:string } | null;
  evidence: IncidentEvidence[];
  path: IncidentPathStep[];
  recommendations: IncidentRecommendation[];
  assessment: string;
  alertStatus?: string;
  autopilot?: {
    mode:string;
    autoOpened:boolean;
    status:string;
    reason:string;
    preparedAt:string;
    resolvedObservedAt?:string;
    humanApprovalRequired:boolean;
    recentChanges:{ id:string; at:string; title:string; severity:string; entity:string }[];
  };
  linkedActionIds?: string[];
};

export type IncidentTimeline = {
  current: IncidentFrame & { autoOpenedCaseIds?:string[] };
  timeline: (IncidentFrame & { autoOpenedCaseIds?:string[] })[];
  cases?: IncidentCase[];
  autopilot?: {
    mode:string;
    enabled:boolean;
    autoOpenSeverities:string[];
    humanApprovalRequired:boolean;
    note:string;
  };
  generatedAt: string;
};

export type ActionLifecycleEvent = { at:string; step:string; detail:string };
export type DefensiveAction = {
  id: string; kind: string; incidentCaseId?: string | null; title: string; target: string; summary: string;
  commands: string[]; rollback: string[]; risk: string; requiresApproval: boolean; executionMode: string;
  status: string; createdAt: string; decidedAt?: string; approved?: boolean; note: string;
  lifecycle?: ActionLifecycleEvent[];
  simulation?: {
    at:string;
    before:{ posture:string; alertCount:number; attacker:Record<string,unknown>|null; twinAssets:number|null; twinRelationships:number|null };
    expected:{ outcome:string; measurable:string[] };
    result:string;
    limitation:string;
  } | null;
  verification?: {
    at:string; outcome:string; detail:string;
    observed:{ posture:string; alertCount:number; attacker:Record<string,unknown>|null };
  } | null;
  rollbackState?: string;
  appliedExternallyAt?: string;
};

export type TelemetryChange = {
  id: string;
  at: string;
  type: string;
  severity: string;
  entity: string;
  title: string;
  detail: string;
  before?: unknown;
  after?: unknown;
};

export type TelemetrySnapshot = {
  current: { at: string; health: NetworkHealth; hosts: NetworkHost[]; security: SecurityAnalysis };
  changes: TelemetryChange[];
  generatedAt: string;
};


export type DigitalTwinNode = TopologyNode & {
  assetType:string;
  trustTier:string;
  interface:string;
  managementIp:string;
  macAddress:string;
  critical:boolean;
  labThreatMarker:boolean;
};
export type DigitalTwin = {
  generatedAt:string;
  nodes:DigitalTwinNode[];
  links:(TopologyLink & { certainty:string })[];
  zones:{ id:string; name:string; count:number; trustTier:string; vlan:number|null; members:string[] }[];
  relationships:{ id:string; source:string; sourceLabel:string; target:string; targetLabel:string; label:string; certainty:string }[];
  policy:{ id:string; sourceZone:string; targetZone:string; expectation:string; verification:string; reason:string }[];
  securitySummary:{ posture:string; alertCount:number; criticalCount:number; highCount:number };
  confidence:{ physicalTopology:string; endpointAttachments:string; policyEnforcement:string };
  operations:{
    attention:{ id:string; label:string; zone:string; trustTier:string; critical:boolean; degree:number; score:number; reasons:string[] }[];
    singlePointsOfFailure:{ id:string; label:string; zone:string; componentIncrease:number; separatedAssets:string[]; criticalSeparated:string[] }[];
    policyChecks:{ id:string; sourceZone:string; targetZone:string; expectation:string; verification:string; relationshipPath:boolean; sourceAssets:string[]; targetAssets:string[]; assessment:string }[];
    confidenceAudit:{ totalLinks:number; observed:number; knownLab:number; inferred:number; weakLinks:{ id:string; source:string; target:string; label:string }[] };
    note:string;
  };
};
export type PathAnalysis = {
  found:boolean;
  source:string;
  target:string;
  hops?:{ node:DigitalTwinNode; via:(TopologyLink & { certainty?:string })|null }[];
  relationshipPath?:boolean;
  reachability?:string;
  certainty?:string;
  policyExpectation?:DigitalTwin['policy'][number]|null;
  explanation?:string;
  reason?:string;
  generatedAt:string;
};
export type BlastRadius = {
  found:boolean;
  asset:string|{id:string;label:string;zone:string;trustTier:string};
  depth?:number;
  affected:{ id:string; label:string; zone:string; trustTier:string; critical:boolean; distance:number; certainty:string }[];
  criticalAssets?:{ id:string; label:string; zone:string; trustTier:string; critical:boolean; distance:number; certainty:string }[];
  note?:string;
  reason?:string;
  generatedAt:string;
};


export type DemoScenarioStage = {
  id:string;
  order:number;
  title:string;
  kicker:string;
  page:string;
  tone:string;
  state:'complete'|'active'|'ready'|'upcoming';
};

export type DemoScenario = {
  enabled:boolean;
  mode:string;
  scenarioId:string;
  title:string;
  description:string;
  startedAt:string|null;
  completedAt:string|null;
  current:{
    id:string;
    order:number;
    title:string;
    kicker:string;
    summary:string;
    page:string;
    tone:string;
    evidence:string[];
    progress:number;
    relationshipPath:string[];
    highlightedAssets:string[];
    recommendation:{ title:string; target:string; mode:string; rollbackReady:boolean }|null;
    verification:{ result:string; label:string; detail:string }|null;
  };
  stageIndex:number;
  stageCount:number;
  stages:DemoScenarioStage[];
  events:{ id:string; at:string; kind:string; title:string; detail:string }[];
  guardrails:string[];
  generatedAt:string;
};


export type FailureImpact = {
  found:boolean;
  asset:string|{id:string;label:string;zone:string;role:string};
  scenario?:string;
  severity?:'low'|'medium'|'high'|string;
  components?:{ id:string; assets:string[] }[];
  affected?:{ id:string; label:string; zone:string; critical:boolean; trustTier:string }[];
  criticalAffected?:{ id:string; label:string; zone:string; critical:boolean; trustTier:string }[];
  note?:string;
  generatedAt:string;
};

export type ResiliencePaths = {
  found:boolean;
  source:string;
  target:string;
  redundancy?:'none'|'single'|'multiple'|string;
  pathCount?:number;
  paths:{ id:string; hops:string[]; length:number }[];
  note?:string;
  generatedAt:string;
};

export type PolicyAudit = {
  checks:DigitalTwin['operations']['policyChecks'];
  confidence:string;
  note:string;
  generatedAt:string;
};
