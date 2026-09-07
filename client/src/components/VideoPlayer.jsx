import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Film } from 'lucide-react';

export default function VideoPlayer({ 
  videoSource = null, 
  isHls = false, 
  title = '',
  isP2P = false,
  isHost = false,
  onStreamReady = null
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const isSyncingRef = useRef(false);

  // ── Sync play/pause/seek from Host to Peers ────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSource) return;

    if (isHost) {
      const sendControl = (type, payload = {}) => {
        window.broadcastControlToPeers?.({ type, ...payload });
      };

      const onPlay = () => sendControl('sync-play', { currentTime: video.currentTime });
      const onPause = () => sendControl('sync-pause', { currentTime: video.currentTime });
      const onSeeked = () => {
        if (!isSyncingRef.current) {
          sendControl('sync-seek', { currentTime: video.currentTime });
        }
      };

      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('seeked', onSeeked);

      return () => {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('seeked', onSeeked);
      };
    } else {
      const handleRemoteControl = (e) => {
        const { type, currentTime } = e.detail;
        isSyncingRef.current = true;
        if (type === 'sync-play') {
          if (currentTime !== undefined && Math.abs(video.currentTime - currentTime) > 0.3) {
            video.currentTime = currentTime;
          }
          video.play().catch(() => {});
        } else if (type === 'sync-pause') {
          if (currentTime !== undefined) {
            video.currentTime = currentTime;
          }
          video.pause();
        } else if (type === 'sync-seek') {
          if (currentTime !== undefined) {
            video.currentTime = currentTime;
          }
        }
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 200);
      };

      window.addEventListener('p2p-video-control', handleRemoteControl);
      return () => window.removeEventListener('p2p-video-control', handleRemoteControl);
    }
  }, [videoSource, isHost]);

  // ── Video Source & Live Streaming Setup ────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!videoSource || !video) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    // 1. Live WebRTC MediaStream (instant P2P stream)
    if (typeof MediaStream !== 'undefined' && videoSource instanceof MediaStream) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.srcObject = videoSource;
      video.muted = true; // Required by browsers for immediate unprompted autoplay
      video.playsInline = true;
      video.play().catch((err) => {
        console.log('Live stream play attempt:', err.message);
      });
      return;
    }

    const checkIsHls = isHls || (typeof videoSource === 'string' && videoSource.includes('.m3u8'));

    // 2. HLS Live Stream
    if (checkIsHls && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      video.srcObject = null;

      class P2PLoader extends Hls.DefaultConfig.loader {
        constructor(config) {
          super(config);
          const originalLoad = this.load.bind(this);
          this.load = (context, config, callbacks) => {
            const segmentUrl = context.url;

            if (window.P2PBuffer && window.P2PBuffer[segmentUrl]) {
              const data = window.P2PBuffer[segmentUrl];
              const byteLen = data.byteLength || 0;
              callbacks.onSuccess(
                { url: context.url, data },
                {
                  trequest: performance.now(),
                  tfirst: performance.now(),
                  tload: performance.now(),
                  loaded: byteLen,
                  total: byteLen,
                  retry: 0
                },
                context
              );
              return;
            }

            const standardSuccess = callbacks.onSuccess;
            callbacks.onSuccess = (response, stats, context) => {
              if (!window.P2PBuffer) window.P2PBuffer = {};
              window.P2PBuffer[segmentUrl] = response.data;

              if (window.broadcastToPeers) {
                window.broadcastToPeers(segmentUrl, response.data);
              }

              standardSuccess(response, stats, context);
            };

            originalLoad(context, config, callbacks);
          };
        }
      }

      const hls = new Hls({
        fLoader: P2PLoader,
        pLoader: P2PLoader,
        maxBufferSize: 60 * 1000 * 1000
      });

      hlsRef.current = hls;
      hls.loadSource(videoSource);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    // 3. Regular Video URL / Object URL
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.srcObject = null;
    video.src = videoSource;

    const handleLoadedData = () => {
      if (isHost && onStreamReady) {
        try {
          const stream = video.captureStream?.(60) || video.mozCaptureStream?.(60) || video.captureStream?.() || video.mozCaptureStream?.();
          if (stream) {
            stream.getVideoTracks().forEach((track) => {
              if ('contentHint' in track) {
                track.contentHint = 'detail';
              }
            });
            console.log('🎥 Captured 60FPS HD video stream from host, streaming to peers...');
            onStreamReady(stream);
          }
        } catch (e) {
          console.warn('captureStream not available:', e);
        }
      }
    };

    if (video.readyState >= 2) {
      handleLoadedData();
    }
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('canplay', handleLoadedData);
    video.addEventListener('play', handleLoadedData);
    video.play().catch((err) => console.log('Autoplay:', err.message));

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('canplay', handleLoadedData);
      video.removeEventListener('play', handleLoadedData);
    };
  }, [videoSource, isHls, isHost, onStreamReady]);

  if (!videoSource) {
    return (
      <div className="w-full h-full min-h-[320px] bg-gray-950 flex flex-col items-center justify-center text-center p-8 rounded-xl border-2 border-gray-800">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 mb-4 shadow-inner">
          <Film size={32} />
        </div>
        <h3 className="text-white font-semibold text-lg">Player Standby</h3>
        <p className="text-gray-400 text-sm max-w-md mt-1">
          No stream currently active. Drag &amp; drop a video file or launch the live stream above to share across the P2P network.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>P2P Engine Ready • Mesh Active</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-lg border-2 border-gray-800">
      <video 
        ref={videoRef} 
        controls={isHost} 
        autoPlay 
        playsInline
        className="w-full h-full object-contain max-h-[520px]"
      />

      {/* Technical Overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <div className="bg-black/75 text-emerald-400 text-xs px-2.5 py-1 rounded-md font-mono backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{isP2P ? 'P2P LIVE STREAM' : 'LOCAL HOST / SEEDER'}</span>
        </div>
        {title && (
          <div className="bg-black/75 text-gray-200 text-xs px-2.5 py-1 rounded-md font-sans backdrop-blur-md border border-white/10 truncate max-w-[200px] sm:max-w-xs shadow-sm">
            {title}
          </div>
        )}
      </div>
    </div>
  );
}