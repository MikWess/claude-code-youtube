export interface ChatMessage { role: 'user' | 'assistant'; text: string }

export function parseChatBody(body: unknown): ChatMessage[] {
  const messages = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 200 ||
      !messages.every(m => m && (m.role === 'user' || m.role === 'assistant') &&
        typeof m.text === 'string' && m.text.length <= 100_000)) {
    throw new Error('messages must contain 1–200 user/assistant text messages');
  }
  return messages;
}

export function parsePermissionBody(body: unknown): { requestId: string; allow: boolean } {
  const value = body as { requestId?: unknown; allow?: unknown } | null;
  if (!value || typeof value.requestId !== 'string' || !value.requestId.trim() || typeof value.allow !== 'boolean') {
    throw new Error('requestId must be a nonempty string and allow must be a boolean');
  }
  return { requestId: value.requestId, allow: value.allow };
}

export async function submitPermission(requestId: string, allow: boolean, fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher('/api/permission-response', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, allow }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Permission response failed (${response.status}); try again.`);
  }
}
