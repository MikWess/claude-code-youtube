import { useEffect, useRef, useState } from 'react';

// Minimal typings for the YouTube IFrame API surface we actually use.
declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: {
          videoId: string;
          playerVars?: Record<string, string | number>;
          events?: { onReady?: (e: { target: YTPlayer }) => void };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
}

/**
 * Loads the YouTube IFrame API and attaches a player to `containerRef`.
 * Returns a ref-like handle with play/pause.
 */
export function useYouTubePlayer(videoId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const init = () => {
      if (cancelled || !window.YT?.Player || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
        },
      });
    };

    if (window.YT?.Player) {
      init();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        init();
      };
    }

    return () => {
      // StrictMode double-invokes effects. Drop the stale player so the next
      // run starts from a clean ref instead of calling methods on a ghost.
      cancelled = true;
      playerRef.current = null;
    };
  }, [videoId]);

  // Guard both methods: the YT API is async, and StrictMode can leave
  // playerRef pointing at a partially-initialized object.
  const play = () => {
    const p = playerRef.current;
    if (p && typeof p.playVideo === 'function') p.playVideo();
  };
  const pause = () => {
    const p = playerRef.current;
    if (p && typeof p.pauseVideo === 'function') p.pauseVideo();
  };

  return { containerRef, ready, play, pause };
}
