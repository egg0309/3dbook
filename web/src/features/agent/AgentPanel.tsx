import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { LEVELS, STAGE_INDEX, optionLabel } from './script';
import { useAgent } from './useAgent';
import type { AgentMessage, AgentOption, ChoiceCode } from './types';
import './agent.css';

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
}

function MessageItem({ message }: { message: AgentMessage }) {
  if (message.role === 'narration') {
    return (
      <div className="agent-narration">
        <p className="agent-narration-label">旁白</p>
        <p className="agent-narration-text">{message.text}</p>
      </div>
    );
  }

  if (message.role === 'npc') {
    return (
      <div className="agent-message agent-message-npc">
        <p className="agent-message-author">老陈</p>
        <p className="agent-message-text">{message.text}</p>
      </div>
    );
  }

  if (message.role === 'system') {
    return <p className="agent-system-line">{message.text}</p>;
  }

  return (
    <div
      className="agent-message agent-message-user"
      data-failed={message.failed ? 'true' : 'false'}
    >
      <div className="agent-user-bubble">
        {message.code && (
          <span className="agent-user-code">{message.code}</span>
        )}
        <p>{message.text}</p>
      </div>
      {message.failed && (
        <p className="agent-message-failed">发送失败，可点击下方重试</p>
      )}
    </div>
  );
}

export function AgentPanel({ open, onClose }: AgentPanelProps) {
  const agent = useAgent();
  const [input, setInput] = useState('');
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 60);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (restoreFocusRef.current instanceof HTMLElement) {
        restoreFocusRef.current.focus();
        restoreFocusRef.current = null;
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (!node) return;

    const isBeginning =
      agent.messages.length <= 2 &&
      agent.stage === 'level1' &&
      !agent.loading &&
      !agent.report;

    node.scrollTo({
      top: isBeginning ? 0 : node.scrollHeight,
      behavior: 'auto',
    });
  }, [
    open,
    agent.messages,
    agent.loading,
    agent.stage,
    agent.report,
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    agent.submitText(value);
    setInput('');
  };

  const handleOption = (option: AgentOption) => {
    agent.choose(option);
  };

  const choiceTags = [
    agent.choices.choice_1,
    agent.choices.choice_2,
    agent.choices.choice_3,
  ].filter((code): code is ChoiceCode => Boolean(code));

  const placeholder =
    agent.stage === 'done'
      ? '推演已结束 · 可重新推演'
      : agent.stage === 'review'
        ? '输入“复盘”查看推演报告'
        : '也可以直接说点什么…';

  const footerHint =
    agent.stage === 'done'
      ? '推演已结束'
      : agent.stage === 'review'
        ? '输入“复盘”，或点击上方按钮生成你的专属报告'
        : '优先点击上方选项；自由输入会触发老陈的追问';

  return (
    <div className="agent-root" data-open={open} aria-hidden={!open}>
      <div className="agent-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        className="agent-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-title"
      >
        <header className="agent-header">
          <div className="agent-brand">
            <span className="agent-brand-star" aria-hidden="true">
              <svg viewBox="0 0 64 64" role="presentation">
                <path d="M32 3.5 40.2 24l22 .9-17.1 13.5 6.1 21.1L32 46.8 12.8 59.5l6.1-21.1L1.8 24.9l22-.9Z" />
              </svg>
            </span>
            <div>
              <p className="agent-kicker">历史推演 · 1935</p>
              <h2 id="agent-title">遵义会议</h2>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="agent-close"
            onClick={onClose}
            aria-label="关闭历史推演"
          >
            ×
          </button>
        </header>

        <div className="agent-npc-bar">
          <span className="agent-avatar" aria-hidden="true">
            陈
          </span>
          <div className="agent-npc-copy">
            <p className="agent-npc-name">老陈</p>
            <p className="agent-npc-role">红军基层指挥员 · 会场外</p>
          </div>
          <span className="agent-npc-status">
            <span aria-hidden="true" />
            在场
          </span>
        </div>

        <div className="agent-progress" aria-label="推演进度">
          {LEVELS.map((level, index) => {
            const currentIndex = STAGE_INDEX[agent.stage];
            return (
              <div
                key={level.stage}
                className="agent-progress-step"
                data-active={currentIndex === index}
                data-complete={currentIndex > index}
              >
                <span className="agent-progress-line" aria-hidden="true" />
                <span className="agent-progress-index">0{level.index}</span>
                <span className="agent-progress-title">{level.title}</span>
              </div>
            );
          })}
        </div>

        <div className="agent-scroll" ref={scrollRef}>
          <p className="agent-scene-line">
            1935 · 遵义 · 会场外的一夜
          </p>

          {agent.messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {agent.loading && (
            <div className="agent-typing" aria-live="polite">
              <span className="agent-typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              老陈正在斟酌…
            </div>
          )}

          {agent.error && (
            <div className="agent-error" role="alert">
              <p>{agent.error}</p>
              <button type="button" onClick={agent.retry}>
                重试
              </button>
            </div>
          )}

          {agent.currentLevel &&
            agent.stage !== 'review' &&
            agent.stage !== 'done' && (
              <section className="agent-level">
                <div className="agent-level-head">
                  <p className="agent-level-kicker">
                    <span>第 {agent.currentLevel.index} 关</span>
                    {agent.currentLevel.title}
                  </p>
                  <p className="agent-level-focus">
                    {agent.currentLevel.focus}
                  </p>
                </div>
                <div className="agent-options">
                  {agent.currentLevel.options.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      className="agent-option"
                      onClick={() => handleOption(option)}
                      disabled={agent.loading}
                    >
                      <span className="agent-option-code">{option.code}</span>
                      <span className="agent-option-label">{option.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

          {agent.stage === 'review' && !agent.report && (
            <section className="agent-review-card">
              <p className="agent-review-kicker">三关已过</p>
              <p className="agent-review-title">
                要不要看看，这一路的选择照出了怎样的你？
              </p>
              <button
                type="button"
                className="agent-review-button"
                onClick={agent.review}
                disabled={agent.loading}
              >
                生成推演复盘
              </button>
              <p className="agent-review-hint">也可以直接输入“复盘”</p>
            </section>
          )}

          {agent.report && (
            <article className="agent-report">
              <div className="agent-report-top">
                <div>
                  <p className="agent-report-kicker">PERSONAL REPORT</p>
                  <h3>你的遵义会议</h3>
                </div>
                <span className="agent-report-seal">复盘</span>
              </div>
              {choiceTags.length > 0 && (
                <div
                  className="agent-report-choices"
                  aria-label="你的选择"
                >
                  {choiceTags.map((code) => (
                    <span key={code} title={optionLabel(code)}>
                      {code}
                    </span>
                  ))}
                </div>
              )}
              <div className="agent-report-body">{agent.report}</div>
              <div className="agent-report-actions">
                <button type="button" onClick={agent.reset}>
                  重新推演
                </button>
                <button type="button" onClick={onClose}>
                  收起
                </button>
              </div>
            </article>
          )}
        </div>

        <footer className="agent-footer">
          <form className="agent-input-row" onSubmit={handleSubmit}>
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
          <div className="agent-footer-meta">
            <span
              className="agent-mode-badge"
              data-mode={agent.mode}
            >
              {agent.mode === 'mock' ? '本地演示' : '在线推演'}
            </span>
            <span>{footerHint}</span>
          </div>
          <p className="agent-disclaimer">
            推演内容基于党史资料改编，仅用于教学；请以权威史料为准。
          </p>
        </footer>
      </aside>
    </div>
  );
}
