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

### Claude wiring (scrappy edition)

`vite.config.ts` includes a dev-server plugin that exposes `/api/chat`. It
shells out to your local `claude` CLI (`claude -p "<prompt>"`) and returns
the reply. No API key, no env file — it uses whatever auth you already have
on your machine.

One-turn-at-a-time: the frontend sends the full conversation history as one
prompt, Claude replies, done. No streaming, no sessions persisted server-side.

### What's stubbed

- Session persistence — React state only, lost on refresh.
- Renaming / deleting sessions.
- Streaming tokens (today the reply lands in one chunk).

## Run it

Prereqs: **Node 18+**, **pnpm** (or npm), and the `claude` CLI
(`npm install -g @anthropic-ai/claude-code`) logged in (`claude` once, pick
`/login`).

```
pnpm install
pnpm dev       # vite on :5175
```

Open http://localhost:5175.
