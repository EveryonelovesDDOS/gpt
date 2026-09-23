export type Category = '工作' | '生活' | '学习' | '其他';
export type Step = { id: string; title: string; done: boolean };
export type Plan = {
  id: string;
  raw: string;
  title: string;
  summary: string;
  category: Category;
  minutes: number;
  steps: Step[];
  createdAt: string;
  completedAt?: string;
  source: 'ai' | 'demo';
};
export type FocusSession = { id: string; planId: string; minutes: number; endedAt: string };
export type State = { plans: Plan[]; sessions: FocusSession[] };

export const starter: State = { plans: [], sessions: [] };
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
export const complete = (plan: Plan) => plan.steps.length > 0 && plan.steps.every(step => step.done);
export const remaining = (plan: Plan) => plan.steps.filter(step => !step.done).length;
export const localDay = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
export const isToday = (iso: string) => localDay(new Date(iso)) === localDay(new Date());
export const isThisWeek = (iso: string) => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return new Date(iso) >= start;
};
