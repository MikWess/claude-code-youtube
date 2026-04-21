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
  loadVideoById?: (id: string) => void;
  getPlayerState: () => number;
}

/**
 * Loads the YouTube IFrame API and attaches a player to `containerRef`.
 * - The player is created once on mount.
 * - Subsequent videoId changes call `loadVideoById` instead of re-creating
 *   the iframe (the old way was creating multiple ghost players).
 */
export function useYouTubePlayer(initialVideoId: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const currentVideoIdRef = useRef(initialVideoId);
  const [ready, setReady] = useState(false);

  // Create the player exactly once. StrictMode double-invokes this effect,
  // so we guard with playerRef.current and do not destroy on cleanup.
  useEffect(() => {
    if (!containerRef.current || playerRef.current) return;

    const init = () => {
      if (!window.YT?.Player || !containerRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: currentVideoIdRef.current,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setReady(true),
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
  }, []);

  // Swap videos using loadVideoById once the player is ready.
  useEffect(() => {
    if (!ready) return;
    if (currentVideoIdRef.current === initialVideoId) return;
    const p = playerRef.current;
    if (p && typeof p.loadVideoById === 'function') {
      p.loadVideoById(initialVideoId);
      currentVideoIdRef.current = initialVideoId;
    }
  }, [initialVideoId, ready]);

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
