export type EventKind = 'thinking' | 'tool' | 'success' | 'approval' | 'denied' | 'final' | 'error';
export type AgentEvent = { id: string; kind: EventKind; title: string; detail: string; at: string };
export type AgentRun = {
  id: string; prompt: string; status: 'thinking' | 'approval' | 'resuming' | 'completed' | 'failed' | 'cancelled';
  events: AgentEvent[]; answer?: string; error?: string;
  pending?: { name: string; path: string; preview: string } | null;
};
export type Health = { online: boolean; model: string; modelReady: boolean };
