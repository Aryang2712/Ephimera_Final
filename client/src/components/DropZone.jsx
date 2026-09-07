import React, { useState, useRef } from 'react';
import { processVideoFile, formatBytes } from '../utils/videoChunker';
import { UploadCloud, Loader2, Play, Sparkles } from 'lucide-react';

export default function DropZone({ onVideoLoaded, disabled = false }) {
    const [isDragging, setIsDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [statusText, setStatusText] = useState('');
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled || loading) return;
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleFile = async (file) => {
        if (!file) return;
        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mkv|mov|m4v)$/i)) {
            alert('Please select a valid video file (MP4, WebM, etc.).');
            return;
        }

        setLoading(true);
        setStatusText(`Preparing "${file.name}" for live streaming...`);
        try {
            const { manifest, chunkStore } = await processVideoFile(file);
            const objectUrl = URL.createObjectURL(file);
            onVideoLoaded({
                file,
                manifest,
                chunkStore,
                objectUrl,
                title: file.name
            });
        } catch (err) {
            console.error('Failed to process video file:', err);
            alert('Error processing video file: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (disabled || loading) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            await handleFile(file);
        }
    };

    const handleFileInputChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await handleFile(file);
        }
        e.target.value = '';
    };

    const handleClick = () => {
        if (disabled || loading) return;
        fileInputRef.current?.click();
    };

    return (
        <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer p-8 text-center backdrop-blur-2xl group ${
                isDragging
                    ? 'border-white/60 bg-white/[0.08] scale-[1.01] shadow-[0_0_35px_rgba(255,255,255,0.15)]'
                    : 'border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.06] shadow-2xl shadow-black/50'
            } ${disabled || loading ? 'pointer-events-none opacity-80' : ''}`}
        >
            {/* Top edge subtle rainbow holographic hairline */}
            <div className="absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-red-400/40 via-yellow-400/40 via-green-400/40 via-cyan-400/40 via-blue-400/40 to-pink-400/40 opacity-75 group-hover:opacity-100 transition-opacity" />

            <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                className="hidden"
                onChange={handleFileInputChange}
            />

            <div className="flex flex-col items-center justify-center space-y-3.5">
                {loading ? (
                    <>
                        <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white animate-spin shadow-inner">
                            <Loader2 size={28} />
                        </div>
                        <div>
                            <p className="font-bold text-white text-base tracking-tight">{statusText || 'Initializing Live Stream...'}</p>
                            <p className="text-xs text-zinc-400 mt-1 font-mono">Starting real-time P2P video streaming across connected peers</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative overflow-hidden ${
                            isDragging 
                                ? 'bg-white/20 text-white shadow-[0_0_25px_rgba(255,255,255,0.3)] scale-110' 
                                : 'bg-white/[0.06] border border-white/20 text-zinc-100 shadow-inner group-hover:border-white/40'
                        }`}>
                            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-red-400/50 via-yellow-400/50 to-cyan-400/50" />
                            <UploadCloud size={28} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-base sm:text-lg tracking-tight">
                                Drag & drop a video to stream live, or <span className="text-zinc-200 underline underline-offset-4 hover:text-white">browse</span>
                            </p>
                            <p className="text-xs text-zinc-400 mt-1">
                                Supports MP4, WebM & QuickTime • Live frame-by-frame P2P rendering on peer devices
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">
                            <span className="relative overflow-hidden inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200 bg-white/[0.05] border border-white/15 px-3 py-1 rounded-full backdrop-blur-md shadow-sm group/pill hover:border-white/30">
                                <div className="absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-pink-400/50 via-purple-400/50 to-cyan-400/50" />
                                <Sparkles size={12} className="text-zinc-300" />
                                <span>Real-time Live Rendering</span>
                            </span>
                            <span className="relative overflow-hidden inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200 bg-white/[0.05] border border-white/15 px-3 py-1 rounded-full backdrop-blur-md shadow-sm group/pill hover:border-white/30">
                                <div className="absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-cyan-400/50 via-teal-400/50 to-emerald-400/50" />
                                <Play size={12} className="text-zinc-300" />
                                <span>Instant Local Playback</span>
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
