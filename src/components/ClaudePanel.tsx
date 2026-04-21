import { useEffect, useRef, useState } from 'react';
import type { AssistantStatus, Message, Session } from '../types';

interface Props {
  session: Session;
  onUpdateSession: (id: string, updater: (s: Session) => Session) => void;
  onStatusChange: (status: AssistantStatus) => void;
}

export function ClaudePanel({ session, onUpdateSession, onStatusChange }: Props) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Notify parent of status transitions — that's where the YouTube pause/resume wiring lives.
  useEffect(() => {
    onStatusChange(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [session.messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status !== 'idle') return;

    const userMsg: Message = {
      id: `m-${Date.now()}`,
      role: 'user',
      text,
      createdAt: Date.now(),
    };
    onUpdateSession(session.id, (s) => ({
      ...s,
      messages: [...s.messages, userMsg],
      updatedAt: Date.now(),
    }));
    setInput('');

    setStatus('thinking');
    // Stub: replace with a real Claude Agent SDK call. The only contract this
    // component cares about is status transitions (idle → thinking → streaming → idle),
    // which drive YouTube pause/resume upstream.
    const reply = await mockClaudeCall(text);
    setStatus('streaming');
    const assistantMsg: Message = {
      id: `m-${Date.now() + 1}`,
      role: 'assistant',
      text: reply,
      createdAt: Date.now(),
    };
    onUpdateSession(session.id, (s) => ({
      ...s,
      messages: [...s.messages, assistantMsg],
      updatedAt: Date.now(),
    }));
    // Give the UI a beat to render the streamed reply, then hand control back.
    setTimeout(() => setStatus('idle'), 300);
  };

  return (
    <section className="claude-panel">
      <header className="claude-header">
        <span className="claude-title">#{session.title}</span>
        <span className={`claude-status claude-status--${status}`}>{status}</span>
      </header>

      <div className="claude-scroller" ref={scrollerRef}>
        {session.messages.length === 0 && (
          <div className="claude-empty">start a conversation — youtube pauses when claude talks.</div>
        )}
        {session.messages.map((m) => (
          <div key={m.id} className={`claude-msg claude-msg--${m.role}`}>
            <div className="claude-msg-role">{m.role}</div>
            <div className="claude-msg-text">{m.text}</div>
          </div>
        ))}
      </div>

      <form className="claude-composer" onSubmit={send}>
        <textarea
          className="claude-input"
          placeholder="ask claude…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e as unknown as React.FormEvent);
            }
          }}
          rows={3}
        />
        <button type="submit" className="claude-send" disabled={status !== 'idle'}>
          send
        </button>
      </form>
    </section>
  );
}

async function mockClaudeCall(prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 1200));
  return `(stubbed) you said: "${prompt}". wire this up to the claude agent sdk to get real replies.`;
}
