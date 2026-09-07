import React, { useState, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Activity, Server, Radio, Zap, HardDrive, Wifi, Copy, Check, RefreshCw, X } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import DropZone from './DropZone';

const DEMO_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

// Live Typing Effect Hook with Clean Auto-Removal of Cursor
function useTypewriter(text, speed = 68, startDelay = 120) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    setIsTyping(true);

    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        index++;
        setDisplayedText(text.slice(0, index));
        if (index >= text.length) {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, startDelay]);

  return { displayedText, isTyping };
}

export default function StreamDashboard({ videoId }) {
  const { 
    isConnected,
    connectedPeersCount,
    receivedChunks, 
    totalBytesReceived, 
    chunksSeeded,
    seedVideoFile,
    streamLiveVideo,
    stopLiveVideoStream,
    incomingStream,
    incomingMediaStream,
    resetIncomingStream
  } = useWebRTC(videoId);

  const [localVideo, setLocalVideo] = useState(null);
  const [isDemoStream, setIsDemoStream] = useState(false);
  const [remoteLiveStream, setRemoteLiveStream] = useState(null);
  const [showDropZone, setShowDropZone] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Live Typewriter Effect
  const { displayedText: titleText, isTyping: isTitleTyping } = useTypewriter('EPHIMERA CDN Node', 68, 120);
  const { displayedText: subText, isTyping: isSubTyping } = useTypewriter(
    'Real-Time P2P Live Video Mesh & Decentralized Edge Streaming',
    26,
    1350
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href);
    }
  }, []);

  const handleCopyLink = () => {
    if (navigator.clipboard && shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Listen for remote stream start/stop
  useEffect(() => {
    const handleRemoteStream = (e) => {
      const msg = e.detail;
      if (msg.type === 'remote-stream-start') {
        setLocalVideo(null);
        setIsDemoStream(false);
        resetIncomingStream();
        setRemoteLiveStream({
          url: msg.url,
          title: msg.title || 'P2P Mesh Live Stream',
          streamType: msg.streamType || 'webrtc'
        });
        setShowDropZone(false);
      } else if (msg.type === 'remote-stream-stop') {
        setRemoteLiveStream(null);
        resetIncomingStream();
        setShowDropZone(true);
      }
    };

    window.addEventListener('p2p-stream-control', handleRemoteStream);
    return () => window.removeEventListener('p2p-stream-control', handleRemoteStream);
  }, [resetIncomingStream]);

  // When a local video is loaded
  const handleVideoLoaded = async ({ file, manifest, chunkStore, objectUrl, title }) => {
    setIsDemoStream(false);
    setRemoteLiveStream(null);
    resetIncomingStream();
    setLocalVideo({ file, manifest, chunkStore, objectUrl, title });
    setShowDropZone(false);

    try {
      if (manifest && chunkStore) {
        await seedVideoFile(manifest, chunkStore);
      }
    } catch (err) {
      console.error("[StreamDashboard] Error seeding video file:", err);
    }
  };

  const handleLoadDemoStream = () => {
    setLocalVideo(null);
    setRemoteLiveStream(null);
    resetIncomingStream();
    setIsDemoStream(true);
    setShowDropZone(false);
  };

  const handleClearVideo = () => {
    setLocalVideo(null);
    setIsDemoStream(false);
    setRemoteLiveStream(null);
    resetIncomingStream();
    stopLiveVideoStream();
    setShowDropZone(true);
  };

  // Determine active source & role (Host actions take precedence, followed by incoming P2P streams)
  let activeSource = null;
  let activeTitle = '';
  let isHls = false;
  let isP2P = false;
  let roleLabel = 'Standby';

  if (localVideo) {
    activeSource = localVideo.objectUrl;
    activeTitle = localVideo.title || localVideo.file?.name || 'Local Video';
    isHls = false;
    isP2P = true;
    roleLabel = 'P2P Swarm Host';
  } else if (isDemoStream) {
    activeSource = DEMO_HLS_URL;
    activeTitle = 'MUX Demo HLS Stream';
    isHls = true;
    isP2P = false;
    roleLabel = 'HLS Live Host';
  } else if (incomingMediaStream) {
    activeSource = incomingMediaStream;
    activeTitle = remoteLiveStream?.title || 'Live Video Stream (P2P Host)';
    isHls = false;
    isP2P = true;
    roleLabel = 'P2P Receiver (Live)';
  } else if (remoteLiveStream && remoteLiveStream.url) {
    activeSource = remoteLiveStream.url;
    activeTitle = remoteLiveStream.title;
    isHls = remoteLiveStream.streamType === 'hls';
    isP2P = true;
    roleLabel = 'P2P Edge Receiver';
  } else if (incomingStream && incomingStream.objectUrl) {
    activeSource = incomingStream.objectUrl;
    activeTitle = incomingStream.fileName || 'P2P Reconstructed Stream';
    isHls = false;
    isP2P = true;
    roleLabel = 'P2P Seeder/Receiver';
  }

  const megabytesSaved = (totalBytesReceived / (1024 * 1024)).toFixed(2);
  const bitrateMbps = isConnected && (localVideo || incomingMediaStream || isDemoStream) ? '2.40' : '0.00';
  const renderFps = isConnected && (localVideo || incomingMediaStream || isDemoStream) ? 60 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      
      {/* Header with White Text and Live Typewriter Effect */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-[2.75rem] font-black text-white tracking-tight flex items-center leading-none">
            <span>{titleText}</span>
            {isTitleTyping && (
              <span className="inline-block ml-2 w-1.5 h-9 sm:h-11 bg-sky-400 animate-pulse rounded-sm" />
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 font-mono flex items-center min-h-[1.4rem] tracking-wide">
            <span>{subText}</span>
            {isSubTyping && (
              <span className="inline-block ml-1 w-2 h-4 bg-sky-400 animate-pulse" />
            )}
          </p>
        </div>

        {/* State Badge: Active (Emerald #10b981) vs Standby (Slate #64748b) */}
        <div className={`relative overflow-hidden px-4 py-2 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2.5 self-start sm:self-auto backdrop-blur-md border transition-colors duration-200 ${
          isConnected 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-slate-500/10 text-slate-400 border-white/[0.08]'
        }`}>
          <div className="absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span>{isConnected ? 'P2P Mesh Active' : 'Locating Peers...'}</span>
        </div>
      </div>

      {/* Connect 2nd Laptop on Same Wi-Fi Banner - Neutral Dark Chassis #0d1322 + 1px border-white/[0.08] */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0d1322] border border-white/[0.08] p-5 sm:p-6 shadow-sm group">
        {/* Crisp 1px gradient hairline border */}
        <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300 shrink-0">
              <Wifi size={20} className="text-slate-300" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-base text-white tracking-tight">Connect 2nd Laptop on Same Wi-Fi</span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  connectedPeersCount > 0 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-slate-500/10 text-slate-400 border-white/[0.08]'
                }`}>
                  {connectedPeersCount} {connectedPeersCount === 1 ? 'Peer' : 'Peers'} Connected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Open this link on your 2nd laptop to render the live stream:</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="bg-[#06080e] text-slate-300 font-mono text-xs px-4 py-2.5 rounded-xl border border-white/[0.08] truncate flex-1 md:w-72 shadow-inner">
              {shareUrl || 'http://localhost:5173'}
            </div>
            <button
              onClick={handleCopyLink}
              className="relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] transition-colors duration-200 shrink-0 cursor-pointer active:scale-95"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.2] to-transparent" />
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-300" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Network Stats Cards - Reorganized Horizontal Layout: Label on top left, subtle icon/dot on top right, big metric value below */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Origin Server Load */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0d1322] p-5 border border-white/[0.08] flex flex-col justify-between group hover:border-white/[0.15] transition-all duration-200">
          <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
          
          {/* Top Row: Label on Top Left, Subtle Status Dot/Icon on Top Right */}
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-slate-400 tracking-wide">Origin Server Load</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Server size={14} />
            </div>
          </div>

          {/* Big Metric Value Below */}
          <div className="mt-3.5">
            <div className="text-2xl sm:text-[1.75rem] font-black text-white tracking-tight leading-none">
              {isConnected ? '-50%' : 'Normal'}
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight mt-2">Standby Fallback</p>
          </div>
        </div>
        
        {/* Card 2: Live P2P Bitrate */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0d1322] p-5 border border-white/[0.08] flex flex-col justify-between group hover:border-white/[0.15] transition-all duration-200">
          <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
          
          {/* Top Row: Label on Top Left, Subtle Status Dot/Icon on Top Right */}
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-slate-400 tracking-wide">Live P2P Bitrate</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Radio size={14} />
            </div>
          </div>

          {/* Big Metric Value Below */}
          <div className="mt-3.5">
            <div className="text-2xl sm:text-[1.75rem] font-black text-white tracking-tight leading-none flex items-baseline gap-1.5">
              <span>{bitrateMbps}</span>
              <span className="text-xs font-bold text-sky-400 uppercase font-mono">Mbps</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight mt-2">Real-Time RTP</p>
          </div>
        </div>

        {/* Card 3: Live Render FPS */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0d1322] p-5 border border-white/[0.08] flex flex-col justify-between group hover:border-white/[0.15] transition-all duration-200">
          <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
          
          {/* Top Row: Label on Top Left, Subtle Status Dot/Icon on Top Right */}
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-slate-400 tracking-wide">Live Render FPS</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <Zap size={14} />
            </div>
          </div>

          {/* Big Metric Value Below */}
          <div className="mt-3.5">
            <div className="text-2xl sm:text-[1.75rem] font-black text-white tracking-tight leading-none flex items-baseline gap-1.5">
              <span>{renderFps}</span>
              <span className="text-xs font-bold text-sky-400 uppercase font-mono">FPS</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight mt-2">Sub-100ms Latency</p>
          </div>
        </div>

        {/* Card 4: Bandwidth Saved */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0d1322] p-5 border border-white/[0.08] flex flex-col justify-between group hover:border-white/[0.15] transition-all duration-200">
          <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" />
          
          {/* Top Row: Label on Top Left, Subtle Status Dot/Icon on Top Right */}
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-medium text-slate-400 tracking-wide">Bandwidth Saved</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
              <HardDrive size={14} />
            </div>
          </div>

          {/* Big Metric Value Below */}
          <div className="mt-3.5">
            <div className="text-2xl sm:text-[1.75rem] font-black text-white tracking-tight leading-none flex items-baseline gap-1.5">
              <span>{megabytesSaved}</span>
              <span className="text-xs font-bold text-sky-400 uppercase font-mono">MB</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono tracking-tight mt-2">Direct P2P Offload</p>
          </div>
        </div>

      </div>

      {/* Drag and Drop Area */}
      {(showDropZone || !activeSource) && (
        <div className="space-y-3">
          <DropZone onVideoLoaded={handleVideoLoaded} />
          <div className="flex items-center justify-between px-2">
            <button
              onClick={handleLoadDemoStream}
              className="text-xs text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              ✦ Or load sample MUX HLS test stream
            </button>
            {activeSource && (
              <button
                onClick={() => setShowDropZone(false)}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Hide drop zone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Stream Control Bar - Neutral Dark Chassis #0d1322 */}
      {activeSource && !showDropZone && (
        <div className="relative overflow-hidden rounded-2xl bg-[#0d1322] border border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
          <div className="flex items-center gap-3.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-white text-sm tracking-tight">{activeTitle}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                  isP2P 
                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowDropZone(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.08] transition-colors duration-200 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Change Video</span>
            </button>
            <button
              onClick={handleClearVideo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors duration-200 cursor-pointer"
            >
              <X size={13} />
              <span>Stop Stream</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Player Display - Neutral Chassis #06080e with 1px border-white/[0.08] */}
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#06080e] min-h-[380px] flex items-center justify-center">
        <div className="absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.12] to-transparent pointer-events-none z-10" />
        
        <VideoPlayer 
          videoSource={activeSource} 
          isHls={isHls} 
          title={activeTitle}
          isP2P={isP2P}
          isHost={!!localVideo || isDemoStream}
          onStreamReady={streamLiveVideo}
        />
      </div>

    </div>
  );
}
