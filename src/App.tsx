import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { YouTubePanel, type YouTubePanelHandle } from './components/YouTubePanel';
import { ClaudePanel } from './components/ClaudePanel';
import type { AssistantStatus, Session } from './types';

const STORAGE_KEY = 'cc-yt-sessions-v1';
const ACTIVE_KEY = 'cc-yt-active-v1';

const seedSessions: Session[] = [
  {
    id: 's-1',
    title: 'new session',
    messages: [],
    updatedAt: Date.now(),
  },
];

function loadPersisted(): { sessions: Session[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const activeRaw = localStorage.getItem(ACTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Session[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { sessions: parsed, activeId: activeRaw };
      }
    }
  } catch {
    // ignore corrupt storage, fall back to seed
  }
  return { sessions: seedSessions, activeId: null };
}

export function App() {
  const initial = useMemo(loadPersisted, []);
  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(
    initial.activeId && initial.sessions.some((s) => s.id === initial.activeId)
      ? initial.activeId
      : initial.sessions[0].id,
  );
  const ytRef = useRef<YouTubePanelHandle>(null);

  // Persist on every change — throttling isn't worth it for this scale.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch {
      // Quota exceeded or private mode — silently skip.
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, activeSessionId);
    } catch {
      // ignore
    }
  }, [activeSessionId]);

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
    // The video plays while Claude is working, pauses the moment Claude goes idle.
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
