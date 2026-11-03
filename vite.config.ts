import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { parseChatBody, parsePermissionBody } from './src/api-contract';
import { query } from '@anthropic-ai/claude-agent-sdk';

// ============================================================
// Claude Agent SDK middleware
// ------------------------------------------------------------
// Uses the same auth as your logged-in `claude` CLI. Streams events
// to the frontend as NDJSON. When Claude wants to run a tool, the
// SDK calls `canUseTool`, which we surface to the frontend as a
// permission_request event and await via a promise keyed by id.
// /api/permission-response resolves that promise with allow/deny.
// ============================================================

type PermissionResolver = (allow: boolean) => void;
const pendingPermissions = new Map<string, PermissionResolver>();

const claudeApi = {
  name: 'claude-api',
  configureServer(server: any) {
    server.middlewares.use('/api/chat', async (req: any, res: any, next: () => void) => {
      if (req.method !== 'POST') return next();

      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk; });
      await new Promise<void>((resolve) => req.on('end', resolve));

      let messages: { role: string; text: string }[];
      try {
        messages = parseChatBody(JSON.parse(body));
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.end(JSON.stringify({ type: 'error', message: 'invalid chat body: expected user/assistant text messages' }) + '\n');
        return;
      }

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');

      const emit = (evt: unknown) => res.write(JSON.stringify(evt) + '\n');

      // Flatten conversation history into one prompt — the SDK will treat the
      // last USER turn as the current question. Previous turns give context.
      const prompt = messages
        .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
        .join('\n\n');

      try {
        for await (const sdkMessage of query({
          prompt,
          options: {
            // Surface every tool call to the frontend for human approval.
            canUseTool: async (toolName: string, input: Record<string, unknown>) => {
              const requestId =
                `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              emit({ type: 'permission_request', requestId, tool: toolName, input });
              const allowed = await new Promise<boolean>((resolve) => {
                pendingPermissions.set(requestId, resolve);
              });
              if (allowed) {
                return { behavior: 'allow', updatedInput: input };
              }
              return { behavior: 'deny', message: 'denied by user', interrupt: false };
            },
          },
        })) {
          emit(sdkMessage);
        }
      } catch (e: any) {
        emit({ type: 'error', message: e?.message ?? 'agent sdk failed' });
      } finally {
        res.end();
      }
    });

    server.middlewares.use('/api/permission-response', (req: any, res: any, next: () => void) => {
      if (req.method !== 'POST') return next();
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk; });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const { requestId, allow } = parsePermissionBody(JSON.parse(body));
          const resolve = pendingPermissions.get(requestId);
          if (!resolve) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'no pending request with that id' }));
            return;
          }
          pendingPermissions.delete(requestId);
          resolve(allow);
          res.end(JSON.stringify({ ok: true }));
        } catch (e: any) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: e?.message ?? 'bad request' }));
        }
      });
    });
  },
};

// YouTube search via Piped (open-source YT frontend, no key needed).
// If this public instance goes down, swap PIPED_HOST from
// https://github.com/TeamPiped/Piped/wiki/Instances
const PIPED_HOST = 'https://pipedapi.kavin.rocks';

const ytSearch = {
  name: 'yt-search',
  configureServer(server: any) {
    server.middlewares.use('/api/yt-search', async (req: any, res: any, next: () => void) => {
      if (req.method !== 'GET') return next();
      const url = new URL(req.url, 'http://localhost');
      const q = url.searchParams.get('q');
      res.setHeader('Content-Type', 'application/json');
      if (!q) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'missing q' }));
        return;
      }
      try {
        const upstream = await fetch(
          `${PIPED_HOST}/search?q=${encodeURIComponent(q)}&filter=videos`,
        );
        if (!upstream.ok) throw new Error(`piped returned ${upstream.status}`);
        const data: any = await upstream.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const results = items
          .filter((it: any) => typeof it.url === 'string' && it.url.startsWith('/watch?v='))
          .slice(0, 20)
          .map((it: any) => {
            const id = it.url.slice('/watch?v='.length);
            return {
              id,
              title: it.title ?? '(untitled)',
              channel: it.uploaderName ?? '',
              duration: typeof it.duration === 'number' ? it.duration : null,
              thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
            };
          });
        res.end(JSON.stringify({ results }));
      } catch (e: any) {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: e?.message ?? 'upstream failed' }));
      }
    });
  },
};

export default defineConfig({
  plugins: [react(), claudeApi, ytSearch],
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
});
