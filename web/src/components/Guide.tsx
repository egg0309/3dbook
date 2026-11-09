import { useEffect, useState } from 'react';
import { useJourneyState } from '../journey';

interface GuideProps {
  ready: boolean;
}

/**
 * 开场操作提示。
 *
 * - 加载完成后出现在屏幕正下方；
 * - 内层做 2s 呼吸动画，外层负责淡出；
 * - 用户第一次滚动 / 滑动 / 按方向键，或书本已经进入 spinning，
 *   立即淡出并在过渡结束后卸载，不会再次出现。
 */
export function Guide({ ready }: GuideProps) {
  const { phase } = useJourneyState();
  const [dismissed, setDismissed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready || dismissed) return;

    const dismiss = () => setDismissed(true);

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === ' '
      ) {
        dismiss();
      }
    };

    // 书是“滚轮/滑动”驱动的，页面本身不滚动，所以直接监听这些输入事件
    window.addEventListener('wheel', dismiss, { passive: true });
    window.addEventListener('touchmove', dismiss, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('touchmove', dismiss);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [ready, dismissed]);

  // 即使用户通过其他方式触发翻书，也跟随 journey 状态收起
  useEffect(() => {
    if (phase !== 'idle') setDismissed(true);
  }, [phase]);

  // 等透明度过渡结束再卸载，避免提示层“啪”地消失
  useEffect(() => {
    if (!dismissed) return;
    const timer = window.setTimeout(() => setGone(true), 520);
    return () => window.clearTimeout(timer);
  }, [dismissed]);

  if (!ready || gone) return null;

  return (
    <div
      className={`guide${dismissed ? ' is-dismissed' : ''}`}
      role="status"
      aria-live="polite"
      aria-hidden={dismissed}
    >
      <div className="guide-panel">
        <span className="guide-mark" aria-hidden="true" />
        <p className="guide-text">
          向下滚动滚轮 / 滑动屏幕，翻开长征立体书
        </p>
        <span className="guide-arrow" aria-hidden="true">
          ↓
        </span>
      </div>
    </div>
  );
}
