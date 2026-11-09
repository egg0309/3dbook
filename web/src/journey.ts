import { useSyncExternalStore } from 'react';
import type { ChapterId } from './config';

export type JourneyPhase = 'idle' | 'spinning' | 'opening' | 'open';

export interface JourneyState {
  phase: JourneyPhase;
  interacted: boolean;
  resetToken: number;
  /** 推门运镜期间为 true：此时卸载 OrbitControls，把镜头交给 useFrame */
  cinematic: boolean;
  /**
   * 步枪拖拽期间为 true：只临时禁用 OrbitControls。
   * 不能复用 cinematic —— 它还会切换相机视差倍率，拖拽一按下画面就会跳。
   */
  dragging: boolean;
  /** 当前阅读章节：决定书页背景与立体书机关使用哪套图层 */
  chapter: ChapterId;
  /**
   * 章节切换请求计数。
   * 点击右侧导航里的「05 雪山草地」时 +1，
   * Book 监听到后自动把书翻开，不需要用户再滚一轮滚轮。
   */
  openRequest: number;
}

let state: JourneyState = {
  phase: 'idle',
  interacted: false,
  resetToken: 0,
  cinematic: false,
  dragging: false,
  chapter: 'zunyi',
  openRequest: 0,
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

export function setCinematic(cinematic: boolean) {
  if (state.cinematic === cinematic) return;
  state = { ...state, cinematic };
  emit();
}

export function setDragging(dragging: boolean) {
  if (state.dragging === dragging) return;
  state = { ...state, dragging };
  emit();
}

/**
 * 切换章节。
 *
 * openRequest 同时 +1：即使书本还合着，Book 也会自动完成
 * 「旋转一周 → 展开 → 机关立起」，切到雪山草地就能直接看到分层。
 */
export function setChapter(chapter: ChapterId) {
  if (state.chapter === chapter) return;
  state = {
    ...state,
    chapter,
    openRequest: state.openRequest + 1,
  };
  emit();
}

/**
 * 首屏自动开卷：不换章节，只 +1 openRequest，
 * 让 Book 在场景就绪后自动转开，省去手动滚轮转书。
 */
export function requestOpen() {
  if (state.phase === 'opening' || state.phase === 'open') return;
  state = { ...state, openRequest: state.openRequest + 1 };
  emit();
}

export function resetJourney() {
  state = {
    ...state,
    phase: 'idle',
    interacted: false,
    resetToken: state.resetToken + 1,
    cinematic: false,
    dragging: false,
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

export function useOpenRequest() {
  return useSyncExternalStore(
    subscribeJourney,
    () => state.openRequest,
    () => state.openRequest,
  );
}

/** 每帧写入，供 DOM 进度条读取；刻意不触发 React 渲染 */
export const journeyProgress = {
  spin: 0,
  open: 0,
  total: 0,
};
