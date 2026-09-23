import { AgentRun } from './types';

const id = () => Math.random().toString(36).slice(2);
const event = (kind: AgentRun['events'][number]['kind'], title: string, detail = '') => ({ id: id(), kind, title, detail, at: new Date().toISOString() });
export function demoStart(prompt: string): AgentRun {
  return { id: id(), prompt, status: 'thinking', events: [event('thinking', '理解目标', '正在决定下一步动作…')], answer: '' };
}
export function demoAdvance(run: AgentRun, stage: number): AgentRun {
  if (stage === 1) return { ...run, events: [...run.events, event('tool', 'list_files', '扫描本地工作区'), event('success', '发现 3 份资料', 'product-brief.md · research-notes.md · roadmap.md')] };
  if (stage === 2) return { ...run, events: [...run.events, event('tool', 'read_file', '读取 product-brief.md'), event('success', '找到关键方向', '用户痛点、受众和产品定位已提取')] };
  return { ...run, status: 'approval', pending: { name: 'write_file', path: 'nova-plan.md', preview: '# 下一步行动\n\n1. 明确目标用户与关键问题\n2. 验证最有价值的功能\n3. 制作可分享的产品演示' }, events: [...run.events, event('tool', 'write_file', '准备生成 nova-plan.md'), event('approval', '等待你的决定', '写文件之前会先征求批准')] };
}
export function demoDecide(run: AgentRun, approved: boolean): AgentRun {
  const answer = approved ? '已完成演示：代理规划了步骤、读取了示例资料，并在得到批准后生成了行动文档。连接本地 Ollama 后，以上步骤会由真实模型决定并操作真实工作区。' : '已拒绝写入。代理会尊重你的决定，并给出不修改文件的建议。连接本地 Ollama 后即可执行真实任务。';
  return { ...run, pending: null, status: 'completed', answer, events: [...run.events, event(approved ? 'success' : 'denied', approved ? '演示写入已批准' : '写入已拒绝', approved ? '预览模式不会修改真实文件' : ''), event('final', '任务完成', answer)] };
}
