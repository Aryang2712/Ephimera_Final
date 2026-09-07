import React, { useState } from 'react';
import LandingPage from './LandingPage';
import StreamDashboard from './components/StreamDashboard';

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  if (!showDashboard) {
    return <LandingPage onLaunchDashboard={() => setShowDashboard(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            ⚡
          </div>
          <span className="font-bold text-gray-900 text-lg">Ephimera P2P Stream</span>
        </div>
        <button
          onClick={() => setShowDashboard(false)}
          className="text-sm font-semibold text-gray-600 hover:text-purple-600 transition"
        >
          ← Back to Landing
        </button>
      </nav>
      <main className="p-6">
        <StreamDashboard />
      </main>
    </div>
  );
}
