import React, { useState, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Activity, Server, Radio, Zap, HardDrive, Wifi, Copy, Check, RefreshCw, X } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import DropZone from './DropZone';

const DEMO_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

// Live Typing Effect Hook with Cursor Support
function useTypewriter(text, speed = 65, startDelay = 150) {
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

  // Live Typewriter Effect for Title & Subtitle
  const { displayedText: titleText, isTyping: isTitleTyping } = useTypewriter('EPHIMERA CDN Node', 60, 100);
  const { displayedText: subText, isTyping: isSubTyping } = useTypewriter(
    'Real-Time P2P Live Video Mesh & Decentralized Edge Streaming',
    25,
    1250
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

  // Listen for remote stream start/stop from any peer on the network
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

  // When a local video is dropped / selected
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
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header with Bright White Text & Live Typewriter Cursor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center">
            <span>{titleText}</span>
            {isTitleTyping && (
              <span className="inline-block ml-1 w-1 h-8 bg-purple-400 animate-pulse shadow-[0_0_12px_rgba(168,85,247,0.9)] rounded-sm" />
            )}
          </h1>
          <p className="text-xs sm:text-sm text-gray-200 mt-1 font-mono flex items-center min-h-[1.4rem]">
            <span>{subText}</span>
            {(isSubTyping || (!isTitleTyping && !subText)) && (
              <span className="inline-block ml-1 w-2 h-4 bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            )}
            {!isSubTyping && subText && (
              <span className="inline-block ml-1 w-2 h-4 bg-purple-400/80 animate-pulse opacity-75" />
            )}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 self-start sm:self-auto ${
          isConnected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        }`}>
          <Activity size={16} className={isConnected ? "animate-pulse" : ""} />
          {isConnected ? 'P2P Mesh Connected' : 'Locating Peers...'}
        </div>
      </div>

      {/* Connect 2nd Laptop on Same Wi-Fi Banner */}
      <div className="bg-gray-800/90 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-gray-700/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 shadow-[0_0_12px_rgba(168,85,247,0.2)]">
            <Wifi size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base text-white">Connect 2nd Laptop on Same Wi-Fi</span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {connectedPeersCount} {connectedPeersCount === 1 ? 'Peer' : 'Peers'} Connected
              </span>
            </div>
            <p className="text-xs text-gray-300 mt-0.5">Open this link on your 2nd laptop to render the live stream:</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="bg-gray-900/90 text-gray-200 font-mono text-xs px-3.5 py-2 rounded-lg border border-gray-700 truncate flex-1 md:w-64">
            {shareUrl || 'http://localhost:5173'}
          </div>
          <button
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors shrink-0 shadow-sm cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Network Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/80 p-4 rounded-xl shadow-md border border-gray-700/70 flex flex-col items-center backdrop-blur-sm">
          <Server className="text-blue-400 mb-2" size={24} />
          <p className="text-gray-400 text-xs text-center font-medium">Origin Server Load</p>
          <p className="text-xl font-bold text-white mt-1">{isConnected ? '-50%' : 'Normal'}</p>
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">Standby</p>
        </div>
        
        <div className="bg-gray-800/80 p-4 rounded-xl shadow-md border border-gray-700/70 flex flex-col items-center backdrop-blur-sm">
          <Radio className="text-pink-400 mb-2" size={24} />
          <p className="text-gray-400 text-xs text-center font-medium">Live P2P Bitrate</p>
          <p className="text-xl font-bold text-white mt-1">{bitrateMbps} <span className="text-xs font-normal text-gray-400">Mbps</span></p>
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">Real-Time RTP</p>
        </div>

        <div className="bg-gray-800/80 p-4 rounded-xl shadow-md border border-gray-700/70 flex flex-col items-center backdrop-blur-sm">
          <Zap className="text-amber-400 mb-2" size={24} />
          <p className="text-gray-400 text-xs text-center font-medium">Live Render FPS</p>
          <p className="text-xl font-bold text-white mt-1">{renderFps} <span className="text-xs font-normal text-gray-400">FPS</span></p>
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">Sub-100ms Latency</p>
        </div>

        <div className="bg-gray-800/80 p-4 rounded-xl shadow-md border border-gray-700/70 flex flex-col items-center backdrop-blur-sm">
          <HardDrive className="text-emerald-400 mb-2" size={24} />
          <p className="text-gray-400 text-xs text-center font-medium">Bandwidth Saved</p>
          <p className="text-xl font-bold text-white mt-1">{megabytesSaved} <span className="text-xs font-normal text-gray-400">MB</span></p>
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">Direct P2P Offload</p>
        </div>
      </div>

      {/* Drag and Drop Area */}
      {(showDropZone || !activeSource) && (
        <div className="space-y-3">
          <DropZone onVideoLoaded={handleVideoLoaded} />
          <div className="flex items-center justify-between px-1">
            <button
              onClick={handleLoadDemoStream}
              className="text-xs text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              Or load sample MUX HLS test stream
            </button>
            {activeSource && (
              <button
                onClick={() => setShowDropZone(false)}
                className="text-xs text-gray-400 hover:text-gray-200 underline cursor-pointer"
              >
                Hide drop zone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Stream Control Bar */}
      {activeSource && !showDropZone && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white text-sm">{activeTitle}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  isP2P ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDropZone(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-white transition-colors cursor-pointer"
            >
              <RefreshCw size={13} />
              Change Video
            </button>
            <button
              onClick={handleClearVideo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800 transition-colors cursor-pointer"
            >
              <X size={13} />
              Stop Stream
            </button>
          </div>
        </div>
      )}

      {/* Video Player Display */}
      <div className="bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden shadow-2xl border border-gray-800 min-h-[360px]">
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
