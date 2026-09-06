import React, { useState, useRef } from 'react';
import { processVideoFile, formatBytes } from '../utils/videoChunker';
import { UploadCloud, Film, Loader2, Play } from 'lucide-react';

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
        setStatusText(`Chunking "${file.name}" (${formatBytes(file.size)})...`);
        try {
            const { manifest, chunkStore } = await processVideoFile(file);
            const objectUrl = URL.createObjectURL(file);
            setStatusText(`Ready! ${manifest.totalChunks} chunks generated.`);
            onVideoLoaded({
                file,
                manifest,
                chunkStore,
                objectUrl,
                title: file.name
            });
        } catch (err) {
            console.error('Failed to chunk video file:', err);
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
        // Reset input so same file can be selected again if needed
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
            className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer p-6 text-center ${
                isDragging
                    ? 'border-blue-500 bg-blue-50/80 scale-[1.01] shadow-md'
                    : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50/80 shadow-sm'
            } ${disabled || loading ? 'pointer-events-none opacity-80' : ''}`}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                className="hidden"
                onChange={handleFileInputChange}
            />

            <div className="flex flex-col items-center justify-center space-y-3">
                {loading ? (
                    <>
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 animate-spin">
                            <Loader2 size={26} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800 text-sm">{statusText || 'Processing Video...'}</p>
                            <p className="text-xs text-gray-500 mt-1">Generating P2P chunks (1MB each) for mesh streaming</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                            isDragging ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                        }`}>
                            <UploadCloud size={26} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800 text-base">
                                Drag & drop a video file here, or <span className="text-blue-600 underline">browse</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                Supports MP4, WebM & QuickTime • Only your selected video will stream across the P2P network
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md">
                                <Film size={13} className="text-gray-500" />
                                1 MB P2P Chunks
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md">
                                <Play size={13} className="text-blue-600" />
                                Instant Local Playback
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}