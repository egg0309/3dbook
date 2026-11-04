import { useSyncExternalStore } from 'react';

export type JourneyPhase = 'idle' | 'spinning' | 'opening' | 'open';

export interface JourneyState {
  phase: JourneyPhase;
  interacted: boolean;
  resetToken: number;
}

let state: JourneyState = {
  phase: 'idle',
  interacted: false,
  resetToken: 0,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribeJourney(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getJourneyState() {
  return state;
}

export function setJourneyPhase(phase: JourneyPhase) {
  if (state.phase === phase) return;
  state = { ...state, phase };
  emit();
}

export function markInteracted() {
  if (state.interacted) return;
  state = { ...state, interacted: true };
  emit();
}

export function resetJourney() {
  state = {
    phase: 'idle',
    interacted: false,
    resetToken: state.resetToken + 1,
  };
  emit();
}

export function useJourneyState() {
  return useSyncExternalStore(
    subscribeJourney,
    getJourneyState,
    getJourneyState,
  );
}

export function useResetToken() {
  return useSyncExternalStore(
    subscribeJourney,
    () => state.resetToken,
    () => state.resetToken,
  );
}

/** 每帧写入，供 DOM 进度条读取；刻意不触发 React 渲染 */
export const journeyProgress = {
  spin: 0,
  open: 0,
  total: 0,
};
