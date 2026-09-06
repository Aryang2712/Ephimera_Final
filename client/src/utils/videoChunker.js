export const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB per chunk

export async function processVideoFile(file) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const chunkStore = new Map();

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const slice = file.slice(start, end);
        const buffer = await slice.arrayBuffer();
        chunkStore.set(i, buffer);
    }

    const manifest = {
        id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'video/mp4',
        totalChunks,
        chunkSize: CHUNK_SIZE
    };

    return { manifest, chunkStore };
}

export function assembleVideoBlob(chunks, mimeType = 'video/mp4') {
    let chunkArray = [];
    if (chunks instanceof Map) {
        const sortedKeys = Array.from(chunks.keys()).sort((a, b) => a - b);
        chunkArray = sortedKeys.map(k => chunks.get(k));
    } else if (Array.isArray(chunks)) {
        chunkArray = chunks;
    } else if (typeof chunks === 'object' && chunks !== null) {
        const keys = Object.keys(chunks).map(Number).sort((a, b) => a - b);
        chunkArray = keys.map(k => chunks[k]);
    }

    return new Blob(chunkArray, { type: mimeType });
}

export function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}