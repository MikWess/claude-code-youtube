# claude-code-youtube

YouTube on one side, Claude Code on the other. The video pauses when Claude
starts responding and resumes when you send the next prompt.

## Architecture

```
src/
  App.tsx                 shell: sidebar + workspace (yt | claude)
  App.css                 slack-ish palette + split layout
  types.ts                Session / Message / AssistantStatus
  components/
    Sidebar.tsx           slack-style session list + "new" button
    YouTubePanel.tsx      YT IFrame API wrapper, URL loader, pause/resume handle
    ClaudePanel.tsx       chat UI, emits AssistantStatus -> drives YT
  hooks/
    useYouTubePlayer.ts   loads iframe_api, returns { play, pause }
```

### Pause/resume wiring

`ClaudePanel` owns an `AssistantStatus` (`idle | thinking | streaming`) and calls
`onStatusChange` on every transition. `App.tsx` holds a ref to the YouTube
player and pauses on `thinking`/`streaming`, plays on `idle`. That's the whole
"auto-pause when Claude talks" feature — one ref, one effect.

### What's stubbed

- `ClaudePanel.mockClaudeCall` returns a canned reply. Replace with the
  Claude Agent SDK (or a `/api/chat` proxy to the Anthropic API).
- Sessions live in React state only — no persistence yet.
- Session titles aren't renamable yet.

## Run it

```
pnpm install   # or npm install
pnpm dev       # vite on :5175
```

The YouTube IFrame API is loaded via `<script>` in `index.html`, so no extra
setup needed.
