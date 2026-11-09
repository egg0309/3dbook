import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  EXPLORE_OPENING,
  HOTSPOT_IDS,
  LEVEL_BRIEFS,
  LEVELS,
  POST_MEETING_BRIEF,
  STAGE_INDEX,
  optionLabel,
} from './script';
import { sendSessionStart } from './agentApi';
import { useAgent } from './useAgent';
import type { AgentOption, ChoiceCode } from './types';
import './bookStageChat.css';

interface BookStageChatProps {
  open: boolean;
  onClose: () => void;
  /** 已查看过的立体书热点 id（与 script.ts 的 HOTSPOT_IDS 对应） */
  visitedHotspots: readonly string[];
  totalHotspots: number;
}

type ChatPhase = 'explore' | 'drama';

function useTypewriter(text: string, speed = 32) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!text) return;
    const timer = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(timer);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return { shown: text.slice(0, count), done: count >= text.length };
}

export function BookStageChat({
  open,
  onClose,
  visitedHotspots,
  totalHotspots,
}: BookStageChatProps) {
  const agent = useAgent();
  const [input, setInput] = useState('');
  const [viewIndex, setViewIndex] = useState(0);
  const [phase, setPhase] = useState<ChatPhase>('explore');
  const everExploredRef = useRef(false);
  const atEndRef = useRef(true);
  const startedSessionRef = useRef<string | null>(null);

  const exploreTyper = useTypewriter(EXPLORE_OPENING);
  const allVisited = visitedHotspots.length >= totalHotspots;

  const enterDrama = () => {
    if (!allVisited) return;
    everExploredRef.current = true;
    atEndRef.current = false;
    setViewIndex(0);
    setPhase('drama');
  };

  // user 消息只发给后端，不进画面；内部状态机仍保留全部消息
  const visible = agent.messages.filter((m) => m.role !== 'user');
  const safeIndex = Math.min(viewIndex, Math.max(visible.length - 1, 0));
  const current = visible[safeIndex];
  const atEnd = safeIndex >= visible.length - 1;

  // 玩家已读到最新一条时，新消息到达自动接播；停在旧段时点继续才推进
  useEffect(() => {
    if (atEndRef.current) setViewIndex(visible.length - 1);
  }, [visible.length]);

  // 进入推演即打点开始时间；每个会话只发一次，重新推演换新 sessionId 后会再发
  useEffect(() => {
    if (phase !== 'drama') return;
    if (startedSessionRef.current === agent.sessionId) return;
    startedSessionRef.current = agent.sessionId;
    sendSessionStart(agent.sessionId);
  }, [phase, agent.sessionId]);

  const { shown, done: typingDone } = useTypewriter(current?.text ?? '');

  const advance = () => {
    const next = safeIndex + 1;
    if (next < visible.length) {
      atEndRef.current = next >= visible.length - 1;
      setViewIndex(next);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    agent.submitText(value);
    setInput('');
  };

  const handleOption = (option: AgentOption) => agent.choose(option);

  const handleReset = () => {
    atEndRef.current = false;
    setViewIndex(0);
    agent.reset();
    // 本会话已完整探索过一次，重玩不再强制点热点
    setPhase(everExploredRef.current ? 'drama' : 'explore');
  };

  const choiceTags = [
    agent.choices.choice_1,
    agent.choices.choice_2,
    agent.choices.choice_3,
  ].filter((code): code is ChoiceCode => Boolean(code));

  const placeholder =
    phase === 'explore'
      ? '先探索立体书，再开始推演'
      : agent.stage === 'done'
        ? '推演已结束'
        : agent.stage === 'review'
          ? '输入“复盘”，或向老陈提问'
          : '向老陈提问…';

  const isNarration = current?.role === 'narration' || current?.role === 'system';
  const showQuestion =
    atEnd &&
    typingDone &&
    !agent.loading &&
    !agent.error &&
    current?.role === 'npc' &&
    Boolean(agent.currentLevel);
  const showReviewCard =
    atEnd &&
    typingDone &&
    !agent.loading &&
    !agent.error &&
    current?.role === 'npc' &&
    agent.stage === 'review' &&
    !agent.report;
  // 旁白/过场段不在消息末尾时，播完必须给“继续”；不能要求 atEnd——开场旁白恰恰是第一条
  const showContinue =
    typingDone &&
    !agent.loading &&
    !agent.error &&
    safeIndex < visible.length - 1 &&
    (isNarration || (!agent.currentLevel && agent.stage !== 'review'));

  return (
    <div className="bsc-root" data-open={open} aria-hidden={!open}>
      <div className="bsc-scrim" aria-hidden="true" />

      {agent.report ? (
        <section className="bsc-letter-zone">
          <article className="bsc-letter">
            <p className="bsc-letter-kicker">老陈递来的一张纸</p>
            <h3 className="bsc-letter-title">你的遵义会议推演复盘</h3>
            {choiceTags.length > 0 && (
              <div className="bsc-letter-choices" aria-label="你的选择">
                {choiceTags.map((code) => (
                  <span key={code} title={optionLabel(code)}>
                    {code}
                  </span>
                ))}
              </div>
            )}
            <div className="bsc-letter-body">{agent.report}</div>
            <div className="bsc-letter-actions">
              <button type="button" onClick={handleReset}>
                重新推演
              </button>
              <button type="button" onClick={onClose}>
                收起
              </button>
            </div>
          </article>
        </section>
      ) : (
        <section className="bsc-stage">
          <img
            className="bsc-mascot"
            src="/book/laoduizhang.webp"
            alt="向导老队长（易班熊）"
          />
          <button
            type="button"
            className="bsc-close"
            onClick={onClose}
            aria-label="收起推演"
          >
            ×
          </button>

          {phase === 'explore' ? (
            <div className="bsc-dialog bsc-explore">
              <div className="bsc-left">
                <div className="bsc-bubble">
                  <span className="bsc-npc-name">老陈</span>
                  <p>{exploreTyper.shown}</p>
                </div>
              </div>
              <div className="bsc-right bsc-explore-card">
                {visitedHotspots.length === 0 && (
                  <p className="bsc-explore-cue">
                    <span className="bsc-explore-arrow" aria-hidden="true">
                      ↑
                    </span>
                    点击上方立体书上的大门，推门进屋
                  </p>
                )}
                <p className="bsc-explore-title">
                  先探索会场（{visitedHotspots.length}/{totalHotspots}）
                </p>
                <div className="bsc-explore-dots" aria-hidden="true">
                  {HOTSPOT_IDS.map((id) => (
                    <span key={id} data-lit={visitedHotspots.includes(id)} />
                  ))}
                </div>
                <p className="bsc-explore-hint">
                  {allVisited
                    ? '四处都看过了，可以开会了'
                    : '屋内点击四处机关：人群、木箱、火盆、行囊（后三个集中在画面右下角）'}
                </p>
                <button
                  type="button"
                  className="bsc-start"
                  disabled={!allVisited}
                  onClick={enterDrama}
                >
                  {allVisited
                    ? '开始推演'
                    : `先把四处都看完（${visitedHotspots.length}/${totalHotspots}）`}
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="bsc-progress" aria-label="推演进度">
            {LEVELS.map((level, index) => {
              const currentIndex = STAGE_INDEX[agent.stage];
              return (
                <span
                  key={level.stage}
                  className="bsc-progress-step"
                  data-active={currentIndex === index}
                  data-complete={currentIndex > index}
                >
                  {level.index}
                </span>
              );
            })}
          </div>

          {agent.loading && atEnd ? (
            <div className="bsc-typing" aria-live="polite">
              <span className="bsc-typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              老陈正在斟酌…
            </div>
          ) : agent.error && atEnd ? (
            <div className="bsc-error" role="alert">
              <span>{agent.error}</span>
              <button type="button" onClick={agent.retry}>
                重试
              </button>
            </div>
          ) : isNarration ? (
            <div className="bsc-narration-wrap">
              <p className="bsc-narration">{shown}</p>
              {showContinue && (
                <button
                  type="button"
                  className="bsc-continue"
                  onClick={advance}
                >
                  继续 <span aria-hidden="true">↓</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bsc-dialog">
              <div className="bsc-left">
                <div className="bsc-bubble">
                  <span className="bsc-npc-name">老陈</span>
                  <p>{shown}</p>
                </div>
              </div>

              {showQuestion && agent.currentLevel && (
                <div className="bsc-right">
                  <div className="bsc-question-head">
                    <p className="bsc-question-kicker">
                      <span>第 {agent.currentLevel.index} 关</span>
                      {agent.currentLevel.title} · {agent.currentLevel.focus}
                    </p>
                  </div>
                  <div className="bsc-options">
                    {agent.currentLevel.options.map((option) => (
                      <button
                        key={option.code}
                        type="button"
                        className="bsc-option"
                        onClick={() => handleOption(option)}
                        disabled={agent.loading}
                      >
                        <span className="bsc-option-code">{option.code}</span>
                        <span className="bsc-option-label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  <details className="bsc-level-brief">
                    <summary>{LEVEL_BRIEFS[agent.currentLevel.stage].headline}</summary>
                    <ul>
                      {LEVEL_BRIEFS[agent.currentLevel.stage].items.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}

              {showReviewCard && (
                <div className="bsc-right">
                  <div className="bsc-review-card">
                    <div className="bsc-brief">
                      <p className="bsc-brief-title">会后通报 · 史实要点</p>
                      <ul>
                        {POST_MEETING_BRIEF.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                    <p className="bsc-review-title">
                      三关已过，要不要看看这一路的选择照出了怎样的你？
                    </p>
                    <button
                      type="button"
                      className="bsc-review-button"
                      onClick={agent.review}
                      disabled={agent.loading}
                    >
                      生成推演复盘
                    </button>
                    <p className="bsc-review-hint">也可在底部输入“复盘”</p>
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </section>
      )}

      <footer className="bsc-input-bar">
        <form className="bsc-input-row" onSubmit={handleSubmit}>
          <span className="bsc-mode-badge" data-mode={agent.mode}>
            {agent.mode === 'mock' ? '本地演示' : '在线推演'}
          </span>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            disabled={
              phase === 'explore' ||
              agent.loading ||
              agent.stage === 'done'
            }
            aria-label="自由输入"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={
              phase === 'explore' ||
              !input.trim() ||
              agent.loading ||
              agent.stage === 'done'
            }
          >
            发送
          </button>
        </form>
      </footer>
    </div>
  );
}
