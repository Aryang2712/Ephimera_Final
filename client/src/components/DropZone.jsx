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
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer p-8 text-center backdrop-blur-xl ${
                isDragging
                    ? 'border-purple-400 bg-purple-950/40 scale-[1.01] shadow-[0_0_30px_rgba(168,85,247,0.35)]'
                    : 'border-purple-500/30 bg-[#16121f]/75 hover:border-purple-400/60 hover:bg-[#1a1426]/90 shadow-xl shadow-black/40'
            } ${disabled || loading ? 'pointer-events-none opacity-80' : ''}`}
        >
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
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-spin shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                            <Loader2 size={28} />
                        </div>
                        <div>
                            <p className="font-bold text-white text-base tracking-tight">{statusText || 'Initializing Live Stream...'}</p>
                            <p className="text-xs text-purple-300/75 mt-1 font-mono">Starting real-time P2P video streaming across connected peers</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                            isDragging 
                                ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-[0_0_25px_rgba(168,85,247,0.5)] scale-110' 
                                : 'bg-purple-600/20 border border-purple-500/30 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                        }`}>
                            <UploadCloud size={28} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-base sm:text-lg tracking-tight">
                                Drag & drop a video to stream live, or <span className="text-purple-400 underline underline-offset-4 hover:text-purple-300">browse</span>
                            </p>
                            <p className="text-xs text-gray-300 mt-1">
                                Supports MP4, WebM & QuickTime • Live frame-by-frame P2P rendering on peer devices
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-200 bg-white/[0.07] border border-white/15 px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
                                <Sparkles size={12} className="text-purple-400" />
                                Real-time Live Rendering
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-200 bg-white/[0.07] border border-white/15 px-3 py-1 rounded-full backdrop-blur-md shadow-sm">
                                <Play size={12} className="text-purple-400" />
                                Instant Local Playback
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
