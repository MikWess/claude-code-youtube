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
  const didInitRef = useRef(false);

  // Only notify on real transitions, not on mount.
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    onStatusChange(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [session.messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || status !== 'idle') return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      createdAt: Date.now(),
    };
    // An empty assistant placeholder — filled in live as chunks stream.
    const assistantId = `a-${Date.now() + 1}`;
    const placeholder: Message = {
      id: assistantId,
      role: 'assistant',
      text: '',
      createdAt: Date.now() + 1,
    };
    onUpdateSession(session.id, (s) => ({
      ...s,
      messages: [...s.messages, userMsg, placeholder],
      updatedAt: Date.now(),
    }));
    setInput('');
    setStatus('thinking');

    const updateText = (next: string) => {
      onUpdateSession(session.id, (s) => ({
        ...s,
        messages: s.messages.map((m) => (m.id === assistantId ? { ...m, text: next } : m)),
      }));
    };

    try {
      await streamClaude(
        [...session.messages, userMsg],
        (partial) => {
          setStatus('streaming');
          updateText(partial);
        },
      );
    } catch (err) {
      updateText(`⚠️ ${err instanceof Error ? err.message : 'request failed'}`);
    }
    // Small delay so the final text paints before the video pauses.
    setTimeout(() => setStatus('idle'), 150);
  };

  return (
    <section className="claude-panel">
      <header className="claude-header">
        <span className="claude-title">#{session.title}</span>
        <span className={`claude-status claude-status--${status}`}>{status}</span>
      </header>

      <div className="claude-scroller" ref={scrollerRef}>
        {session.messages.length === 0 && (
          <div className="claude-empty">
            start a conversation — youtube plays while claude works, pauses when they're done.
          </div>
        )}
        {session.messages.map((m) => (
          <div key={m.id} className={`claude-msg claude-msg--${m.role}`}>
            <div className="claude-msg-role">{m.role}</div>
            <div className="claude-msg-text">
              {m.text ? m.text : <ThinkingDots />}
            </div>
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

function ThinkingDots() {
  return (
    <span className="claude-thinking" aria-label="claude is thinking">
      <span /><span /><span />
    </span>
  );
}

// Streams NDJSON events from `/api/chat` and calls onProgress with the
// latest rendered text each time a new event arrives.
async function streamClaude(
  messages: Message[],
  onProgress: (text: string) => void,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(({ role, text }) => ({ role, text })),
    }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rendered = '';
  let lastError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      rendered = reduceEvent(event, rendered);
      if (event.type === 'error') lastError = String(event.message ?? 'claude error');
      onProgress(rendered);
    }
  }

  if (lastError) throw new Error(lastError);
}

// Accumulates text and tool-use markers from Claude Code stream-json events
// into a single live-updating string for the chat bubble.
function reduceEvent(event: any, current: string): string {
  if (!event || typeof event !== 'object') return current;

  if (event.type === 'error') {
    return current + (current ? '\n' : '') + `⚠️ ${event.message ?? 'error'}`;
  }

  if (event.type === 'assistant' && event.message?.content) {
    const parts: string[] = [];
    for (const block of event.message.content) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text' && typeof block.text === 'string') {
        parts.push(block.text);
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        parts.push(`\n🔧 ${block.name}…`);
      } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
        parts.push(`\n💭 ${block.thinking.trim()}`);
      }
    }
    const addition = parts.join('');
    if (!addition) return current;
    return current ? `${current}\n${addition}` : addition;
  }

  if (event.type === 'result' && typeof event.result === 'string' && event.result.trim()) {
    // The final authoritative answer — replace the streamed buffer with it.
    return event.result;
  }

  return current;
}
