import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssistantStatus,
  Message,
  PermissionMessage,
  Session,
  TextMessage,
  ToolUseMessage,
} from '../types';

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

    const userMsg: TextMessage = {
      id: `u-${Date.now()}`,
      kind: 'text',
      role: 'user',
      text,
      createdAt: Date.now(),
    };
    appendMessage(onUpdateSession, session.id, userMsg);
    setInput('');
    setStatus('thinking');

    // Ask for text-only history (the SDK doesn't want structured events).
    const historyForSdk = [...session.messages, userMsg]
      .filter((m): m is TextMessage => m.kind === 'text')
      .map(({ role, text }) => ({ role, text }));

    try {
      await streamClaude(historyForSdk, (event) => {
        setStatus('streaming');
        handleSdkEvent(event, onUpdateSession, session.id);
      });
    } catch (err) {
      appendMessage(onUpdateSession, session.id, {
        id: `e-${Date.now()}`,
        kind: 'error',
        text: err instanceof Error ? err.message : 'request failed',
        createdAt: Date.now(),
      });
    }
    setTimeout(() => setStatus('idle'), 150);
  };

  const respondToPermission = async (msg: PermissionMessage, allow: boolean) => {
    // Optimistically update the bubble so the user sees the decision stick.
    onUpdateSession(session.id, (s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.kind === 'permission' && m.requestId === msg.requestId
          ? { ...m, status: allow ? 'allowed' : 'denied' }
          : m,
      ),
    }));
    try {
      await fetch('/api/permission-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: msg.requestId, allow }),
      });
    } catch {
      // The subprocess will hang if this fails. For scrappy, we let the user retry.
    }
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
          <MessageView
            key={m.id}
            message={m}
            onPermission={respondToPermission}
          />
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

// ============================================================
// Rendering each message kind
// ============================================================

function MessageView({
  message,
  onPermission,
}: {
  message: Message;
  onPermission: (m: PermissionMessage, allow: boolean) => void;
}) {
  switch (message.kind) {
    case 'text':
      return (
        <div className={`claude-msg claude-msg--${message.role}`}>
          <div className="claude-msg-role">{message.role}</div>
          <div className="claude-msg-text">{message.text}</div>
        </div>
      );
    case 'thinking':
      return (
        <div className="claude-event claude-event--thinking">
          <div className="claude-event-head">
            <span className="claude-event-badge">thinking</span>
          </div>
          <div className="claude-event-body">{message.text}</div>
        </div>
      );
    case 'tool_use':
      return <ToolUseView message={message} />;
    case 'tool_result':
      return (
        <div className={`claude-event claude-event--result${message.isError ? ' is-error' : ''}`}>
          <div className="claude-event-head">
            <span className="claude-event-badge">{message.isError ? 'error' : 'result'}</span>
          </div>
          <pre className="claude-event-body claude-event-body--pre">
            {truncate(message.content, 1200)}
          </pre>
        </div>
      );
    case 'permission':
      return <PermissionView message={message} onRespond={onPermission} />;
    case 'error':
      return (
        <div className="claude-event claude-event--error">
          <div className="claude-event-head">
            <span className="claude-event-badge">error</span>
          </div>
          <div className="claude-event-body">⚠️ {message.text}</div>
        </div>
      );
  }
}

function ToolUseView({ message }: { message: ToolUseMessage }) {
  const summary = useMemo(() => summarizeInput(message.input), [message.input]);
  return (
    <div className="claude-event claude-event--tool">
      <div className="claude-event-head">
        <span className="claude-event-dot" aria-hidden />
        <span className="claude-event-toolname">{message.name}</span>
        {summary && <span className="claude-event-toolsummary">{summary}</span>}
      </div>
    </div>
  );
}

