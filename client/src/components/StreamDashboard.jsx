import React, { useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { Activity, Server, Users, Zap } from 'lucide-react';
import VideoPlayer from './VideoPlayer';

export default function StreamDashboard({ videoId }) {
  const { isConnected, broadcastChunk, receivedChunks } = useWebRTC(videoId);
  const [simulatedLoad, setSimulatedLoad] = useState(0);

  // Simulating sharing a video chunk from the browser cache
  const handleSimulateSeed = () => {
    broadcastChunk("Simulated-Video-Chunk-Data");
    setSimulatedLoad(prev => prev + 1);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">EPHIMERA CDN Node</h1>
        <div className={`px-4 py-2 rounded-full font-semibold flex items-center gap-2 ${isConnected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
          <Activity size={18} className={isConnected ? "animate-pulse" : ""} />
          {isConnected ? 'P2P Network Active' : 'Locating Peers...'}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Server className="text-blue-500 mb-2" size={32} />
          <p className="text-gray-500 text-sm">Origin Server Load</p>
          <p className="text-2xl font-bold text-gray-800">{isConnected ? '-85%' : 'Normal'}</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Users className="text-purple-500 mb-2" size={32} />
          <p className="text-gray-500 text-sm">P2P Chunks Received</p>
          <p className="text-2xl font-bold text-gray-800">{receivedChunks}</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Zap className="text-amber-500 mb-2" size={32} />
          <p className="text-gray-500 text-sm">Chunks Seeded</p>
          <p className="text-2xl font-bold text-gray-800">{simulatedLoad}</p>
        </div>
      </div>

      <div className="bg-gray-900 aspect-video rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg border border-gray-200">
        <VideoPlayer />
      </div>

      <button 
        onClick={handleSimulateSeed}
        disabled={!isConnected}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Simulate Seeding Chunk to Peer
      </button>
    </div>
  );
}