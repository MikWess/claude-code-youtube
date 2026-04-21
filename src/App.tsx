import { useCallback, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { YouTubePanel, type YouTubePanelHandle } from './components/YouTubePanel';
import { ClaudePanel } from './components/ClaudePanel';
import type { AssistantStatus, Session } from './types';

const seedSessions: Session[] = [
  {
    id: 's-1',
    title: 'learn react hooks',
    messages: [],
    updatedAt: Date.now(),
  },
  {
    id: 's-2',
    title: 'refactor flashcard slider',
    messages: [],
    updatedAt: Date.now() - 60_000,
  },
  {
    id: 's-3',
    title: 'scratch',
    messages: [],
    updatedAt: Date.now() - 120_000,
  },
];

export function App() {
  const [sessions, setSessions] = useState<Session[]>(seedSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(seedSessions[0].id);
  const ytRef = useRef<YouTubePanelHandle>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0],
    [sessions, activeSessionId],
  );

  const updateSession = useCallback((id: string, updater: (s: Session) => Session) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }, []);

  const createSession = useCallback(() => {
    const id = `s-${Date.now()}`;
    const next: Session = { id, title: 'new session', messages: [], updatedAt: Date.now() };
    setSessions((prev) => [next, ...prev]);
    setActiveSessionId(id);
  }, []);

  const handleStatusChange = useCallback((status: AssistantStatus) => {
    // YouTube pause/resume hook: when Claude starts responding, pause the video.
    // When the assistant goes idle (i.e. user's turn again), resume.
    if (status === 'thinking' || status === 'streaming') {
      ytRef.current?.pause();
    } else {
      ytRef.current?.play();
    }
  }, []);

  return (
    <div className="app-shell">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSession.id}
        onSelect={setActiveSessionId}
        onCreate={createSession}
      />
      <main className="workspace">
        <YouTubePanel ref={ytRef} />
        <ClaudePanel
          session={activeSession}
          onUpdateSession={updateSession}
          onStatusChange={handleStatusChange}
        />
      </main>
    </div>
  );
}
