export type AgentStage =
  | 'level1'
  | 'level2'
  | 'level3'
  | 'review'
  | 'done';

export type ChoiceCode = `${1 | 2 | 3}${'A' | 'B' | 'C' | 'D'}`;

export interface AgentChoices {
  choice_1?: ChoiceCode;
  choice_2?: ChoiceCode;
  choice_3?: ChoiceCode;
}

export interface AgentTurnRequest {
  sessionId: string;
  /** 当前玩家正在回答的关卡；复盘时为 review */
  stage: AgentStage;
  /** 点击选项卡片时发送 */
  choice?: ChoiceCode;
  /** 自由输入或复盘指令时发送 */
  message?: string;
  /** 已累计的选择，方便后端无状态处理与生成复盘 */
  choices: AgentChoices;
}

export interface AgentTurnResponse {
  reply: string;
  nextStage: AgentStage;
  /** nextStage 为 done 时必填 */
  report?: string;
  /** 后端判定为“非选项输入”时可置 true，前端会保留当前选项 */
  fallback?: boolean;
}

export interface AgentOption {
  code: ChoiceCode;
  label: string;
}

export type AgentLevelStage = 'level1' | 'level2' | 'level3';

export interface AgentLevel {
  stage: AgentLevelStage;
  index: 1 | 2 | 3;
  title: string;
  focus: string;
  options: AgentOption[];
}

export type AgentMessageRole = 'narration' | 'npc' | 'user' | 'system';

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  text: string;
  code?: ChoiceCode;
  failed?: boolean;
}
