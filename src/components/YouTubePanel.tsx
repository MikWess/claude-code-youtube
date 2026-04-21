import { forwardRef, useImperativeHandle, useState } from 'react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

export interface YouTubePanelHandle {
  play: () => void;
  pause: () => void;
}

// Placeholder — swap for whatever you want to default to.
const DEFAULT_VIDEO_ID = 'dQw4w9WgXcQ';

export const YouTubePanel = forwardRef<YouTubePanelHandle>(function YouTubePanel(_, ref) {
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO_ID);
  const [input, setInput] = useState('');
  const { containerRef, ready, play, pause } = useYouTubePlayer(videoId);

  useImperativeHandle(ref, () => ({ play, pause }), [play, pause]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(input.trim());
    if (id) setVideoId(id);
    setInput('');
  };

  return (
    <section className="yt-panel">
      <form className="yt-url-bar" onSubmit={submit}>
        <input
          className="yt-url-input"
          placeholder="paste a youtube url or id"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="yt-url-submit">load</button>
      </form>

      <div className="yt-stage">
        <div ref={containerRef} className="yt-player" />
        {!ready && <div className="yt-loading">loading player…</div>}
      </div>
    </section>
  );
});

// Accepts raw IDs, youtu.be/ID, and youtube.com/watch?v=ID.
function extractVideoId(input: string): string | null {
  if (!input) return null;
  const idMatch = input.match(/^[\w-]{11}$/);
  if (idMatch) return input;
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null;
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}
