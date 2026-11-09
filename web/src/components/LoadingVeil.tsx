import { useEffect, useState } from 'react';
import { SITE } from '../config';

interface LoadingVeilProps {
  ready: boolean;
}

export function LoadingVeil({ ready }: LoadingVeilProps) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => setGone(true), 1500);
    return () => window.clearTimeout(timer);
  }, [ready]);

  if (gone) return null;

  return (
    <div className={`veil${ready ? ' is-leaving' : ''}`} role="status">
      <span className="veil-star" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <path d="M32 3.5 40.2 24l22 .9-17.1 13.5 6.1 21.1L32 46.8 12.8 59.5l6.1-21.1L1.8 24.9l22-.9Z" />
        </svg>
      </span>
      <p className="veil-brand">{SITE.brand}</p>
      <p className="veil-sub">正在翻开史册…</p>
      <span className="veil-line" aria-hidden="true" />
    </div>
  );
}
