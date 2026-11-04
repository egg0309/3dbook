import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import type { AnimationParams } from 'animejs';
import { CHAPTERS, SITE } from '../config';
import { resetJourney, useJourneyState } from '../journey';

interface OverlayProps {
  ready: boolean;
  onOpenAgent: () => void;
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

export function Overlay({ ready, onOpenAgent }: OverlayProps) {
  const { phase } = useJourneyState();
  const rootRef = useRef<HTMLDivElement>(null);
  const buildingRef = useRef<HTMLParagraphElement>(null);
  const coarse = useCoarsePointer();
  const isOpen = phase === 'open';

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
          : '开卷 · 遵义会议';

  return (
    <div
      ref={rootRef}
      className="overlay"
      data-phase={phase}
      data-ready={ready}
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
            {SITE.chapterIndex} · {SITE.chapter}
          </span>
        </div>
      </header>

      <aside className="chapter-rail" data-intro aria-label="长征章节">
        <p className="rail-label">LONG MARCH · 1935</p>
        <ol>
          {CHAPTERS.map((chapter) => (
            <li
              key={chapter.id}
              data-active={chapter.status === 'active'}
              data-status={chapter.status}
              aria-current={chapter.status === 'active' ? 'step' : undefined}
            >
              <span className="rail-index">{chapter.index}</span>
              <span className="rail-title">{chapter.title}</span>
              <span className="rail-status">
                {chapter.status === 'active' ? '阅读中' : '筹备中'}
              </span>
            </li>
          ))}
        </ol>
      </aside>

      <section className="chapter-meta" data-intro>
        <p className="meta-index">{SITE.chapterIndex} / CHAPTER 01</p>
        <h1>{SITE.chapter}</h1>
        <p className="meta-en">{SITE.chapterEn}</p>
        <p className="meta-date">
          {SITE.date} · {SITE.location}
        </p>
        <p className="meta-tagline">{SITE.tagline}</p>
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
