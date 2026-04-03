import { useState, useEffect, useMemo } from 'react';
import TrajectoryScene from './components/TrajectoryScene';
import TelemetryPanel from './components/TelemetryPanel';
import SpacecraftView from './components/SpacecraftView';
import ChatPanel from './components/ChatPanel';
import { useSocket, useOrionState, useChat } from './hooks/useSocket';
import { getMoonECI } from './utils/astro-math';
import './index.css';

export default function App() {
  const { socket, connected } = useSocket();
  const { state, trajectory, history } = useOrionState(socket);
  const { messages, onlineCount, sendMessage } = useChat(socket);

  // Shared time ticker — drives Moon position updates
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 5000);
    return () => clearInterval(id);
  }, []);

  // Moon ECI position — shared between both 3D scenes
  const moonECI = useMemo(() => getMoonECI(currentTime), [currentTime]);

  return (
    <>
      {/* Header overlay */}
      <div className="app-header">
        <div className="logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 19.5h20L12 2z" />
            <path d="M12 9v4" />
            <circle cx="12" cy="16" r="0.5" />
          </svg>
          Artemis II Tracker
        </div>
        <div className="mission-badge">
          {connected ? '● LIVE' : '○ CONNECTING...'}
        </div>
      </div>

      {/* 4-panel layout */}
      <div className="app-layout">
        <TrajectoryScene state={state} trajectory={trajectory} moonECI={moonECI} />
        <TelemetryPanel state={state} history={history} />
        <SpacecraftView state={state} moonECI={moonECI} />
        <ChatPanel
          messages={messages}
          onlineCount={onlineCount}
          onSend={sendMessage}
        />
      </div>
    </>
  );
}
