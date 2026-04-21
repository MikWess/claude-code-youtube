import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';

// Scrappy backend: a Vite dev-middleware that shells out to the `claude` CLI
// and streams its stream-json events to the client as NDJSON (one JSON
// per line). No API key, no env file — uses whatever auth you already have.
const claudeApi = {
  name: 'claude-api',
  configureServer(server: any) {
    server.middlewares.use('/api/chat', (req: any, res: any, next: () => void) => {
      if (req.method !== 'POST') return next();

      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk; });
      req.on('end', () => {
        let messages: { role: string; text: string }[];
        try {
          ({ messages } = JSON.parse(body));
        } catch {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/x-ndjson');
          res.end(JSON.stringify({ type: 'error', message: 'invalid json body' }) + '\n');
          return;
        }

        // Flatten the conversation into one prompt. spawn() passes this as a
        // single argv entry, so no shell interpolation happens.
        const prompt = messages
          .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
          .join('\n\n');

        const proc = spawn(
          'claude',
          ['-p', prompt, '--output-format', 'stream-json', '--verbose'],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );

        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Buffering', 'no'); // disable any proxy buffering

        let buf = '';
        let errBuf = '';

        // Pass each complete JSON line through as-is. The client parses.
        proc.stdout.on('data', (d: Buffer) => {
          buf += d.toString();
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) res.write(trimmed + '\n');
          }
        });
        proc.stderr.on('data', (d: Buffer) => { errBuf += d.toString(); });

        proc.on('error', (e: NodeJS.ErrnoException) => {
          const msg = e.code === 'ENOENT'
            ? 'the `claude` CLI is not installed. run: npm install -g @anthropic-ai/claude-code'
            : e.message;
          res.write(JSON.stringify({ type: 'error', message: msg }) + '\n');
          res.end();
        });

        proc.on('close', (code: number) => {
          if (buf.trim()) res.write(buf.trim() + '\n');
          if (code !== 0) {
            res.write(
              JSON.stringify({
                type: 'error',
                message: errBuf.trim() || `claude exited with code ${code}`,
              }) + '\n',
            );
          }
          res.end();
        });
      });
    });
  },
};

// YouTube search via the Piped API (open-source YT frontend). No key required.
// If this public instance goes down, swap PIPED_HOST for another from
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
  server: { port: 5175 },
});
