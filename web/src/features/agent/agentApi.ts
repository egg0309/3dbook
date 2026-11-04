import { NEXT_STAGE } from './script';
import type {
  AgentStage,
  AgentTurnRequest,
  AgentTurnResponse,
} from './types';

export type AgentMode = 'mock' | 'live';

export const AGENT_MODE: AgentMode =
  import.meta.env.VITE_AGENT_MODE === 'live' ? 'live' : 'mock';

export const AGENT_API_URL =
  import.meta.env.VITE_AGENT_API_URL || '/api/chat';

const TIMEOUT_MS = 12000;

const VALID_STAGES: AgentStage[] = [
  'level1',
  'level2',
  'level3',
  'review',
  'done',
];

function isStage(value: unknown): value is AgentStage {
  return (
    typeof value === 'string' &&
    (VALID_STAGES as string[]).includes(value)
  );
}

function inferNextStage(
  request: AgentTurnRequest,
  hasReport: boolean,
): AgentStage {
  if (request.stage === 'review') return hasReport ? 'done' : 'review';
  if (request.choice) {
    return NEXT_STAGE[request.stage as keyof typeof NEXT_STAGE] ?? request.stage;
  }
  return request.stage;
}

function normalizeResponse(
  data: unknown,
  request: AgentTurnRequest,
): AgentTurnResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('推演接口返回格式不正确');
  }

  const payload = data as Record<string, unknown>;
  if (typeof payload.reply !== 'string' || !payload.reply.trim()) {
    throw new Error('推演接口没有返回有效台词');
  }

  const report =
    typeof payload.report === 'string' && payload.report.trim()
      ? payload.report
      : undefined;
  const nextStage = isStage(payload.nextStage)
    ? payload.nextStage
    : inferNextStage(request, Boolean(report));

  if (nextStage === 'done' && !report) {
    throw new Error('复盘报告缺失，请检查后端返回');
  }

  return {
    reply: payload.reply,
    nextStage,
    report,
    fallback: payload.fallback === true,
  };
}

export async function sendAgentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResponse> {
  if (AGENT_MODE === 'mock') {
    const { mockAgentTurn } = await import('./mockAgent');
    return mockAgentTurn(request);
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`推演接口返回 ${response.status}`);
    }

    const data: unknown = await response.json();
    return normalizeResponse(data, request);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error('推演接口超时，请稍后重试');
    }
    if (error instanceof TypeError) {
      throw new Error('无法连接推演服务，请检查后端是否已经启动');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}