function PermissionView({
  message,
  onRespond,
}: {
  message: PermissionMessage;
  onRespond: (m: PermissionMessage, allow: boolean) => void;
}) {
  const summary = summarizeInput(message.input);
  return (
    <div className={`claude-perm claude-perm--${message.status}`}>
      <div className="claude-perm-head">
        <span className="claude-perm-icon" aria-hidden>⚠</span>
        <span>
          claude wants to run <strong>{message.name}</strong>
        </span>
      </div>
      {summary && <div className="claude-perm-summary">{summary}</div>}
      {message.status === 'pending' ? (
        <div className="claude-perm-actions">
          <button
            className="claude-perm-btn claude-perm-btn--allow"
            onClick={() => onRespond(message, true)}
          >
            allow
          </button>
          <button
            className="claude-perm-btn claude-perm-btn--deny"
            onClick={() => onRespond(message, false)}
          >
            deny
          </button>
        </div>
      ) : (
        <div className="claude-perm-resolved">
          {message.status === 'allowed' ? '✓ allowed' : '✗ denied'}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Streaming + event reduction
// ============================================================

async function streamClaude(
  historyForSdk: { role: string; text: string }[],
  onEvent: (event: unknown) => void,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: historyForSdk }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onEvent(JSON.parse(line));
      } catch {
        // skip bad line
      }
    }
  }
}

type Updater = (id: string, updater: (s: Session) => Session) => void;

function handleSdkEvent(event: any, updateSession: Updater, sessionId: string): void {
  if (!event || typeof event !== 'object') return;

  // Custom event: our server emits this when canUseTool fires.
  if (event.type === 'permission_request') {
    appendMessage(updateSession, sessionId, {
      id: event.requestId,
      kind: 'permission',
      requestId: event.requestId,
      name: String(event.tool ?? 'tool'),
      input: event.input,
      status: 'pending',
      createdAt: Date.now(),
    });
    return;
  }

  if (event.type === 'error') {
    appendMessage(updateSession, sessionId, {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: 'error',
      text: String(event.message ?? 'error'),
      createdAt: Date.now(),
    });
    return;
  }

  // Assistant messages: content is an array of text/thinking/tool_use blocks.
  if (event.type === 'assistant' && event.message?.content) {
    const blocks = Array.isArray(event.message.content) ? event.message.content : [];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;

      if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        appendMessage(updateSession, sessionId, {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'text',
          role: 'assistant',
          text: block.text,
          createdAt: Date.now(),
        });
      } else if (block.type === 'thinking' && typeof block.thinking === 'string' && block.thinking.trim()) {
        appendMessage(updateSession, sessionId, {
          id: `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'thinking',
          text: block.thinking,
          createdAt: Date.now(),
        });
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        appendMessage(updateSession, sessionId, {
          id: block.id ?? `tu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          kind: 'tool_use',
          name: block.name,
          input: block.input,
          createdAt: Date.now(),
        });
      }
    }
    return;
  }

  // User messages in the stream carry tool results (from the assistant's tool runs).
  if (event.type === 'user' && event.message?.content) {
    const blocks = Array.isArray(event.message.content) ? event.message.content : [];
    for (const block of blocks) {
      if (block?.type !== 'tool_result') continue;
      const content =
        typeof block.content === 'string'
          ? block.content
          : Array.isArray(block.content)
            ? block.content.map((c: any) => (typeof c === 'string' ? c : c?.text ?? '')).join('\n')
            : JSON.stringify(block.content);
      appendMessage(updateSession, sessionId, {
        id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kind: 'tool_result',
        toolUseId: String(block.tool_use_id ?? ''),
        content,
        isError: !!block.is_error,
        createdAt: Date.now(),
      });
    }
    return;
  }
}

function appendMessage(updateSession: Updater, sessionId: string, msg: Message) {
  updateSession(sessionId, (s) => ({
    ...s,
    messages: [...s.messages, msg],
    updatedAt: Date.now(),
  }));
}

// ============================================================
// Helpers
// ============================================================

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const o = input as Record<string, unknown>;
  // Pick the most informative-looking field first.
  const priority = ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'prompt'];
  for (const key of priority) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) return truncate(v, 140);
  }
  // Fall back to a compact json preview.
  try {
    return truncate(JSON.stringify(o), 140);
  } catch {
    return '';
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}
