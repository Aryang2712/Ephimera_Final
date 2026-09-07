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
            className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors duration-200 cursor-pointer p-8 text-center group ${
                isDragging
                    ? 'border-sky-400 bg-sky-950/20'
                    : 'border-white/[0.08] bg-[#0d1322] hover:border-white/[0.18] hover:bg-[#11182c]'
            } ${disabled || loading ? 'pointer-events-none opacity-80' : ''}`}
        >
            {/* Crisp 1px gradient hairline border */}
            <div className="absolute inset-x-8 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />

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
                        <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 animate-spin">
                            <Loader2 size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-white text-base tracking-tight">{statusText || 'Initializing Live Stream...'}</p>
                            <p className="text-xs text-slate-400 mt-1 font-mono">Starting real-time P2P video streaming across connected peers</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-200 ${
                            isDragging 
                                ? 'bg-sky-500 text-white' 
                                : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 group-hover:border-white/[0.15] group-hover:text-white'
                        }`}>
                            <UploadCloud size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-white text-base sm:text-lg tracking-tight">
                                Drag & drop a video to stream live, or <span className="text-sky-400 underline underline-offset-4 hover:text-sky-300">browse</span>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Supports MP4, WebM & QuickTime • Live frame-by-frame P2P rendering on peer devices
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] px-3 py-1 rounded-full">
                                <Sparkles size={12} className="text-sky-400" />
                                Real-time Live Rendering
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] px-3 py-1 rounded-full">
                                <Play size={12} className="text-emerald-400" />
                                Instant Local Playback
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
