import { useCallback, useState } from 'react';
import { LoadingVeil } from './components/LoadingVeil';
import { Overlay } from './components/Overlay';
import { AgentPanel } from './features/agent/AgentPanel';
import { Scene } from './three/Scene';
import './styles.css';

export default function App() {
  const [ready, setReady] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const handleReady = useCallback(() => setReady(true), []);
  const handleOpenAgent = useCallback(() => setAgentOpen(true), []);
  const handleCloseAgent = useCallback(() => setAgentOpen(false), []);

  return (
    <main className="stage">
      <Scene onReady={handleReady} />
      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Overlay ready={ready} onOpenAgent={handleOpenAgent} />
      <AgentPanel open={agentOpen} onClose={handleCloseAgent} />
      <LoadingVeil ready={ready} />
    </main>
  );
}
