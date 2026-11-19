'use client';

import React, { useEffect, useRef } from 'react';
import { useMiu } from '@/context/MiuContext';
import {
  loadYouTubeIframeApi,
  type YouTubePlayerController
} from '@/services/spotifyService';

/**
 * Persistent visually-hidden YouTube IFrame audio engine.
 * Mounted outside DynamicIsland popovers so audio never pauses or reloads when popovers close,
 * using minimum 200x200 layout box with near-zero opacity (instead of display:none which throttles media).
 */
export const HiddenYouTubePlayer: React.FC = () => {
  const {
    registerYouTubeController,
    updateYouTubePlaybackState,
    handleYouTubeError
  } = useMiu();

  const hostRef = useRef<HTMLDivElement | null>(null);
  const updateStateRef = useRef(updateYouTubePlaybackState);
  const errorHandlerRef = useRef(handleYouTubeError);

  useEffect(() => {
    updateStateRef.current = updateYouTubePlaybackState;
    errorHandlerRef.current = handleYouTubeError;
  }, [updateYouTubePlaybackState, handleYouTubeError]);

  useEffect(() => {
    let disposed = false;
    let playerInstance: YouTubePlayerController | null = null;
    const hostEl = hostRef.current;
    if (!hostEl) return;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (disposed || !hostEl) return;
        hostEl.innerHTML = '';
        const mountNode = document.createElement('div');
        hostEl.appendChild(mountNode);

        playerInstance = new YT.Player(mountNode, {
          width: '200',
          height: '200',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: (e) => {
              if (disposed) return;
              try {
                const iframe = e.target.getIframe?.();
                if (iframe) {
                  iframe.setAttribute('tabindex', '-1');
                  iframe.setAttribute('aria-hidden', 'true');
                  iframe.setAttribute('allow', 'autoplay; encrypted-media');
                  iframe.title = 'Miu Hidden YouTube Audio Player';
                }
              } catch {
                // ignore iframe attribute errors
              }
              registerYouTubeController(e.target);
            },
            onStateChange: (e) => {
              if (disposed) return;
              let posMs = 0;
              let durMs = 0;
              try {
                posMs = Math.round(Math.max(0, Number(e.target.getCurrentTime?.() || 0)) * 1000);
                durMs = Math.round(Math.max(0, Number(e.target.getDuration?.() || 0)) * 1000);
              } catch {
                // ignore
              }
              updateStateRef.current(e.data, posMs, durMs);
            },
            onError: (e) => {
              if (disposed) return;
              errorHandlerRef.current(Number(e.data || 0));
            }
          }
        });
      })
      .catch(() => {
        // Offline or YouTube script blocked
      });

    return () => {
      disposed = true;
      registerYouTubeController(null);
      try {
        playerInstance?.destroy?.();
      } catch {
        // ignore cleanup error
      }
      if (hostEl) {
        hostEl.innerHTML = '';
      }
    };
  }, [registerYouTubeController]);

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-2 right-2 w-[200px] h-[200px] opacity-[0.001] pointer-events-none -z-50 overflow-hidden select-none no-print"
    >
      <div ref={hostRef} className="w-full h-full" />
    </div>
  );
};
