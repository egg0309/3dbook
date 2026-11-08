import { useCallback, useState } from 'react';
import { BookDialog } from './components/BookDialog';
import { Guide } from './components/Guide';
import { HadaMagnifier } from './components/HadaMagnifier';
import { LoadingVeil } from './components/LoadingVeil';
import { Overlay } from './components/Overlay';
import { BookStageChat } from './features/agent/BookStageChat';
import { HOTSPOT_IDS, type HotspotId } from './features/agent/script';
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

  const handleReady = useCallback(() => setReady(true), []);
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
    <main className="stage">
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
