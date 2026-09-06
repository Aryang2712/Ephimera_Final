import React from 'react';

export default function VideoPlayer() {
  // Free open-source sample video for testing
  const DEMO_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  return (
    <div className="w-full h-full bg-black">
      <video 
        src={DEMO_VIDEO_URL}
        controls
        autoPlay
        muted
        className="w-full h-full object-cover"
      >
        Your browser does not support the video tag.
      </video>
      
      {/* Overlay to make it look like a technical CDN player */}
      <div className="absolute top-4 left-4 bg-black/60 text-white text-xs px-2 py-1 rounded font-mono backdrop-blur-sm border border-white/10">
        EPHIMERA MSE BUFFER: ACTIVE
      </div>
    </div>
  );
}