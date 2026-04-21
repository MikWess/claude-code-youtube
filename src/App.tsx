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

  const deleteSession = useCallback(
    (id: string) => {
      const next = sessions.filter((s) => s.id !== id);
      if (next.length === 0) {
        // Never leave the UI empty — spin up a fresh session immediately.
        const fresh: Session = {
          id: `s-${Date.now()}`,
          title: 'new session',
          messages: [],
          updatedAt: Date.now(),
        };
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
        return;
      }
      setSessions(next);
      if (id === activeSessionId) setActiveSessionId(next[0].id);
    },
    [sessions, activeSessionId],
  );

  const handleStatusChange = useCallback((status: AssistantStatus) => {
    // The video should PLAY while Claude is working (keeps you entertained)
    // and PAUSE the moment Claude goes idle (so you can read the reply).
    if (status === 'idle') {
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
        onDelete={deleteSession}
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
