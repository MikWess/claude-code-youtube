import type { Session } from '../types';

interface Props {
  sessions: Session[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function Sidebar({ sessions, activeSessionId, onSelect, onCreate }: Props) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <span className="sidebar-logo">claude code</span>
        <button className="sidebar-new" onClick={onCreate} aria-label="New session">
          +
        </button>
      </header>

      <div className="sidebar-section-label">sessions</div>
      <ul className="session-list">
        {sessions.map((s) => {
          const active = s.id === activeSessionId;
          return (
            <li key={s.id}>
              <button
                className={`session-item${active ? ' session-item--active' : ''}`}
                onClick={() => onSelect(s.id)}
              >
                <span className="session-hash">#</span>
                <span className="session-title">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
