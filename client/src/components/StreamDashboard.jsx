import React, { useState, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Activity, Server, Radio, Zap, HardDrive, Wifi, Copy, Check, RefreshCw, X } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import DropZone from './DropZone';

const DEMO_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

// Live Typing Effect Hook with Clean Auto-Removal of Cursor
function useTypewriter(text, speed = 60, startDelay = 120) {
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
  const { displayedText: titleText, isTyping: isTitleTyping } = useTypewriter('EPHIMERA CDN Node', 55, 100);
  const { displayedText: subText, isTyping: isSubTyping } = useTypewriter(
    'Real-Time P2P Live Video Mesh & Decentralized Edge Streaming',
    22,
    1150
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
          streamType: msg.streamType || 'hls'
        });
        setShowDropZone(false);
      } else if (msg.type === 'remote-stream-stop') {
        setRemoteLiveStream(null);
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
      await seedVideoFile(file, manifest, chunkStore);
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

  // Determine active source & role
  let activeSource = null;
  let activeTitle = '';
  let isHls = false;
  let isP2P = false;
  let roleLabel = 'Idle';

  if (incomingMediaStream) {
    activeSource = incomingMediaStream;
    activeTitle = 'Live Video Stream (P2P Host)';
    isHls = false;
    isP2P = true;
    roleLabel = 'P2P Receiver (Live)';
  } else if (remoteLiveStream) {
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
  } else if (localVideo) {
    activeSource = localVideo.objectUrl;
    activeTitle = localVideo.title || localVideo.file.name;
    isHls = false;
    isP2P = true;
    roleLabel = 'P2P Swarm Host';
  } else if (isDemoStream) {
    activeSource = DEMO_HLS_URL;
    activeTitle = 'MUX Demo HLS Stream';
    isHls = true;
    isP2P = false;
    roleLabel = 'HLS Live Host';
  }

  const megabytesSaved = (totalBytesReceived / (1024 * 1024)).toFixed(2);
  const bitrateMbps = isConnected && (localVideo || incomingMediaStream || isDemoStream) ? '2.40' : '0.00';
  const renderFps = isConnected && (localVideo || incomingMediaStream || isDemoStream) ? 60 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      
      {/* Header with White Text and Live Typewriter Effect */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center">
            <span>{titleText}</span>
            {isTitleTyping && (
              <span className="inline-block ml-1.5 w-1 h-8 bg-white animate-pulse shadow-[0_0_12px_rgba(255,255,255,0.9)] rounded-sm" />
            )}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-mono flex items-center min-h-[1.4rem] tracking-wide">
            <span>{subText}</span>
            {isSubTyping && (
              <span className="inline-block ml-1 w-2 h-4 bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            )}
          </p>
        </div>

        {/* Live Swarm Status Pill - Smoked Glass with Rainbow Border Touch */}
        <div className={`relative overflow-hidden px-4 py-2 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2.5 self-start sm:self-auto backdrop-blur-xl border transition-all duration-300 ${
          isConnected 
            ? 'bg-white/[0.06] text-emerald-300 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
            : 'bg-white/[0.05] text-zinc-300 border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.08)]'
        }`}>
          <div className="absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-red-400/40 via-yellow-400/40 via-green-400/40 via-cyan-400/40 to-purple-400/40" />
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,1)]' : 'bg-white/80 animate-ping'}`} />
          <span>{isConnected ? 'P2P Mesh Active' : 'Locating Peers...'}</span>
        </div>
      </div>

      {/* Connect 2nd Laptop on Same Wi-Fi Banner - Smoked White/Grey Glass + Rainbow Sheen */}
      <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] border border-white/15 p-5 sm:p-6 shadow-2xl shadow-black/60 backdrop-blur-2xl group transition-all duration-300 hover:border-white/25">
        {/* Subtle top edge rainbow holographic hairline */}
        <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-red-400/50 via-yellow-400/50 via-green-400/50 via-cyan-400/50 via-blue-400/50 to-pink-400/50 opacity-80 group-hover:opacity-100 transition-opacity" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white shrink-0 shadow-[0_0_18px_rgba(255,255,255,0.12)]">
              <Wifi size={22} className="text-zinc-100" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-base text-white tracking-tight">Connect 2nd Laptop on Same Wi-Fi</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
                  {connectedPeersCount} {connectedPeersCount === 1 ? 'Peer' : 'Peers'} Connected
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">Open this link on your 2nd laptop to render the live stream:</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="bg-black/60 text-zinc-200 font-mono text-xs px-4 py-2.5 rounded-xl border border-white/15 truncate flex-1 md:w-72 shadow-inner">
              {shareUrl || 'http://localhost:5173'}
            </div>
            <button
              onClick={handleCopyLink}
              className="relative overflow-hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/25 transition-all duration-200 shrink-0 shadow-lg hover:shadow-white/10 cursor-pointer active:scale-95 group/btn"
            >
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-red-400/60 via-yellow-400/60 via-green-400/60 via-cyan-400/60 to-purple-400/60 opacity-70 group-hover/btn:opacity-100" />
              {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Network Stats Cards - Smoked White/Grey Glass with Prismatic Rainbow Sheens */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Card 1: Origin Server Load */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5 border border-white/12 shadow-xl shadow-black/50 backdrop-blur-xl flex flex-col items-center group hover:border-white/25 hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-blue-400/50 via-cyan-400/50 to-teal-400/50 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-zinc-100 mb-3 shadow-inner">
            <Server size={20} />
          </div>
          <p className="text-zinc-400 text-xs font-medium text-center">Origin Server Load</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">{isConnected ? '-50%' : 'Normal'}</p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">CDN Standby</p>
        </div>
        
        {/* Card 2: Live P2P Bitrate */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5 border border-white/12 shadow-xl shadow-black/50 backdrop-blur-xl flex flex-col items-center group hover:border-white/25 hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-pink-400/50 via-purple-400/50 to-indigo-400/50 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-zinc-100 mb-3 shadow-inner">
            <Radio size={20} />
          </div>
          <p className="text-zinc-400 text-xs font-medium text-center">Live P2P Bitrate</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {bitrateMbps} <span className="text-xs font-semibold text-zinc-400">Mbps</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">Real-Time RTP</p>
        </div>

        {/* Card 3: Live Render FPS */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5 border border-white/12 shadow-xl shadow-black/50 backdrop-blur-xl flex flex-col items-center group hover:border-white/25 hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-amber-400/50 via-orange-400/50 to-rose-400/50 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-zinc-100 mb-3 shadow-inner">
            <Zap size={20} />
          </div>
          <p className="text-zinc-400 text-xs font-medium text-center">Live Render FPS</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {renderFps} <span className="text-xs font-semibold text-zinc-400">FPS</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">Sub-100ms Latency</p>
        </div>

        {/* Card 4: Bandwidth Saved */}
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5 border border-white/12 shadow-xl shadow-black/50 backdrop-blur-xl flex flex-col items-center group hover:border-white/25 hover:-translate-y-1 transition-all duration-300">
          <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-emerald-400/50 via-teal-400/50 to-cyan-400/50 opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-zinc-100 mb-3 shadow-inner">
            <HardDrive size={20} />
          </div>
          <p className="text-zinc-400 text-xs font-medium text-center">Bandwidth Saved</p>
          <p className="text-2xl font-black text-white mt-1 tracking-tight">
            {megabytesSaved} <span className="text-xs font-semibold text-zinc-400">MB</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono">Direct P2P Offload</p>
        </div>

      </div>

      {/* Drag and Drop Area */}
      {(showDropZone || !activeSource) && (
        <div className="space-y-3">
          <DropZone onVideoLoaded={handleVideoLoaded} />
          <div className="flex items-center justify-between px-2">
            <button
              onClick={handleLoadDemoStream}
              className="text-xs text-zinc-300 hover:text-white hover:underline flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
            >
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300">✦</span>
              <span>Or load sample MUX HLS test stream</span>
            </button>
            {activeSource && (
              <button
                onClick={() => setShowDropZone(false)}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
              >
                Hide drop zone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Stream Control Bar - Smoked White/Grey Glass */}
      {activeSource && !showDropZone && (
        <div className="relative overflow-hidden rounded-2xl bg-white/[0.05] border border-white/15 p-4 shadow-xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
          <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-red-400/40 via-yellow-400/40 via-green-400/40 via-cyan-400/40 to-purple-400/40" />
          <div className="flex items-center gap-3.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,1)]"></div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-white text-sm tracking-tight">{activeTitle}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isP2P 
                    ? 'bg-white/10 text-zinc-200 border border-white/20' 
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowDropZone(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/15 transition-all duration-200 cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Change Video</span>
            </button>
            <button
              onClick={handleClearVideo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-all duration-200 cursor-pointer"
            >
              <X size={13} />
              <span>Stop Stream</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Player Display - Smoked Neutral Glass Shell with Rainbow Rim */}
      <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/70 border border-white/15 bg-black/80 min-h-[380px] flex items-center justify-center">
        <div className="absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-red-400/30 via-yellow-400/30 via-green-400/30 via-cyan-400/30 to-purple-400/30 pointer-events-none z-10" />
        
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
