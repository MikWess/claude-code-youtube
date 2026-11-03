# Claude Code + YouTube

A local workspace with YouTube beside a Claude coding conversation. Video plays while Claude is thinking or streaming, then pauses when the response finishes so you can review it.

## Three useful workflows

1. **Watch while a coding task runs.** Load a YouTube URL, start playback, then ask Claude to inspect or explain code. The player resumes during work and pauses when Claude becomes idle. Review the result before the next request.
2. **Work beside a tutorial.** Keep a lesson visible while asking questions about code you paste or files Claude can access. Review each proposed tool action in the permission card. Claude receives your chat text, **not** the video, audio, or transcript; paste the relevant excerpt yourself.
3. **Keep separate task conversations.** Create sessions in the sidebar for different topics and return to them later in the same browser. Sessions and message history persist in browser localStorage; clearing site data removes them. SDK processes are started per request, rather than resumed as persistent SDK sessions.

## Run locally

Requires Node.js 22.13+ (also used by the no-key tests), pnpm, and the Claude Code CLI installed and authenticated (`claude` must be on your PATH). Installing this repository’s SDK dependency does not install a global CLI. Use your own checkout or a disposable coding workspace when granting tool access.

```sh
git clone https://github.com/MikWess/claude-code-youtube.git
cd claude-code-youtube
pnpm install --frozen-lockfile
claude  # complete your normal login if not already authenticated
pnpm dev
```

Open **http://127.0.0.1:5175**. The Vite server binds to loopback. If that port is occupied, stop the other process or choose a different port with `pnpm dev --port 5176`.

Claude usage follows the local account's authentication and limits. A real conversation can invoke tools and consume usage; `pnpm test` and `pnpm build` do neither.

## First run

1. Add a session, then paste a direct YouTube URL into the player or try the search.
2. Start the player once if your browser blocks automatic playback.
3. Send a small text-only request first. When you request tool work, inspect its name and arguments before choosing **allow** or **deny**.
4. If a permission decision fails to reach the server, the card stays pending and shows an error so you can retry. A stale card after a server restart may have no pending request; send a fresh task rather than repeatedly approving it.

Video search uses a public Piped API instance and may be unavailable. Direct YouTube URLs avoid that search dependency, though YouTube itself still needs network access.

## Checks and architecture

```sh
pnpm test
pnpm build
```

- `src/App.tsx`: session persistence and playback/status coordination.
- `src/components/ClaudePanel.tsx`: streamed SDK messages and permission cards.
- `src/components/YouTubePanel.tsx`: player and search UI.
- `src/api-contract.ts`: request validation and acknowledged permission submission.
- `vite.config.ts`: local Agent SDK and video-search middleware.

The chat endpoint streams newline-delimited JSON. Permission replies require a boolean decision; malformed chat requests are rejected before reaching the SDK.

**`pnpm preview` and a static `dist/` deployment do not include the chat/search API.** Keep using `pnpm dev` for the complete local app. This is a single-user local prototype, without hosted authentication, durable server sessions, or a production deployment configuration. Do not expose the development server to other users or assume tool approval cards form a complete security boundary.
