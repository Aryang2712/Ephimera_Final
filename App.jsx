import React, { useState } from 'react';
import LandingPage from './LandingPage';
import StreamDashboard from './components/StreamDashboard';

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  // 1. If not launched yet, show the 3D Landing Page
  if (!showDashboard) {
    return (
      <LandingPage
        onLaunchDashboard={() => {
          setShowDashboard(true);
        }}
      />
    );
  }

  // 2. When "Launch Live P2P Player" is clicked, show StreamDashboard with top bar
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800/80 backdrop-blur-md border-b border-gray-700/60 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-purple-500/30">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-tight">Ephimera P2P Stream</h1>
              <span className="text-xs text-purple-400 font-medium">Live Swarm Active</span>
            </div>
          </div>
          
          <button
            onClick={() => setShowDashboard(false)}
            className="flex items-center space-x-2 text-sm font-semibold bg-gray-700/60 hover:bg-purple-600 hover:text-white px-4 py-2 rounded-xl transition duration-200 border border-gray-600"
          >
            <span>←</span>
            <span>Back to Landing</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <StreamDashboard />
      </main>
    </div>
  );
}
