import { useEffect, useRef, useState, useCallback } from 'react';

const getSignalingServerUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:8080';
  const params = new URLSearchParams(window.location.search);
  const paramUrl = params.get('signaling');
  if (paramUrl) {
    if (paramUrl.startsWith('http://')) return paramUrl.replace('http://', 'ws://');
    if (paramUrl.startsWith('https://')) return paramUrl.replace('https://', 'wss://');
    return paramUrl;
  }

  // Support environment variable for cloud deployment (Render, Vercel, etc.)
  const envUrl = import.meta.env?.VITE_SIGNALING_SERVER;
  if (envUrl) {
    if (envUrl.startsWith('http://')) return envUrl.replace('http://', 'ws://');
    if (envUrl.startsWith('https://')) return envUrl.replace('https://', 'wss://');
    return envUrl;
  }

  const isSecure = window.location.protocol === 'https:';
  const wsProtocol = isSecure ? 'wss:' : 'ws:';
  const host = window.location.hostname;

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    // When hosted on Vercel, GitHub Pages, or Netlify, default to your live Render backend
    if (host.includes('vercel.app') || host.includes('github.io') || host.includes('netlify.app')) {
      return 'wss://ephimera-server.onrender.com';
    }
    if (host.includes('loca.lt') || host.includes('ngrok') || host.includes('onrender.com') || host.includes('railway.app')) {
      return `${wsProtocol}//${host}`;
    }
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

