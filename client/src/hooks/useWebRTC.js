import { useEffect, useRef, useState, useCallback } from 'react';

const getSignalingServerUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  const params = new URLSearchParams(window.location.search);
  const paramUrl = params.get('signaling');
  if (paramUrl) return paramUrl;
  
  const host = window.location.hostname;
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `ws://${host}:8080`;
  }
  return 'ws://localhost:8080';
};

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

export function useWebRTC(roomId) {
  const [isConnected, setIsConnected] = useState(false);
  const [receivedChunks, setReceivedChunks] = useState(0);
  const [totalBytesReceived, setTotalBytesReceived] = useState(0); 
  const [chunksSeeded, setChunksSeeded] = useState(0);
  const [incomingStream, setIncomingStream] = useState(null);
  
  const peerConnection = useRef(null);
  const dataChannel = useRef(null); 
  const ws = useRef(null);
  const statsRef = useRef({ bytes: 0, chunks: 0, seeded: 0 });
  const myClientId = useRef(Math.random().toString(36).substring(2, 15)).current;
  
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);

  // ICE candidate queue to prevent race conditions before remoteDescription is ready
  const candidateQueue = useRef([]);
  const isSettingRemoteDesc = useRef(false);

  // Buffer state to assemble incoming chunks
  const incomingBuf = useRef([]);
  const incomingUrl = useRef("");
  const currentChunkMeta = useRef(null);

  // Buffer state to assemble full incoming files
  const incomingManifestRef = useRef(null);
  const incomingFileChunksRef = useRef({});

  // Active seeded video for re-transmitting to new peers
  const activeSeededVideoRef = useRef(null);

  const waitForDrain = useCallback((channel, lowWater = 64 * 1024) =>
    new Promise((resolve) => {
      if (!channel || channel.bufferedAmount <= lowWater) return resolve();
      const onLow = () => {
        channel.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };
      channel.addEventListener('bufferedamountlow', onLow);
    }), []);

  const sendWithRetry = useCallback(async (channel, data, retries = 5) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        channel.send(data);
        return;
      } catch (err) {
        if (err.name === 'OperationError' && attempt < retries) {
          await waitForDrain(channel);
          await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        } else {
          throw err;
        }
      }
    }
  }, [waitForDrain]);

  const transmitFileToChannel = useCallback(async (manifest, chunkStore) => {
    const channel = dataChannel.current;
    if (!channel || channel.readyState !== 'open') return;

    const MAX_CHUNK = 16 * 1024;
    const HIGH_WATER = 256 * 1024;
    const LOW_WATER = 64 * 1024;
    channel.bufferedAmountLowThreshold = LOW_WATER;

    try {
      console.log('📡 Announcing video manifest to peer:', manifest.fileName);
      await sendWithRetry(channel, JSON.stringify({
        type: 'video-manifest',
        manifest
      }));

      for (let i = 0; i < manifest.totalChunks; i++) {
        const arrayBuffer = chunkStore.get(i);
        if (!arrayBuffer) continue;

        console.log(`📤 Seeding file chunk ${i + 1}/${manifest.totalChunks}`);
        await sendWithRetry(channel, JSON.stringify({
          header: true,
          fileChunk: true,
          chunkIndex: i,
          totalChunks: manifest.totalChunks,
          fileName: manifest.fileName,
          videoId: manifest.id,
          url: `chunk://${manifest.id}/${i}`
        }));

        let offset = 0;
        while (offset < arrayBuffer.byteLength) {
          if (channel.bufferedAmount > HIGH_WATER) {
            await waitForDrain(channel, LOW_WATER);
          }
          const end = Math.min(offset + MAX_CHUNK, arrayBuffer.byteLength);
          await sendWithRetry(channel, arrayBuffer.slice(offset, end));
          offset = end;
        }

        await sendWithRetry(channel, JSON.stringify({
          eof: true,
          fileChunk: true,
          chunkIndex: i,
          totalChunks: manifest.totalChunks,
          fileName: manifest.fileName,
          videoId: manifest.id,
          url: `chunk://${manifest.id}/${i}`
        }));

        statsRef.current.seeded += 1;
        setChunksSeeded(statsRef.current.seeded);
      }
      console.log('✅ Finished seeding all chunks to peer!');
    } catch (err) {
      console.error('File seeding error:', err);
    }
  }, [sendWithRetry, waitForDrain]);

  const seedVideoFile = useCallback(async (manifest, chunkStore) => {
    activeSeededVideoRef.current = { manifest, chunkStore };
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      await transmitFileToChannel(manifest, chunkStore);
    }
  }, [transmitFileToChannel]);

  const processCandidateQueue = async () => {
    if (!peerConnection.current?.remoteDescription) return;
    while (candidateQueue.current.length > 0) {
      const candidate = candidateQueue.current.shift();
      try {
        await peerConnection.current.addIceCandidate(candidate);
        console.log('🧊 Added queued ICE candidate successfully');
      } catch (err) {
        console.warn('⚠️ Error adding queued candidate:', err);
      }
    }
  };

  const setupDataChannelListeners = useCallback((channel) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log('⚡ WebRTC Data Channel is OPEN & READY');
      setIsConnected(true);
      if (activeSeededVideoRef.current) {
        console.log('🌱 Connected to peer: auto-seeding active video');
        const { manifest, chunkStore } = activeSeededVideoRef.current;
        transmitFileToChannel(manifest, chunkStore);
      }
    };

    channel.onclose = () => {
      console.log('⚡ WebRTC Data Channel closed');
      setIsConnected(false);
    };

    channel.onerror = (err) => {
      console.error('⚡ DataChannel error:', err);
    };

    channel.onmessage = (e) => {
      if (typeof e.data === 'string') {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }

        if (msg.type === 'video-manifest') {
          console.log('📦 Received video manifest from peer:', msg.manifest);
          incomingManifestRef.current = msg.manifest;
          incomingFileChunksRef.current = {};
          setIncomingStream({
            ...msg.manifest,
            receivedChunks: 0,
            status: 'downloading',
            blobUrl: null
          });
          return;
        }

        if (msg.header) {
          incomingUrl.current = msg.url;
          currentChunkMeta.current = msg;
          incomingBuf.current = [];
        } else if (msg.eof) {
          const totalLength = incomingBuf.current.reduce((acc, val) => acc + val.byteLength, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;

          incomingBuf.current.forEach((buffer) => {
            combined.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
          });

          const meta = currentChunkMeta.current || msg;

          if (meta?.fileChunk) {
            const chunkIdx = meta.chunkIndex;
            const totalCount = meta.totalChunks;
            incomingFileChunksRef.current[chunkIdx] = combined.buffer;
            const downloadedCount = Object.keys(incomingFileChunksRef.current).length;

            console.log(`🧩 Assembled file chunk ${chunkIdx + 1}/${totalCount} (${totalLength} bytes)`);

            setIncomingStream((prev) => ({
              ...(prev || meta),
              fileName: meta.fileName,
              totalChunks: totalCount,
              receivedChunks: downloadedCount,
              status: downloadedCount >= totalCount ? 'ready' : 'downloading',
              blobUrl:
                downloadedCount >= totalCount
                  ? (() => {
                      const chunkArray = [];
                      for (let i = 0; i < totalCount; i++) {
                        chunkArray.push(incomingFileChunksRef.current[i]);
                      }
                      const blob = new Blob(chunkArray, {
                        type: incomingManifestRef.current?.mimeType || 'video/mp4'
                      });
                      return URL.createObjectURL(blob);
                    })()
                  : prev?.blobUrl || null
            }));
          } else {
            window.P2PBuffer[msg.url] = combined.buffer;
          }

          statsRef.current.bytes += totalLength;
          statsRef.current.chunks += 1;
          setTotalBytesReceived(statsRef.current.bytes);
          setReceivedChunks(statsRef.current.chunks);
        }
      } else if (e.data instanceof ArrayBuffer) {
        incomingBuf.current.push(e.data);
      }
    };
  }, [transmitFileToChannel]);

  const createPeerConnection = useCallback(() => {
    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch {}
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnection.current = pc;
    candidateQueue.current = [];

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 PeerConnection state:', state);
      if (state === 'connected') {
        setIsConnected(true);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        setIsConnected(false);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log('🧊 ICE connection state:', iceState);
      if (iceState === 'connected' || iceState === 'completed') {
        setIsConnected(true);
      } else if (iceState === 'failed' || iceState === 'closed') {
        setIsConnected(false);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: 'ice-candidate',
            room: roomId,
            payload: event.candidate,
            clientId: myClientId
          })
        );
      }
    };

    // Listen for incoming data channels
    pc.ondatachannel = (event) => {
      console.log('⚡ Received incoming DataChannel from peer');
      dataChannel.current = event.channel;
      setupDataChannelListeners(event.channel);
    };

    // Pre-create outgoing data channel
    const dc = pc.createDataChannel('ephimera-cdn', { negotiated: true, id: 0, ordered: true });
    dataChannel.current = dc;
    setupDataChannelListeners(dc);

    return pc;
  }, [roomId, myClientId, setupDataChannelListeners]);

  useEffect(() => {
    window.P2PBuffer = window.P2PBuffer || {};
    const serverUrl = getSignalingServerUrl();
    console.log(`🔌 Connecting to Ephimera signaling server at: ${serverUrl}`);

    let socket;
    try {
      socket = new WebSocket(serverUrl);
      ws.current = socket;
    } catch (e) {
      console.warn('Signaling WebSocket connection failed:', e);
      return;
    }

    socket.onopen = () => {
      console.log('🟢 Connected to signaling server with clientId:', myClientId.substring(0, 8));
      createPeerConnection();
      socket.send(JSON.stringify({ type: 'join', room: roomId, clientId: myClientId }));
    };

    socket.onerror = (err) => {
      console.warn('Signaling WebSocket encountered an error:', err);
    };

    socket.onmessage = async (message) => {
      let data;
      try {
        data = JSON.parse(message.data);
      } catch {
        return;
      }

      if (data.clientId === myClientId) return;
      console.log(`📥 Received signaling: [${data.type}] from ${data.clientId?.substring(0, 8) || 'peer'}`);

      try {
        if (data.type === 'join') {
          // A new peer joined! Create a fresh PC and make the offer
          console.log('👋 Peer joined, initiating offer...');
          const pc = createPeerConnection();
          makingOffer.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.send(
            JSON.stringify({
              type: 'offer',
              room: roomId,
              payload: pc.localDescription,
              clientId: myClientId
            })
          );
          makingOffer.current = false;
        } else if (data.type === 'offer') {
          if (!peerConnection.current || peerConnection.current.signalingState === 'closed') {
            createPeerConnection();
          }
          const pc = peerConnection.current;
          const polite = myClientId > data.clientId;
          const offerCollision = makingOffer.current || pc.signalingState !== 'stable';

          ignoreOffer.current = !polite && offerCollision;
          if (ignoreOffer.current) {
            console.log('⚠️ Ignoring offer due to polite collision resolution');
            return;
          }

          if (offerCollision) {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(new RTCSessionDescription(data.payload))
            ]);
          } else {
            isSettingRemoteDesc.current = true;
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            isSettingRemoteDesc.current = false;
          }

          await processCandidateQueue();

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.send(
            JSON.stringify({
              type: 'answer',
              room: roomId,
              payload: pc.localDescription,
              clientId: myClientId
            })
          );

          await processCandidateQueue();
        } else if (data.type === 'answer') {
          const pc = peerConnection.current;
          if (pc && pc.signalingState !== 'closed') {
            isSettingRemoteDesc.current = true;
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            isSettingRemoteDesc.current = false;
            await processCandidateQueue();
          }
        } else if (data.type === 'ice-candidate') {
          if (!data.payload) return;
          const candidate = new RTCIceCandidate(data.payload);
          const pc = peerConnection.current;

          if (pc && pc.remoteDescription && pc.remoteDescription.type && !isSettingRemoteDesc.current) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              console.warn('Queuing candidate after failed direct addition:', err);
              candidateQueue.current.push(candidate);
            }
          } else {
            candidateQueue.current.push(candidate);
          }
        }
      } catch (err) {
        console.error('Handshake error:', err);
      }
    };

    return () => {
      if (socket) socket.close();
      if (peerConnection.current) {
        try {
          peerConnection.current.close();
        } catch {}
      }
    };
  }, [roomId, myClientId, createPeerConnection]);

  // Broadcast function for HLS segments
  window.broadcastToPeers = useCallback(async (segmentUrl, arrayBuffer) => {
    const channel = dataChannel.current;
    if (!channel || channel.readyState !== 'open') return;

    const MAX_CHUNK = 16 * 1024;
    const HIGH_WATER = 256 * 1024;
    const LOW_WATER = 64 * 1024;
    channel.bufferedAmountLowThreshold = LOW_WATER;

    try {
      await sendWithRetry(channel, JSON.stringify({ header: true, url: segmentUrl }));

      let offset = 0;
      while (offset < arrayBuffer.byteLength) {
        if (channel.bufferedAmount > HIGH_WATER) {
          await waitForDrain(channel, LOW_WATER);
        }
        const end = Math.min(offset + MAX_CHUNK, arrayBuffer.byteLength);
        await sendWithRetry(channel, arrayBuffer.slice(offset, end));
        offset = end;
      }

      await sendWithRetry(channel, JSON.stringify({ eof: true, url: segmentUrl }));
      statsRef.current.seeded += 1;
      setChunksSeeded(statsRef.current.seeded);
    } catch (err) {
      console.error('P2P Broadcast failed permanently for', segmentUrl, err);
    }
  }, [sendWithRetry, waitForDrain]);

  const resetIncomingStream = useCallback(() => {
    setIncomingStream(null);
    incomingManifestRef.current = null;
    incomingFileChunksRef.current = {};
  }, []);

  return { 
    isConnected, 
    receivedChunks, 
    totalBytesReceived, 
    chunksSeeded,
    seedVideoFile,
    incomingStream,
    resetIncomingStream
  };
}