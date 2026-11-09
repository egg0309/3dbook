import { useCallback, useReducer, useRef } from 'react';
import { AGENT_MODE, sendAgentTurn } from './agentApi';
import { createOpeningMessages, LEVEL_BY_STAGE } from './script';
import type {
  AgentChoices,
  AgentMessage,
  AgentOption,
  AgentStage,
  AgentTurnRequest,
  ChoiceCode,
} from './types';

interface AgentState {
  messages: AgentMessage[];
  stage: AgentStage;
  choices: AgentChoices;
  loading: boolean;
  error: string | null;
  report: string | null;
  sessionId: string;
}

type Action =
  | { type: 'START'; message: AgentMessage }
  | {
      type: 'SUCCESS';
      reply: string;
      nextStage: AgentStage;
      report?: string;
      fallback?: boolean;
      choice?: ChoiceCode;
      stageAtRequest: AgentStage;
    }
  | { type: 'ERROR'; messageId: string; error: string }
  | { type: 'RESET'; sessionId: string; messages: AgentMessage[] };

let idCounter = 0;

function makeId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialState(): AgentState {
  return {
    messages: createOpeningMessages(),
    stage: 'level1',
    choices: {},
    loading: false,
    error: null,
    report: null,
    sessionId: makeSessionId(),
  };
}

function mergeChoice(
  stage: AgentStage,
  choice: ChoiceCode,
  choices: AgentChoices,
): AgentChoices {
  if (stage === 'level1') return { ...choices, choice_1: choice };
  if (stage === 'level2') return { ...choices, choice_2: choice };
  if (stage === 'level3') return { ...choices, choice_3: choice };
  return choices;
}

function reducer(state: AgentState, action: Action): AgentState {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        loading: true,
        error: null,
        messages: [
          ...state.messages.filter((message) => !message.failed),
          action.message,
        ],
      };
    case 'SUCCESS': {
      const advanced = action.nextStage !== action.stageAtRequest;
      const choices =
        advanced && action.choice
          ? mergeChoice(action.stageAtRequest, action.choice, state.choices)
          : state.choices;
      const npcMessage: AgentMessage = {
        id: makeId('npc'),
        role: 'npc',
        text: action.reply,
      };
      return {
        ...state,
        loading: false,
        error: null,
        messages: [...state.messages, npcMessage],
        stage: action.nextStage,
        choices,
        report: action.report ?? state.report,
      };
    }
    case 'ERROR':
      return {
        ...state,
        loading: false,
        error: action.error,
        messages: state.messages.map((message) =>
          message.id === action.messageId
            ? { ...message, failed: true }
            : message,
        ),
      };
    case 'RESET':
      return {
        messages: action.messages,
        stage: 'level1',
        choices: {},
        loading: false,
        error: null,
        report: null,
        sessionId: action.sessionId,
      };
    default:
      return state;
  }
}

export function useAgent() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const pendingRef = useRef<{
    payload: AgentTurnRequest;
    text: string;
    code?: ChoiceCode;
  } | null>(null);
  const busyRef = useRef(false);
  const epochRef = useRef(0);

  const runTurn = useCallback(
    async (payload: AgentTurnRequest, text: string, code?: ChoiceCode) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const epoch = epochRef.current;
      const userMessage: AgentMessage = {
        id: makeId('user'),
        role: 'user',
        text,
        code,
      };
      pendingRef.current = { payload, text, code };
      dispatch({ type: 'START', message: userMessage });

      try {
        const response = await sendAgentTurn(payload);
        if (epoch !== epochRef.current) return;
        pendingRef.current = null;
        dispatch({
          type: 'SUCCESS',
          reply: response.reply,
          nextStage: response.nextStage,
          report: response.report,
          fallback: response.fallback,
          choice: payload.choice,
          stageAtRequest: payload.stage,
        });
      } catch (error) {
        if (epoch !== epochRef.current) return;
        dispatch({
          type: 'ERROR',
          messageId: userMessage.id,
          error:
            error instanceof Error && error.message
              ? error.message
              : '联络中断，请稍后再试',
        });
      } finally {
        if (epoch === epochRef.current) busyRef.current = false;
      }
    },
    [],
  );

  const choose = useCallback(
    (option: AgentOption) => {
      if (state.loading || busyRef.current) return;
      if (
        state.stage !== 'level1' &&
        state.stage !== 'level2' &&
        state.stage !== 'level3'
      ) {
        return;
      }
      const stageNumber = state.stage.slice(-1);
      if (option.code[0] !== stageNumber) return;
      void runTurn(
        {
          sessionId: state.sessionId,
          stage: state.stage,
          choice: option.code,
          choices: state.choices,
        },
        option.label,
        option.code,
      );
    },
    [state, runTurn],
  );

  const review = useCallback(() => {
    if (state.loading || busyRef.current || state.stage !== 'review') return;
    void runTurn(
      {
        sessionId: state.sessionId,
        stage: 'review',
        message: '复盘',
        choices: state.choices,
      },
      '复盘',
    );
  }, [state, runTurn]);

  const submitText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || state.loading || busyRef.current || state.stage === 'done') {
        return;
      }

      if (state.stage === 'review') {
        if (text === '复盘') {
          review();
        } else {
          void runTurn(
            {
              sessionId: state.sessionId,
              stage: 'review',
              message: text,
              choices: state.choices,
            },
            text,
          );
        }
        return;
      }

      const currentLevel = LEVEL_BY_STAGE[state.stage];
      const option = currentLevel.options.find(
        (item) => item.code === text.toUpperCase(),
      );
      if (option) {
        choose(option);
        return;
      }

      void runTurn(
        {
          sessionId: state.sessionId,
          stage: state.stage,
          message: text,
          choices: state.choices,
        },
        text,
      );
    },
    [state, choose, review, runTurn],
  );

  const retry = useCallback(() => {
    if (state.loading || busyRef.current) return;
    const pending = pendingRef.current;
    if (!pending) return;
    void runTurn(pending.payload, pending.text, pending.code);
  }, [state.loading, runTurn]);

  const reset = useCallback(() => {
    epochRef.current += 1;
    busyRef.current = false;
    pendingRef.current = null;
    dispatch({
      type: 'RESET',
      sessionId: makeSessionId(),
      messages: createOpeningMessages(),
    });
  }, []);

  const currentLevel =
    state.stage === 'level1' ||
    state.stage === 'level2' ||
    state.stage === 'level3'
      ? LEVEL_BY_STAGE[state.stage]
      : null;

  return {
    ...state,
    mode: AGENT_MODE,
    currentLevel,
    choose,
    submitText,
    review,
    retry,
    reset,
  };
}
