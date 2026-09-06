import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

// Hardcoded test stream so it never crashes on startup!
const VIDEO_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export default function VideoPlayer() {
  const videoRef = useRef(null);

  useEffect(() => {
    if (Hls.isSupported() && videoRef.current) {
      
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

      hls.loadSource(VIDEO_URL);
      hls.attachMedia(videoRef.current);

      return () => {
        hls.destroy();
      };
    }
  }, []);

  return (
    <video 
      ref={videoRef} 
      controls 
      autoPlay 
      muted
      className="w-full rounded-xl shadow-lg border-2 border-gray-800"
    />
  );
}