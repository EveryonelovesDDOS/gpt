import { Category, Plan, uid } from './model';

export type Draft = { title: string; summary: string; category: Category; minutes: number; steps: string[] };

export function validateDraft(value: unknown): Draft {
  if (!value || typeof value !== 'object') throw new Error('整理结果格式不正确');
  const v = value as Record<string, unknown>;
  const categories = ['工作', '生活', '学习', '其他'];
  if (typeof v.title !== 'string' || !v.title.trim() || v.title.length > 80 ||
    typeof v.summary !== 'string' || v.summary.length > 160 ||
    !categories.includes(String(v.category)) ||
    typeof v.minutes !== 'number' || !Number.isFinite(v.minutes) || v.minutes < 5 || v.minutes > 120 ||
    !Array.isArray(v.steps) || v.steps.length < 1 || v.steps.length > 5 ||
    !v.steps.every(s => typeof s === 'string' && !!s.trim() && s.length <= 100)) {
    throw new Error('整理结果不完整，请重试');
  }
  return {
    title: v.title.trim(), summary: v.summary.trim(), category: v.category as Category,
    minutes: Math.round(v.minutes), steps: v.steps.map((s: string) => s.trim()),
  };
}

export function makePlan(raw: string, draft: Draft, source: Plan['source']): Plan {
  return {
    id: uid(), raw: raw.trim(), title: draft.title, summary: draft.summary,
    category: draft.category, minutes: draft.minutes,
    steps: draft.steps.map(title => ({ id: uid(), title, done: false })),
    createdAt: new Date().toISOString(), source,
  };
}

export function demoDraft(raw: string): Draft {
  const clean = raw.replace(/\s+/g, ' ').trim();
  const title = clean.length > 34 ? `${clean.slice(0, 33)}…` : clean;
  const category: Category = /会议|客户|报告|工作|邮件|同事|老板/.test(clean) ? '工作'
    : /考试|论文|课程|学习|复习/.test(clean) ? '学习'
      : /买|家|健康|朋友|房/.test(clean) ? '生活' : '其他';
  return {
    title, summary: '先把这件事缩小为一个可以开始的动作。', category, minutes: 25,
    steps: ['写下一句你想达成的结果', '花 10 分钟完成最容易开始的一部分', '检查进度，并决定下一步'],
  };
}

export async function generateDraft(raw: string): Promise<Draft> {
  const endpoint = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!endpoint) throw new Error('AI 服务尚未配置。你可以先使用演示整理。');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: raw }), signal: controller.signal,
    });
    const json = await response.json();
    if (!response.ok) throw new Error(typeof json.error === 'string' ? json.error : 'AI 服务暂时不可用');
    return validateDraft(json);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('请求超时，请稍后再试');
    throw error;
  } finally { clearTimeout(timeout); }
}
