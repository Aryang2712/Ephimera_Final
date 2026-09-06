import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { Film, Radio } from 'lucide-react';

export default function VideoPlayer({ 
  videoSource = null, 
  isHls = false, 
  title = '',
  isP2P = false 
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    // If no video is selected, do nothing and clean up previous HLS instance
    if (!videoSource) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      return;
    }

    const checkIsHls = isHls || (typeof videoSource === 'string' && videoSource.includes('.m3u8'));

    if (checkIsHls && Hls.isSupported() && videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      class P2PLoader extends Hls.DefaultConfig.loader {
        constructor(config) {
          super(config);
          this.load = (context, config, callbacks) => {
            const segmentUrl = context.url;
            console.log("🎥 HLS requesting segment:", segmentUrl);

            // 1. Check if another laptop already sent us this chunk!
            if (window.P2PBuffer && window.P2PBuffer[segmentUrl]) {
              console.log("🚀 SAVING BANDWIDTH! Serving from P2P:", segmentUrl);
              callbacks.onSuccess({ 
                url: context.url, 
                data: window.P2PBuffer[segmentUrl] 
              }, context.stats, context);
              return;
            }

            // 2. Fallback: download from the origin server normally
            const standardSuccess = callbacks.onSuccess;
            callbacks.onSuccess = (response, stats, context) => {
              console.log("📦 Origin Server downloaded a chunk:", segmentUrl);
              
              if (!window.P2PBuffer) window.P2PBuffer = {};
              window.P2PBuffer[segmentUrl] = response.data;
              
              // 3. Tell WebRTC to broadcast this new chunk to the team
              if (window.broadcastToPeers) {
                console.log("📤 Handing chunk to WebRTC pipe!");
                window.broadcastToPeers(segmentUrl, response.data);
              } else {
                console.warn("❌ WARNING: window.broadcastToPeers is MISSING!");
              }
              
              standardSuccess(response, stats, context);
            };

            super.load(context, config, callbacks);
          };
        }
      }

      const hls = new Hls({
        fLoader: P2PLoader,
        maxBufferSize: 60 * 1000 * 1000 // 60MB buffer
      });

      hlsRef.current = hls;
      hls.loadSource(videoSource);
      hls.attachMedia(videoRef.current);

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (videoRef.current) {
      // Standard video file or Object URL
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      videoRef.current.src = videoSource;
      videoRef.current.play().catch((err) => {
        console.log("Autoplay prevented or waiting for interaction:", err.message);
      });
    }
  }, [videoSource, isHls]);

  if (!videoSource) {
    return (
      <div className="w-full h-full min-h-[320px] bg-gray-950 flex flex-col items-center justify-center text-center p-8 rounded-xl border-2 border-gray-800">
        <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-500 mb-4 shadow-inner">
          <Film size={32} />
        </div>
        <h3 className="text-white font-semibold text-lg">Player Standby</h3>
        <p className="text-gray-400 text-sm max-w-md mt-1">
          No stream currently active. Drag & drop a video file above so only your chosen video is streamed across the P2P network.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>P2P Engine Ready • Awaiting Stream</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-lg border-2 border-gray-800">
      <video 
        ref={videoRef} 
        controls 
        autoPlay 
        playsInline
        className="w-full h-full object-contain max-h-[520px]"
      />

      {/* Technical Overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
        <div className="bg-black/75 text-emerald-400 text-xs px-2.5 py-1 rounded-md font-mono backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>{isP2P ? 'P2P PEER STREAM' : 'LOCAL SEEDER'}</span>
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