import React from 'react';
import StreamDashboard from './components/StreamDashboard';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg mr-3 flex items-center justify-center">
             <span className="text-white font-bold">E</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">EPHIMERA</span>
        </div>
      </nav>
      
      <StreamDashboard videoId="demo-video-123" />
    </div>
  );
}

export default App;