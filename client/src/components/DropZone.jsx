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
            className={`relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-pointer p-6 sm:p-7 group ${
                isDragging
                    ? 'border-sky-400 bg-sky-950/30 shadow-lg shadow-sky-500/10'
                    : 'border-white/[0.08] bg-[#0d1322] hover:border-white/[0.18] hover:bg-[#10172a]'
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

            {loading ? (
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 animate-spin shrink-0">
                        <Loader2 size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-white text-base tracking-tight truncate">{statusText || 'Initializing Live Stream...'}</p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">Starting real-time P2P video streaming across connected peers</p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    <div className="flex items-center gap-4.5 sm:gap-5 min-w-0">
                        <div className={`w-12 h-12 sm:w-13 sm:h-13 rounded-xl flex items-center justify-center transition-colors duration-200 shrink-0 ${
                            isDragging 
                                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' 
                                : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 group-hover:border-white/[0.15] group-hover:text-white group-hover:bg-white/[0.07]'
                        }`}>
                            <UploadCloud size={24} />
                        </div>
                        <div className="text-left min-w-0">
                            <p className="font-bold text-white text-sm sm:text-base tracking-tight">
                                Drag & drop a video to stream live, or <span className="text-sky-400 underline underline-offset-4 hover:text-sky-300 transition-colors">browse</span>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Supports MP4, WebM & QuickTime • Live frame-by-frame P2P rendering
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end shrink-0">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-xl group-hover:border-white/[0.12] transition-colors">
                            <Sparkles size={13} className="text-sky-400" />
                            <span>P2P Ready</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