export function useWebRTC(roomId = 'ephimera-global-room') {
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeersCount, setConnectedPeersCount] = useState(0);
  const [receivedChunks, setReceivedChunks] = useState(0);
  const [totalBytesReceived, setTotalBytesReceived] = useState(0);
  const [chunksSeeded, setChunksSeeded] = useState(0);
  const [incomingStream, setIncomingStream] = useState(null);
  const [incomingMediaStream, setIncomingMediaStream] = useState(null);

  // Full-mesh peer map: { [peerId]: { pc, dc, makingOffer, ignoreOffer, isSettingRemoteDesc, candidateQueue } }
  const peersRef = useRef({});
  const ws = useRef(null);
  const statsRef = useRef({ bytes: 0, chunks: 0, seeded: 0 });
  const myClientId = useRef(Math.random().toString(36).substring(2, 15)).current;

  const incomingManifestRef = useRef(null);
  const incomingFileChunksRef = useRef({});

  const activeSeededVideoRef = useRef(null);
  const activeStreamMetaRef = useRef(null);
  const activeMediaStreamRef = useRef(null);

  // ─── P2P signaling relay refs (mesh survives signaling-server outages) ────
  // Signaling normally goes through the WebSocket server. When it's down,
  // offers/answers/ICE candidates are gossiped through already-open data
  // channels instead. Refs let later-defined callbacks be called from
  // earlier-defined ones (setupDataChannelListeners) without reordering
  // the whole file.
  const seenRelayIdsRef = useRef(new Set());
  const sendSignalRef = useRef(null);
  const discoverPeerRef = useRef(null);
  const handleIncomingSignalRef = useRef(null);

  // ─── helpers ───────────────────────────────────────────────────────────────

  const updateConnectedCount = useCallback(() => {
    const count = Object.values(peersRef.current).filter(
      (p) => p.dc && p.dc.readyState === 'open'
    ).length;
    setConnectedPeersCount(count);
    setIsConnected(count > 0);
  }, []);

  const getOpenChannels = useCallback(() => {
    return Object.values(peersRef.current)
      .map((p) => p.dc)
      .filter((dc) => dc && dc.readyState === 'open');
  }, []);

  // Flood a relay-signal message to every open channel except the one it
  // arrived on (or none, if we're originating it). Small TTL + a seen-id
  // set keep this bounded even in a fully-meshed swarm.
  const floodRelay = useCallback((relayMsg, exceptPeerId) => {
    const data = JSON.stringify(relayMsg);
    Object.entries(peersRef.current).forEach(([pid, peer]) => {
      if (pid === exceptPeerId) return;
      if (peer.dc && peer.dc.readyState === 'open') {
        try {
          peer.dc.send(data);
        } catch {}
      }
    });
  }, []);

  // Tell every connected peer who else we know about. This is how a brand
  // new connection learns about the rest of the mesh, and how the mesh
  // heals itself if the signaling server disappears mid-session.
  const gossipPeerList = useCallback(() => {
    const knownPeers = Object.keys(peersRef.current);
    if (knownPeers.length === 0) return;
    const msg = JSON.stringify({ type: 'peer-list', peers: [myClientId, ...knownPeers] });
    getOpenChannels().forEach((dc) => {
      try {
        dc.send(msg);
      } catch {}
    });
  }, [myClientId, getOpenChannels]);

  const waitForDrain = useCallback(
    (channel, lowWater = 64 * 1024) =>
      new Promise((resolve) => {
        if (!channel || channel.bufferedAmount <= lowWater) return resolve();
        const onLow = () => {
          channel.removeEventListener('bufferedamountlow', onLow);
          resolve();
        };
        channel.addEventListener('bufferedamountlow', onLow);
      }),
    []
  );

  const sendWithRetry = useCallback(
    async (channel, data, retries = 5) => {
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
    },
    [waitForDrain]
  );

  const transmitFileToChannel = useCallback(
    async (channel, manifest, chunkStore) => {
      if (!channel || channel.readyState !== 'open') return;

      const MAX_CHUNK = 16 * 1024;
      const HIGH_WATER = 256 * 1024;
      const LOW_WATER = 64 * 1024;
      channel.bufferedAmountLowThreshold = LOW_WATER;

      try {
        console.log('📡 Announcing video manifest to peer:', manifest.fileName);
        await sendWithRetry(channel, JSON.stringify({ type: 'video-manifest', manifest }));

        for (let i = 0; i < manifest.totalChunks; i++) {
          const arrayBuffer = chunkStore.get(i);
          if (!arrayBuffer) continue;

          console.log(`📤 Seeding file chunk ${i + 1}/${manifest.totalChunks}`);
          await sendWithRetry(
            channel,
            JSON.stringify({
              header: true,
              fileChunk: true,
              chunkIndex: i,
              totalChunks: manifest.totalChunks,
              fileName: manifest.fileName,
              videoId: manifest.id,
              url: `chunk://${manifest.id}/${i}`
            })
          );

          let offset = 0;
          while (offset < arrayBuffer.byteLength) {
            if (channel.bufferedAmount > HIGH_WATER) {
              await waitForDrain(channel, LOW_WATER);
            }
            const end = Math.min(offset + MAX_CHUNK, arrayBuffer.byteLength);
            await sendWithRetry(channel, arrayBuffer.slice(offset, end));
            offset = end;
          }

          await sendWithRetry(
            channel,
            JSON.stringify({
              eof: true,
              fileChunk: true,
              chunkIndex: i,
              totalChunks: manifest.totalChunks,
              fileName: manifest.fileName,
              videoId: manifest.id,
              url: `chunk://${manifest.id}/${i}`
            })
          );

          statsRef.current.seeded += 1;
          setChunksSeeded(statsRef.current.seeded);
        }
        console.log('✅ Finished seeding all chunks to peer!');
      } catch (err) {
        console.error('File seeding error:', err);
      }
    },
    [sendWithRetry, waitForDrain]
  );

  const seedVideoFile = useCallback(
    async (manifest, chunkStore) => {
      activeSeededVideoRef.current = { manifest, chunkStore };
      const channels = getOpenChannels();
      console.log(`🌱 Seeding to ${channels.length} peer(s)`);
      await Promise.all(channels.map((dc) => transmitFileToChannel(dc, manifest, chunkStore)));
    },
    [getOpenChannels, transmitFileToChannel]
  );

  // ─── Live Video MediaStream Streaming (Ultra-HD 60FPS Low-Latency) ────────

  const setHighQualityCodecs = useCallback((pc) => {
    if (!pc || typeof RTCRtpSender.getCapabilities !== 'function') return;
    try {
      const capabilities = RTCRtpSender.getCapabilities('video');
      if (!capabilities || !capabilities.codecs) return;
      const h264OrVp9 = capabilities.codecs.filter(
        (c) =>
          c.mimeType.toLowerCase() === 'video/h264' ||
          c.mimeType.toLowerCase() === 'video/vp9' ||
          c.mimeType.toLowerCase() === 'video/av1'
      );
      const others = capabilities.codecs.filter(
        (c) =>
          c.mimeType.toLowerCase() !== 'video/h264' &&
          c.mimeType.toLowerCase() !== 'video/vp9' &&
          c.mimeType.toLowerCase() !== 'video/av1'
      );
      pc.getTransceivers().forEach((transceiver) => {
        if (
          transceiver.receiver?.track?.kind === 'video' ||
          transceiver.sender?.track?.kind === 'video'
        ) {
          try {
            transceiver.setCodecPreferences([...h264OrVp9, ...others]);
          } catch (e) {}
        }
      });
    } catch (e) {}
  }, []);

  const tuneHighQualityVideoSenders = useCallback(async (pc) => {
    if (!pc) return;
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track && sender.track.kind === 'video') {
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          // 15 Mbps max bitrate for sharp 1080p/4K LAN streaming
          params.encodings[0].maxBitrate = 15_000_000;
          params.encodings[0].maxFramerate = 60;
          params.encodings[0].scaleResolutionDownBy = 1.0;
          params.degradationPreference = 'maintain-resolution';
          await sender.setParameters(params);
          console.log('⚡ Unlocked 15 Mbps 60FPS High-Quality stream on WebRTC sender');
        } catch (e) {
          console.warn('tuneHighQualityVideoSenders warning:', e);
        }
      }
    }
  }, []);

  const streamLiveVideo = useCallback(
    async (mediaStream) => {
      activeMediaStreamRef.current = mediaStream;
      if (!mediaStream) return;

      console.log('🎥 Broadcasting live MediaStream to peers (Ultra-HD)');
      for (const [peerId, peer] of Object.entries(peersRef.current)) {
        const pc = peer.pc;
        if (!pc || pc.signalingState === 'closed') continue;

        const senders = pc.getSenders();
        mediaStream.getTracks().forEach((track) => {
          if (track.kind === 'video' && 'contentHint' in track) {
            track.contentHint = 'detail';
          }
          const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (existingSender) {
            existingSender.replaceTrack(track);
          } else {
            try {
              pc.addTrack(track, mediaStream);
            } catch (e) {
              console.warn('addTrack error:', e);
            }
          }
        });

        setHighQualityCodecs(pc);

        // Renegotiate with peer
        try {
          peer.makingOffer = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignalRef.current?.(peerId, 'offer', pc.localDescription);
          await tuneHighQualityVideoSenders(pc);
        } catch (err) {
          console.error(`Renegotiation failed with peer ${peerId.substring(0, 8)}:`, err);
        } finally {
          peer.makingOffer = false;
        }
      }
    },
    [setHighQualityCodecs, tuneHighQualityVideoSenders]
  );

  const stopLiveVideoStream = useCallback(() => {
    activeMediaStreamRef.current = null;
    setIncomingMediaStream(null);
    Object.values(peersRef.current).forEach(({ pc }) => {
      if (!pc) return;
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          try {
            pc.removeTrack(sender);
          } catch (e) {}
        }
      });
    });
  }, []);

  // ─── data channel listeners ────────────────────────────────────────────────

  const setupDataChannelListeners = useCallback(
    (channel, peerId) => {
      channel.binaryType = 'arraybuffer';

      let buf = [];
      let chunkMeta = null;

      channel.onopen = () => {
        console.log(`⚡ DataChannel OPEN with peer ${peerId.substring(0, 8)}`);
        updateConnectedCount();

        if (activeSeededVideoRef.current) {
          console.log('🌱 Auto-seeding active video to new peer');
          const { manifest, chunkStore } = activeSeededVideoRef.current;
          transmitFileToChannel(channel, manifest, chunkStore);
        }

        if (activeStreamMetaRef.current) {
          console.log('📡 Auto-announcing active live stream to new peer');
          try {
            channel.send(
              JSON.stringify({
                type: 'remote-stream-start',
                ...activeStreamMetaRef.current
              })
            );
          } catch (e) {}
        }

        // Gossip: share our known-peer list so the mesh can complete itself
        // (and stay connectable) even if the signaling server goes away.
        gossipPeerList();
      };

      channel.onclose = () => {
        console.log(`⚡ DataChannel CLOSED with peer ${peerId.substring(0, 8)}`);
        updateConnectedCount();
      };

      channel.onerror = (err) => {
        console.error(`⚡ DataChannel error with peer ${peerId.substring(0, 8)}:`, err);
      };

      channel.onmessage = (e) => {
        if (typeof e.data === 'string') {
          let msg;
          try {
            msg = JSON.parse(e.data);
          } catch {
            return;
          }

          if (msg.type === 'peer-list') {
            // Gossip: connect to anyone this peer knows about that we don't.
            (msg.peers || []).forEach((id) => {
              if (!id || id === myClientId) return;
              const existing = peersRef.current[id];
              const isLive = existing && existing.pc && !['closed', 'failed'].includes(existing.pc.connectionState);
              if (!isLive) discoverPeerRef.current?.(id);
            });
            return;
          }

          if (msg.type === 'relay-signal') {
            // Peer-relayed offer/answer/ICE — used when the signaling server
            // is unreachable so new connections and renegotiation can still
            // happen through peers we're already connected to.
            if (seenRelayIdsRef.current.has(msg.id)) return;
            seenRelayIdsRef.current.add(msg.id);
            if (seenRelayIdsRef.current.size > 500) {
              seenRelayIdsRef.current = new Set(Array.from(seenRelayIdsRef.current).slice(-250));
            }
            if (msg.to === myClientId) {
              handleIncomingSignalRef.current?.(msg.kind, msg.from, msg.payload);
            } else if ((msg.ttl ?? 0) > 0) {
              floodRelay({ ...msg, ttl: msg.ttl - 1 }, peerId);
            }
            return;
          }

          if (msg.type === 'remote-stream-start' || msg.type === 'remote-stream-stop') {
            console.log(`📡 [${peerId.substring(0, 8)}] ${msg.type}`, msg.title || '');
            window.dispatchEvent(new CustomEvent('p2p-stream-control', { detail: msg }));
            return;
          }

          if (msg.type === 'sync-play' || msg.type === 'sync-pause' || msg.type === 'sync-seek') {
            console.log(`🎬 [${peerId.substring(0, 8)}] ${msg.type} @ ${msg.currentTime?.toFixed(2)}s`);
            window.dispatchEvent(
              new CustomEvent('p2p-video-control', {
                detail: { type: msg.type, currentTime: msg.currentTime }
              })
            );
            return;
          }

          if (msg.type === 'video-manifest') {
            console.log(`📦 [${peerId.substring(0, 8)}] Received video manifest:`, msg.manifest.fileName);
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
            chunkMeta = msg;
            buf = [];
          } else if (msg.eof) {
            const totalLength = buf.reduce((acc, val) => acc + val.byteLength, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            buf.forEach((b) => {
              combined.set(new Uint8Array(b), offset);
              offset += b.byteLength;
            });
            buf = [];

            const meta = chunkMeta || msg;

            if (meta?.fileChunk) {
              const chunkIdx = meta.chunkIndex;
              const totalCount = meta.totalChunks;
              incomingFileChunksRef.current[chunkIdx] = combined.buffer;
              const downloadedCount = Object.keys(incomingFileChunksRef.current).length;

              console.log(
                `🧩 [${peerId.substring(0, 8)}] File chunk ${chunkIdx + 1}/${totalCount} (${totalLength} bytes)`
              );

              if (downloadedCount >= totalCount) {
                const chunkArray = [];
                for (let i = 0; i < totalCount; i++) {
                  chunkArray.push(incomingFileChunksRef.current[i]);
                }
                const blob = new Blob(chunkArray, {
                  type: incomingManifestRef.current?.mimeType || 'video/mp4'
                });
                const blobUrl = URL.createObjectURL(blob);
                setIncomingStream((prev) => ({
                  ...(prev || meta),
                  fileName: meta.fileName,
                  totalChunks: totalCount,
                  receivedChunks: downloadedCount,
                  status: 'ready',
                  blobUrl
                }));
              } else {
                setIncomingStream((prev) => ({
                  ...(prev || meta),
                  fileName: meta.fileName,
                  totalChunks: totalCount,
                  receivedChunks: downloadedCount,
                  status: 'downloading',
                  blobUrl: null
                }));
              }
            } else {
              window.P2PBuffer[msg.url] = combined.buffer;
              console.log(`📡 [${peerId.substring(0, 8)}] Stored HLS segment: ${msg.url}`);
            }

            statsRef.current.bytes += totalLength;
            statsRef.current.chunks += 1;
            setTotalBytesReceived(statsRef.current.bytes);
            setReceivedChunks(statsRef.current.chunks);
          }
        } else if (e.data instanceof ArrayBuffer) {
          buf.push(e.data);
        }
      };
    },
    [updateConnectedCount, transmitFileToChannel, gossipPeerList, floodRelay, myClientId]
  );

  // ─── peer connection factory ───────────────────────────────────────────────

  const createPeerConnectionForPeer = useCallback(
    (peerId) => {
      if (peersRef.current[peerId]) {
        try {
          peersRef.current[peerId].pc.close();
        } catch {}
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      const peerState = {
        pc,
        dc: null,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteDesc: false,
        candidateQueue: []
      };
      peersRef.current[peerId] = peerState;

      // Handle incoming live video/audio tracks
      pc.ontrack = (event) => {
        console.log(`🎥 [${peerId.substring(0, 8)}] Received remote MediaStream track:`, event.track.kind);
        if (event.streams && event.streams[0]) {
          setIncomingMediaStream(event.streams[0]);
        }
      };

      // If we are currently streaming a live video, add tracks to this new connection
      if (activeMediaStreamRef.current) {
        activeMediaStreamRef.current.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, activeMediaStreamRef.current);
          } catch (e) {}
        });
      }

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`🔗 [${peerId.substring(0, 8)}] PeerConnection state: ${state}`);
        if (state === 'failed' || state === 'closed') {
          delete peersRef.current[peerId];
        }
        updateConnectedCount();
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 [${peerId.substring(0, 8)}] ICE state: ${pc.iceConnectionState}`);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          // sendSignal tries the WS server first, then falls back to
          // relaying through the mesh if it's unreachable.
          sendSignalRef.current?.(peerId, 'ice-candidate', event.candidate);
        }
      };

      const dc = pc.createDataChannel('ephimera-cdn', {
        negotiated: true,
        id: 0,
        ordered: true
      });
      peerState.dc = dc;
      setupDataChannelListeners(dc, peerId);

      return peerState;
    },
    [setupDataChannelListeners, updateConnectedCount]
  );

  const processCandidateQueue = useCallback(async (peerId) => {
    const peer = peersRef.current[peerId];
    if (!peer?.pc?.remoteDescription) return;
    while (peer.candidateQueue.length > 0) {
      const candidate = peer.candidateQueue.shift();
      try {
        await peer.pc.addIceCandidate(candidate);
        console.log(`🧊 [${peerId.substring(0, 8)}] Flushed queued ICE candidate`);
      } catch (err) {
        console.warn(`⚠️ [${peerId.substring(0, 8)}] Failed queued ICE candidate:`, err);
      }
    }
  }, []);

  // ─── signal sending / receiving (WS-first, mesh-relay fallback) ───────────
  // sendSignal is the single place any offer/answer/ICE candidate goes out.
  // It tries the WebSocket signaling server first; if that's unreachable it
  // gossips the message through the mesh instead (see floodRelay above).
  const sendSignal = useCallback(
    (targetPeerId, kind, payload) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        try {
          ws.current.send(
            JSON.stringify({
              type: kind,
              room: roomId,
              payload,
              clientId: myClientId,
              targetClientId: targetPeerId
            })
          );
          return;
        } catch (err) {
          console.warn('Signaling server send failed, falling back to P2P relay:', err);
        }
      }

      const relayMsg = {
        type: 'relay-signal',
        id: `${myClientId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        from: myClientId,
        to: targetPeerId,
        kind,
        payload,
        ttl: 4
      };
      seenRelayIdsRef.current.add(relayMsg.id);
      console.log(`📡 Signaling server unavailable — relaying [${kind}] to ${targetPeerId.substring(0, 8)} via mesh`);
      floodRelay(relayMsg, null);
    },
    [roomId, myClientId, floodRelay]
  );
  sendSignalRef.current = sendSignal;

  // The actual offer/answer/ICE handling logic — identical whether the
  // message arrived via the WS server or was relayed through a peer.
  const handleIncomingSignal = useCallback(
    async (kind, peerId, payload) => {
      try {
        if (kind === 'offer') {
          if (!peersRef.current[peerId]) {
            createPeerConnectionForPeer(peerId);
          }
          const peer = peersRef.current[peerId];
          const pc = peer.pc;

          const polite = myClientId > peerId;
          const offerCollision = peer.makingOffer || pc.signalingState !== 'stable';
          peer.ignoreOffer = !polite && offerCollision;

          if (peer.ignoreOffer) {
            console.log(`⚠️ [${peerId.substring(0, 8)}] Ignoring offer (polite collision)`);
            return;
          }

          if (offerCollision) {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(new RTCSessionDescription(payload))
            ]);
          } else {
            peer.isSettingRemoteDesc = true;
            await pc.setRemoteDescription(new RTCSessionDescription(payload));
            peer.isSettingRemoteDesc = false;
          }

          await processCandidateQueue(peerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(peerId, 'answer', pc.localDescription);
          await processCandidateQueue(peerId);
        } else if (kind === 'answer') {
          const peer = peersRef.current[peerId];
          if (peer && peer.pc.signalingState !== 'closed') {
            peer.isSettingRemoteDesc = true;
            await peer.pc.setRemoteDescription(new RTCSessionDescription(payload));
            peer.isSettingRemoteDesc = false;
            await processCandidateQueue(peerId);
          }
        } else if (kind === 'ice-candidate') {
          if (!payload) return;
          const peer = peersRef.current[peerId];
          if (!peer) return;

          const candidate = new RTCIceCandidate(payload);

          if (peer.pc && peer.pc.remoteDescription?.type && !peer.isSettingRemoteDesc) {
            try {
              await peer.pc.addIceCandidate(candidate);
            } catch (err) {
              console.warn(`Queuing ICE candidate for ${peerId.substring(0, 8)}:`, err);
              peer.candidateQueue.push(candidate);
            }
          } else {
            peer.candidateQueue.push(candidate);
          }
        }
      } catch (err) {
        console.error(`Handshake error with peer ${peerId?.substring(0, 8)}:`, err);
      }
    },
    [myClientId, createPeerConnectionForPeer, processCandidateQueue, sendSignal]
  );
  handleIncomingSignalRef.current = handleIncomingSignal;

  // Initiate a connection to a peer we've just learned about — either
  // because the signaling server told us they joined, or because another
  // peer gossiped their id to us over an existing data channel.
  const discoverPeer = useCallback(
    async (peerId) => {
      if (peerId === myClientId) return;
      const existing = peersRef.current[peerId];
      if (existing?.pc && !['closed', 'failed'].includes(existing.pc.connectionState)) {
        return; // already connected or connecting
      }

      console.log(`👋 New peer joined (${peerId.substring(0, 8)}) — sending WebRTC offer...`);
      const peer = createPeerConnectionForPeer(peerId);
      peer.makingOffer = true;
      try {
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        sendSignal(peerId, 'offer', peer.pc.localDescription);
      } catch (e) {
        console.warn('Create offer error on new peer join:', e);
      } finally {
        peer.makingOffer = false;
      }
    },
    [myClientId, createPeerConnectionForPeer, sendSignal]
  );
  discoverPeerRef.current = discoverPeer;

  // ─── signaling effect ──────────────────────────────────────────────────────

  useEffect(() => {
    window.P2PBuffer = window.P2PBuffer || {};
    let socket = null;
    let reconnectTimer = null;
    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      const serverUrl = getSignalingServerUrl();
      console.log(`🔌 Connecting to signaling server at: ${serverUrl}`);

      try {
        socket = new WebSocket(serverUrl);
        ws.current = socket;

        socket.onopen = () => {
          console.log('🟢 Connected to signaling server. clientId:', myClientId.substring(0, 8));
          socket.send(JSON.stringify({ type: 'join', room: roomId, clientId: myClientId }));
        };

        socket.onerror = (err) => {
          console.warn('Signaling WebSocket error, will retry in 2s...', err);
        };

        socket.onclose = () => {
          console.log('🔴 Signaling WebSocket closed. Retrying connection in 2.5s...');
          if (!isDisposed) {
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connect, 2500);
          }
        };

        socket.onmessage = async (message) => {
          let data;
          try {
            data = JSON.parse(message.data);
          } catch {
            return;
          }

          if (data.clientId === myClientId) return;
          if (data.type === 'server-info') return;
          if (data.targetClientId && data.targetClientId !== myClientId) return;

          const peerId = data.clientId;
          if (!peerId) return;

          if (data.type === 'room-peers') {
            console.log('👥 Received active room peers from server:', data.peers);
            (data.peers || []).forEach((id) => {
              if (id && id !== myClientId) {
                discoverPeer(id);
              }
            });
            return;
          }

          if (data.type === 'join') {
            await discoverPeer(peerId);
          } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice-candidate') {
            await handleIncomingSignal(data.type, peerId, data.payload);
          }
        };
      } catch (e) {
        if (!isDisposed) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        try { socket.close(); } catch (e) {}
      }
      Object.values(peersRef.current).forEach((peer) => {
        try {
          peer.pc.close();
        } catch {}
      });
      peersRef.current = {};
    };
  }, [roomId, myClientId, discoverPeer, handleIncomingSignal]);

  // ─── HLS broadcast ─────────────────────────────────────────────────────────

  window.broadcastToPeers = useCallback(
    async (segmentUrl, arrayBuffer) => {
      const channels = getOpenChannels();
      if (channels.length === 0) return;

      const MAX_CHUNK = 16 * 1024;
      const HIGH_WATER = 256 * 1024;
      const LOW_WATER = 64 * 1024;

      const broadcastToOne = async (channel) => {
        channel.bufferedAmountLowThreshold = LOW_WATER;
        try {
          await sendWithRetry(channel, JSON.stringify({ header: true, url: segmentUrl }));

          const ab =
            arrayBuffer instanceof ArrayBuffer
              ? arrayBuffer
              : arrayBuffer.buffer
              ? arrayBuffer.buffer.slice(
                  arrayBuffer.byteOffset,
                  arrayBuffer.byteOffset + arrayBuffer.byteLength
                )
              : arrayBuffer;

          let offset = 0;
          while (offset < ab.byteLength) {
            if (channel.bufferedAmount > HIGH_WATER) {
              await waitForDrain(channel, LOW_WATER);
            }
            const end = Math.min(offset + MAX_CHUNK, ab.byteLength);
            await sendWithRetry(channel, ab.slice(offset, end));
            offset = end;
          }

          await sendWithRetry(channel, JSON.stringify({ eof: true, url: segmentUrl }));
        } catch (err) {
          console.error('P2P Broadcast failed for', segmentUrl, err);
        }
      };

      await Promise.all(channels.map(broadcastToOne));
      statsRef.current.seeded += 1;
      setChunksSeeded(statsRef.current.seeded);
    },
    [getOpenChannels, sendWithRetry, waitForDrain]
  );

  const resetIncomingStream = useCallback(() => {
    setIncomingStream(null);
    setIncomingMediaStream(null);
    incomingManifestRef.current = null;
    incomingFileChunksRef.current = {};
  }, []);

  // ─── Play/Pause/Seek sync broadcast & Stream announcements ───────────────
  window.broadcastControlToPeers = useCallback(
    (controlMsg) => {
      if (controlMsg?.type === 'remote-stream-start') {
        activeStreamMetaRef.current = controlMsg;
      } else if (controlMsg?.type === 'remote-stream-stop') {
        activeStreamMetaRef.current = null;
      }

      const channels = getOpenChannels();
      channels.forEach((channel) => {
        try {
          channel.send(JSON.stringify(controlMsg));
        } catch (err) {
          console.warn('Control sync send failed:', err);
        }
      });
    },
    [getOpenChannels]
  );

  return {
    isConnected,
    connectedPeersCount,
    receivedChunks,
    totalBytesReceived,
    chunksSeeded,
    seedVideoFile,
    streamLiveVideo,
    stopLiveVideoStream,
    incomingStream,
    incomingMediaStream,
    resetIncomingStream
  };
}