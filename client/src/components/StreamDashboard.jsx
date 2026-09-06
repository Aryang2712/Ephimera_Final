import React, { useState, useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Activity, Server, Users, Zap, HardDrive, RefreshCw, X, Radio, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import DropZone from './DropZone';
import { formatBytes } from '../utils/videoChunker';

const DEMO_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

export default function StreamDashboard({ videoId }) {
  const { 
    isConnected, 
    receivedChunks, 
    totalBytesReceived, 
    chunksSeeded,
    seedVideoFile,
    incomingStream,
    resetIncomingStream
  } = useWebRTC(videoId);

  const [localVideo, setLocalVideo] = useState(null);
  const [isDemoStream, setIsDemoStream] = useState(false);
  const [showDropZone, setShowDropZone] = useState(true);

  // When a local video is dropped / selected
  const handleVideoLoaded = async ({ file, manifest, chunkStore, objectUrl, title }) => {
    setIsDemoStream(false);
    resetIncomingStream();
    setLocalVideo({ file, manifest, chunkStore, objectUrl, title });
    setShowDropZone(false);

    // Broadcast manifest & start seeding chunks to connected peers
    await seedVideoFile(manifest, chunkStore);
  };

  const handleLoadDemoStream = () => {
    setLocalVideo(null);
    resetIncomingStream();
    setIsDemoStream(true);
    setShowDropZone(false);
  };

  const handleClearVideo = () => {
    if (localVideo?.objectUrl) {
      URL.revokeObjectURL(localVideo.objectUrl);
    }
    setLocalVideo(null);
    setIsDemoStream(false);
    resetIncomingStream();
    setShowDropZone(true);
  };

  // Determine what should be displayed in the player
  let activeSource = null;
  let activeTitle = '';
  let isHls = false;
  let isP2P = false;
  let roleLabel = '';

  if (localVideo) {
    activeSource = localVideo.objectUrl;
    activeTitle = localVideo.title;
    isHls = false;
    isP2P = false;
    roleLabel = 'Host / Seeder';
  } else if (incomingStream?.blobUrl) {
    activeSource = incomingStream.blobUrl;
    activeTitle = incomingStream.fileName;
    isHls = false;
    isP2P = true;
    roleLabel = 'P2P Receiver';
  } else if (isDemoStream) {
    activeSource = DEMO_HLS_URL;
    activeTitle = 'MUX Demo HLS Stream';
    isHls = true;
    isP2P = false;
    roleLabel = 'HLS CDN Stream';
  }

  const megabytesSaved = (totalBytesReceived / (1024 * 1024)).toFixed(2);
  const isReceivingStream = incomingStream && incomingStream.status === 'downloading';
  const downloadPercent = incomingStream && incomingStream.totalChunks
    ? Math.min(100, Math.round((incomingStream.receivedChunks / incomingStream.totalChunks) * 100))
    : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">EPHIMERA CDN Node</h1>
          <p className="text-xs text-gray-500 mt-0.5">Decentralized P2P Video Mesh & Bandwidth Optimization</p>
        </div>
        <div className={`px-4 py-2 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 self-start sm:self-auto ${
          isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
        }`}>
          <Activity size={16} className={isConnected ? "animate-pulse" : ""} />
          {isConnected ? 'P2P Network Active' : 'Locating Peers...'}
        </div>
      </div>

      {/* Network Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Server className="text-blue-500 mb-2" size={24} />
          <p className="text-gray-500 text-xs text-center">Origin Server Load</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{isConnected ? '-85%' : 'Normal'}</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Users className="text-purple-500 mb-2" size={24} />
          <p className="text-gray-500 text-xs text-center">P2P Chunks Received</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{receivedChunks}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <HardDrive className="text-emerald-500 mb-2" size={24} />
          <p className="text-gray-500 text-xs text-center">Bandwidth Saved</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{megabytesSaved} MB</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Zap className="text-amber-500 mb-2" size={24} />
          <p className="text-gray-500 text-xs text-center">Chunks Seeded</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{chunksSeeded}</p>
        </div>
      </div>

      {/* Incoming P2P Stream Progress Alert */}
      {isReceivingStream && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm font-semibold text-blue-900 mb-2">
            <span className="flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-blue-600 animate-bounce" />
              Receiving Stream from Peer: <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-blue-200">{incomingStream.fileName}</span>
            </span>
            <span>{incomingStream.receivedChunks} / {incomingStream.totalChunks} Chunks ({downloadPercent}%)</span>
          </div>
          <div className="w-full bg-blue-200/60 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadPercent}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <Radio size={12} className="animate-pulse" />
            Fetching slices directly over WebRTC DataChannel (0% Origin Server load)
          </p>
        </div>
      )}

      {/* Drag and Drop Area */}
      {(showDropZone || !activeSource) && (
        <div className="space-y-3">
          <DropZone onVideoLoaded={handleVideoLoaded} />
          <div className="flex items-center justify-between px-1">
            <button
              onClick={handleLoadDemoStream}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium transition-colors"
            >
              Or load sample MUX HLS test stream
            </button>
            {activeSource && (
              <button
                onClick={() => setShowDropZone(false)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Hide drop zone
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active Stream Control Bar */}
      {activeSource && !showDropZone && (
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-800 text-sm">{activeTitle}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  isP2P ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {roleLabel}
                </span>
              </div>
              {localVideo && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatBytes(localVideo.manifest.fileSize)} • {localVideo.manifest.totalChunks} chunks generated & ready to seed
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDropZone(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              <RefreshCw size={13} />
              Change Video
            </button>
            <button
              onClick={handleClearVideo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            >
              <X size={13} />
              Stop Stream
            </button>
          </div>
        </div>
      )}

      {/* Video Player Display */}
      <div className="bg-gray-900 rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg border border-gray-800 min-h-[360px]">
        <VideoPlayer 
          videoSource={activeSource} 
          isHls={isHls} 
          title={activeTitle}
          isP2P={isP2P}
        />
      </div>
    </div>
  );
}