import React, { useState, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Activity, Server, Users, Zap, HardDrive } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

export default function StreamDashboard({ videoId }) {
    const [chunksSeeded, setChunksSeeded] = useState(0);
  const { isConnected, broadcastChunk, receivedChunks, totalBytesReceived } = useWebRTC(videoId);
  

  const megabytesSaved = (totalBytesReceived / (1024 * 1024)).toFixed(2);

  // Wrap in useCallback to prevent unnecessary re-creations
 // Only count the chunk if we are actually connected to another laptop!
  const handleBroadcastAndCount = useCallback((chunkData) => {
    broadcastChunk(chunkData);
    if (isConnected) {
      setChunksSeeded(prev => prev + 1);
    }
  }, [broadcastChunk, isConnected]);
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">EPHIMERA CDN Node</h1>
        <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          <Activity size={18} className={isConnected ? "animate-pulse" : ""} />
          {isConnected ? 'P2P Network Active' : 'Locating Peers...'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Server className="text-blue-500 mb-2" size={28} />
          <p className="text-gray-500 text-xs text-center">Origin Server Load</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{isConnected ? '-85%' : 'Normal'}</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Users className="text-purple-500 mb-2" size={28} />
          <p className="text-gray-500 text-xs text-center">P2P Chunks Received</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{receivedChunks}</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <HardDrive className="text-emerald-500 mb-2" size={28} />
          <p className="text-gray-500 text-xs text-center">Bandwidth Saved</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{megabytesSaved} MB</p>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Zap className="text-amber-500 mb-2" size={28} />
          <p className="text-gray-500 text-xs text-center">Chunks Seeded</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{chunksSeeded}</p>
        </div>
      </div>

      <div className="bg-gray-900 aspect-video rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg border border-gray-200">
        <VideoPlayer broadcastChunk={handleBroadcastAndCount} />
      </div>
    </div>
  );
}