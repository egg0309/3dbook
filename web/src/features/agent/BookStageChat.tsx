import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LEVELS, STAGE_INDEX, optionLabel } from './script';
import { useAgent } from './useAgent';
import type { AgentOption, ChoiceCode } from './types';
import './bookStageChat.css';

interface BookStageChatProps {
  open: boolean;
  onClose: () => void;
}

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

export function BookStageChat({ open, onClose }: BookStageChatProps) {
  const agent = useAgent();
  const [input, setInput] = useState('');
  const [viewIndex, setViewIndex] = useState(0);
  const atEndRef = useRef(true);

  // user 消息只发给后端，不进画面；内部状态机仍保留全部消息
  const visible = agent.messages.filter((m) => m.role !== 'user');
  const safeIndex = Math.min(viewIndex, Math.max(visible.length - 1, 0));
  const current = visible[safeIndex];
  const atEnd = safeIndex >= visible.length - 1;

  // 玩家已读到最新一条时，新消息到达自动接播；停在旧段时点继续才推进
  useEffect(() => {
    if (atEndRef.current) setViewIndex(visible.length - 1);
  }, [visible.length]);

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
    atEndRef.current = true;
    setViewIndex(0);
    agent.reset();
  };

  const choiceTags = [
    agent.choices.choice_1,
    agent.choices.choice_2,
    agent.choices.choice_3,
  ].filter((code): code is ChoiceCode => Boolean(code));

  const placeholder =
    agent.stage === 'done'
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
  const showContinue =
    atEnd &&
    typingDone &&
    !agent.loading &&
    !agent.error &&
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
            src="/book/laoduizhang.png"
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
                </div>
              )}

              {showReviewCard && (
                <div className="bsc-right">
                  <div className="bsc-review-card">
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
            disabled={agent.loading || agent.stage === 'done'}
            aria-label="自由输入"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={
              !input.trim() || agent.loading || agent.stage === 'done'
            }
          >
            发送
          </button>
        </form>
      </footer>
    </div>
  );
}
