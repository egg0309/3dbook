import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import type { AnimationParams } from 'animejs';
import { CHAPTERS, SITE, getChapterMeta } from '../config';
import {
  resetJourney,
  setChapter,
  useJourneyState,
} from '../journey';

interface OverlayProps {
  ready: boolean;
  onOpenAgent: () => void;
  agentOpen?: boolean;
}

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return coarse;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Overlay({ ready, onOpenAgent, agentOpen }: OverlayProps) {
  const { phase, chapter, dragging } = useJourneyState();
  const meta = getChapterMeta(chapter);
  const rootRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLParagraphElement>(null);
  const coarse = useCoarsePointer();
  const isOpen = phase === 'open';

  /**
   * 雪山步枪拖拽提示。
   * 出现条件：雪山章节 + 书本完全展开（等价于 open.current > 0.99）；
   * 第一次按下 / 拖动步枪时 dragging 变 true，气泡淡出后本次会话不再出现。
   */
  const [snowHint, setSnowHint] = useState<'shown' | 'leaving' | 'dismissed'>(
    'shown',
  );

  useEffect(() => {
    if (!dragging) return;
    setSnowHint((current) => (current === 'shown' ? 'leaving' : current));
  }, [dragging]);

  useEffect(() => {
    if (snowHint !== 'leaving') return;
    const timer = window.setTimeout(() => setSnowHint('dismissed'), 480);
    return () => window.clearTimeout(timer);
  }, [snowHint]);

  useEffect(() => {
    if (!ready || !rootRef.current) return;
    const targets = rootRef.current.querySelectorAll('[data-intro]');

    if (prefersReducedMotion()) {
      targets.forEach((target) => {
        (target as HTMLElement).style.opacity = '1';
      });
      return;
    }

    const animation = animate(
      targets,
      {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 1100,
        delay: stagger(105, { start: 120 }),
        ease: 'outExpo',
      } as AnimationParams,
    );

    return () => {
      animation.pause();
    };
  }, [ready]);

  useEffect(() => {
    if (!isOpen || !buildingRef.current) return;
    if (prefersReducedMotion()) {
      buildingRef.current.style.opacity = '1';
      return;
    }
    animate(
      buildingRef.current,
      {
        opacity: [0, 1],
        translateY: [8, 0],
        duration: 850,
        delay: 450,
        ease: 'outCubic',
      } as AnimationParams,
    );
  }, [isOpen]);

  const hint =
    phase === 'idle'
      ? coarse
        ? '上下拖动 · 转动史书'
        : '滚动滚轮 · 转动史书'
      : phase === 'spinning'
        ? coarse
          ? '继续拖动 · 转过一周，书页自开'
          : '继续滚动 · 转过一周，书页自开'
        : phase === 'opening'
          ? '正在展开 · 请稍候'
          : `开卷 · ${meta.chapter}`;

  const snowHintVisible =
    chapter === 'snow' && isOpen && snowHint !== 'dismissed';

  return (
    <div
      ref={rootRef}
      className="overlay"
      data-phase={phase}
      data-ready={ready}
      data-agent-open={agentOpen ? 'true' : 'false'}
    >
      <header className="topbar">
        <div className="brand" data-intro>
          <span className="brand-star" aria-hidden="true">
            <svg viewBox="0 0 64 64" role="presentation">
              <path d="M32 3.5 40.2 24l22 .9-17.1 13.5 6.1 21.1L32 46.8 12.8 59.5l6.1-21.1L1.8 24.9l22-.9Z" />
            </svg>
          </span>
          <div className="brand-copy">
            <p className="brand-name">{SITE.brand}</p>
            <p className="brand-en">{SITE.brandEn}</p>
          </div>
        </div>

        <div className="topbar-meta" data-intro>
          <span>{SITE.platform}</span>
          <span className="topbar-rule" aria-hidden="true" />
          <span>
            {meta.index} · {meta.chapter}
          </span>
        </div>
      </header>

      <a className="home-entry" href="/home/">
        长征首页
      </a>

      <aside className="chapter-rail" data-intro aria-label="长征章节">
        <p className="rail-label">LONG MARCH · 1935</p>
        <ol>
          {CHAPTERS.map((item) => {
            const available = item.status === 'active';
            const selected = item.id === chapter;
            return (
              <li
                key={item.id}
                data-active={selected}
                data-available={available}
                data-status={item.status}
                aria-current={selected ? 'step' : undefined}
              >
                <button
                  type="button"
                  className="rail-item"
                  data-ui
                  disabled={!available}
                  aria-label={`${item.index} ${item.title}`}
                  onClick={() => setChapter(item.id)}
                >
                  <span className="rail-index">{item.index}</span>
                  <span className="rail-title">{item.title}</span>
                  <span className="rail-status">
                    {selected ? '阅读中' : available ? '可阅读' : '筹备中'}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="chapter-meta" data-intro>
        <p className="meta-index">
          {meta.index} / {meta.number}
        </p>
        <h1>{meta.chapter}</h1>
        <p className="meta-en">{meta.chapterEn}</p>
        <p className="meta-date">
          {meta.date} · {meta.location}
        </p>
        <p className="meta-tagline">{meta.tagline}</p>
        {isOpen && (
          <p className="meta-building" ref={buildingRef} data-ui>
            <span aria-hidden="true" />
            历史推演已就绪
          </p>
        )}
      </section>

      <div className="journey-ui" data-intro>
        <p className="journey-status" aria-live="polite">
          <span className="journey-dot" aria-hidden="true" />
          {hint}
        </p>
        <div className="journey-track" aria-hidden="true">
          <span className="journey-fill" />
        </div>
      </div>

      {snowHintVisible && (
        <div
          className="snow-hint"
          data-leaving={snowHint === 'leaving' ? 'true' : 'false'}
          role="status"
        >
          <span className="snow-hint-icon" aria-hidden="true">
            ❄️
          </span>
          <span>看看雪堆后面是什么？试着拖动看看。</span>
        </div>
      )}

      {isOpen && (
        <div className="action-bar">
          <button
            type="button"
            className="agent-launcher"
            data-ui
            onClick={onOpenAgent}
          >
            <span className="agent-launcher-star" aria-hidden="true">
              ✦
            </span>
            进入历史推演
          </button>
          <button
            type="button"
            className="reset-button"
            data-ui
            onClick={resetJourney}
          >
            <span aria-hidden="true">↺</span>
            重新翻阅
          </button>
        </div>
      )}
    </div>
  );
}
