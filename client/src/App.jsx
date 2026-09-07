import React, { useState } from 'react';
import LandingPage from './LandingPage';
import StreamDashboard from './components/StreamDashboard';
import ThinkingDots from './ThinkingDots';
import { ArrowLeft } from 'lucide-react';

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

  // 2. When 'Launch Live P2P Player' is clicked, show StreamDashboard with Thinking Dots background
  return (
    <div className="min-h-screen bg-[#120F17] text-[#f3f4f6] relative overflow-x-hidden selection:bg-purple-600 selection:text-white">
      {/* React Bits "Thinking Dots" Breathing Matrix Background in Meteorite #362A83 */}
      <ThinkingDots
        dotSpacing={30}
        baseDotSize={1.2}
        maxDotSize={4.0}
        baseOpacity={0.25}
        maxOpacity={0.95}
        dotColor="#362A83"
        speed={0.75}
        cloudCount={3}
        interactive={true}
      />

      {/* Ambient background light gradients */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -right-32 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-20 left-1/3 w-[28rem] h-[28rem] bg-violet-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-50 bg-[#120F17]/85 backdrop-blur-xl border-b border-white/10 px-6 py-3.5 sticky top-0 shadow-lg shadow-black/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            {/* Ephimera Brand Logo */}
            <div className="flex items-center gap-2.5">
              <svg className="h-6 w-auto" viewBox="0 0 1260 280" fill="currentColor">
                <g fill="#ffffff">
                  <path fillRule="evenodd" d="M 48,142 C 48,92 80,64 123,64 C 166,64 197,92 197,142 L 197,152 L 70,152 C 72,185 94,204 124,204 C 146,204 165,194 175,178 L 195,188 C 180,210 155,224 123,224 C 78,224 48,194 48,142 Z M 71,133 L 175,133 C 173,103 152,83 123,83 C 94,83 73,103 71,133 Z" />
                  <path fillRule="evenodd" d="M 212,66 L 234,66 L 234,81 C 246,70 263,64 284,64 C 324,64 354,97 354,144 C 354,191 324,224 284,224 C 263,224 246,218 234,207 L 234,276 L 212,276 Z M 234,144 C 234,180 255,204 283,204 C 311,204 332,180 332,144 C 332,108 311,84 283,84 C 255,84 234,108 234,144 Z" />
                  <path d="M 368,20 L 390,20 L 390,95 C 405,75 425,64 450,64 C 482,64 503,85 503,126 L 503,222 L 481,222 L 481,131 C 481,101 468,84 444,84 C 418,84 390,103 390,136 L 390,222 L 368,222 Z" />
                  <circle cx="533" cy="38" r="11.5" />
                  <rect x="522" y="66" width="22" height="156" />
                  <path d="M 568,66 L 590,66 L 590,95 C 605,75 625,64 650,64 C 677,64 695,78 701,100 C 716,76 738,64 763,64 C 795,64 816,85 816,126 L 816,222 L 794,222 L 794,131 C 794,101 781,84 757,84 C 731,84 703,103 703,136 L 703,222 L 681,222 L 681,131 C 681,101 668,84 644,84 C 618,84 590,103 590,136 L 590,222 L 568,222 Z" />
                  <path fillRule="evenodd" d="M 837,142 C 837,92 869,64 912,64 C 955,64 986,92 986,142 L 986,152 L 859,152 C 861,185 883,204 913,204 C 935,204 954,194 964,178 L 984,188 C 969,210 944,224 912,224 C 867,224 837,194 837,142 Z M 860,133 L 964,133 C 962,103 941,83 912,83 C 883,83 862,103 860,133 Z" />
                  <path d="M 1007,66 L 1029,66 L 1029,140 C 1029,114 1045,95 1076,95 L 1076,118 C 1049,118 1029,132 1029,157 L 1029,222 L 1007,222 Z" />
                  <path fillRule="evenodd" d="M 1096,144 C 1096,98 1126,64 1166,64 C 1187,64 1205,74 1217,92 L 1217,66 L 1239,66 L 1239,222 L 1217,222 L 1217,196 C 1205,214 1187,224 1166,224 C 1126,224 1096,190 1096,144 Z M 1118,144 C 1118,180 1139,204 1167,204 C 1195,204 1217,180 1217,144 C 1217,108 1195,84 1167,84 C 1139,84 1118,108 1118,144 Z" transform="translate(-18, 0)" />
                </g>
              </svg>
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-xs text-purple-300/90 font-mono tracking-wide">P2P Mesh Active</span>
            </div>
          </div>
          
          <button
            onClick={() => setShowDashboard(false)}
            className="flex items-center space-x-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3.5 py-1.5 rounded-lg transition duration-200 border border-white/20 hover:border-white/40 shadow-sm backdrop-blur-md cursor-pointer group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
            <span>HOME</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <StreamDashboard />
      </main>
    </div>
  );
}
