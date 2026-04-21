import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';

export interface YouTubePanelHandle {
  play: () => void;
  pause: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  channel: string;
  duration: number | null;
  thumbnail: string;
}

// Placeholder — swap for whatever you want to default to.
const DEFAULT_VIDEO_ID = 'dQw4w9WgXcQ';

export const YouTubePanel = forwardRef<YouTubePanelHandle>(function YouTubePanel(_, ref) {
  const [videoId, setVideoId] = useState(DEFAULT_VIDEO_ID);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { containerRef, ready, play, pause } = useYouTubePlayer(videoId);

  useImperativeHandle(ref, () => ({ play, pause }), [play, pause]);

  // Close results on Escape.
  useEffect(() => {
    if (!results) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setResults(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;

    // If it already looks like a URL or video ID, just load it.
    const direct = extractVideoId(q);
    if (direct) {
      setVideoId(direct);
      setInput('');
      setResults(null);
      setError(null);
      return;
    }

    // Otherwise search.
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/yt-search?q=${encodeURIComponent(q)}`);
      const data: { results?: SearchResult[]; error?: string } = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const pick = (id: string) => {
    setVideoId(id);
    setInput('');
    setResults(null);
    setError(null);
  };

  return (
    <section className="yt-panel">
      <form className="yt-url-bar" onSubmit={submit}>
        <input
          className="yt-url-input"
          placeholder="search youtube or paste a link"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="yt-url-submit" disabled={searching}>
          {searching ? '…' : 'go'}
        </button>
      </form>

      <div className="yt-stage">
        <div ref={containerRef} className="yt-player" />
        {!ready && <div className="yt-loading">loading player…</div>}

        {results !== null && (
          <div className="yt-results" role="dialog" aria-label="Search results">
            <div className="yt-results-head">
              <span className="yt-results-count">
                {results.length} result{results.length === 1 ? '' : 's'}
              </span>
              <button
                className="yt-results-close"
                onClick={() => setResults(null)}
                aria-label="Close results"
              >
                ×
              </button>
            </div>
            {error && <div className="yt-results-error">⚠ {error}</div>}
            {results.length === 0 && !error && <div className="yt-results-empty">no results</div>}
            <div className="yt-results-grid">
              {results.map((r) => (
                <button key={r.id} className="yt-result" onClick={() => pick(r.id)}>
                  <div className="yt-result-thumb-wrap">
                    <img className="yt-result-thumb" src={r.thumbnail} alt="" loading="lazy" />
                    {r.duration !== null && (
                      <span className="yt-result-dur">{formatDuration(r.duration)}</span>
                    )}
                  </div>
                  <div className="yt-result-title">{r.title}</div>
                  {r.channel && <div className="yt-result-channel">{r.channel}</div>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

// Accepts raw IDs, youtu.be/ID, and youtube.com/watch?v=ID.
function extractVideoId(input: string): string | null {
  if (!input) return null;
  if (/^[\w-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1) || null;
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
