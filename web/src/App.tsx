import { useCallback, useEffect, useRef, useState } from 'react';
import { BookDialog } from './components/BookDialog';
import { Guide } from './components/Guide';
import { HadaMagnifier } from './components/HadaMagnifier';
import { LoadingVeil } from './components/LoadingVeil';
import { Overlay } from './components/Overlay';
import { BookStageChat } from './features/agent/BookStageChat';
import { HOTSPOT_IDS, type HotspotId } from './features/agent/script';
import { requestOpen } from './journey';
import { Scene } from './three/Scene';
import './styles.css';

const HOTSPOT_TOTAL = HOTSPOT_IDS.length;

function isHotspotId(id: string): id is HotspotId {
  return (HOTSPOT_IDS as readonly string[]).includes(id);
}

interface DialogState {
  isOpen: boolean;
  title: string;
  content: string;
}

const CLOSED_DIALOG: DialogState = {
  isOpen: false,
  title: '',
  content: '',
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(CLOSED_DIALOG);
  const [visitedHotspots, setVisitedHotspots] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const autoOpenedRef = useRef(false);

  const handleReady = useCallback(() => setReady(true), []);

  // React 首帧绘制后，移除 index.html 里的内联启动加载页（LoadingVeil 视觉接管）
  useEffect(() => {
    const boot = document.getElementById('boot-loader');
    if (!boot) return;
    boot.classList.add('bl-hide');
    const timer = window.setTimeout(() => boot.remove(), 650);
    return () => window.clearTimeout(timer);
  }, []);

  // 场景就绪后自动翻开遵义会议，跳过合封转书；只触发一次，「重新翻阅」不受影响
  useEffect(() => {
    if (!ready || autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    const timer = window.setTimeout(requestOpen, 900);
    return () => window.clearTimeout(timer);
  }, [ready]);
  const handleOpenAgent = useCallback(() => setAgentOpen(true), []);
  const handleCloseAgent = useCallback(() => setAgentOpen(false), []);

  const handleOpenDialog = useCallback(
    (id: string, title: string, content: string) => {
      if (isHotspotId(id)) {
        setVisitedHotspots((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }
      setDialog({ isOpen: true, title, content });
    },
    [],
  );

  const handleCloseDialog = useCallback(() => {
    setDialog((current) => ({ ...current, isOpen: false }));
  }, []);

  return (
    <main className="stage" data-agent-open={agentOpen ? 'true' : 'false'}>
      <Scene onReady={handleReady} onOpenDialog={handleOpenDialog} />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Overlay
        ready={ready}
        onOpenAgent={handleOpenAgent}
        agentOpen={agentOpen}
      />
      <Guide ready={ready} />
      <HadaMagnifier onOpenDialog={handleOpenDialog} />
      <BookStageChat
        open={agentOpen}
        onClose={handleCloseAgent}
        visitedHotspots={[...visitedHotspots]}
        totalHotspots={HOTSPOT_TOTAL}
      />
      <LoadingVeil ready={ready} />
      <BookDialog
        open={dialog.isOpen}
        title={dialog.title}
        content={dialog.content}
        onClose={handleCloseDialog}
      />
    </main>
  );
}
