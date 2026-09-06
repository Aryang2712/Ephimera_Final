import { useEffect, useRef, useState, useCallback } from 'react';

// ⚠️ YOUR EXACT MACBOOK HOTSPOT IP:
const SIGNALING_SERVER = 'ws://192.168.137.211:8080'; 

export function useWebRTC(roomId) {
  const [isConnected, setIsConnected] = useState(false);
  const [receivedChunks, setReceivedChunks] = useState(0);
  const [totalBytesReceived, setTotalBytesReceived] = useState(0); 
  const [chunksSeeded, setChunksSeeded] = useState(0); // THE FIX: Track seeded chunks!
  
  const peerConnection = useRef(null);
  const dataChannel = useRef(null); 
  const ws = useRef(null);
  const statsRef = useRef({ bytes: 0, chunks: 0, seeded: 0 });
  const myClientId = useRef(Math.random().toString(36).substring(2, 15)).current;
  
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);

  // Buffer state to assemble incoming LEGO pieces
  const incomingBuf = useRef([]);
  const incomingUrl = useRef("");

  useEffect(() => {
    window.P2PBuffer = window.P2PBuffer || {};
    ws.current = new WebSocket(SIGNALING_SERVER);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'join', room: roomId, clientId: myClientId }));
      initWebRTC();
    };

    ws.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      if (data.clientId === myClientId) return;
      if (!peerConnection.current) return;

      try {
        if (data.type === 'join') {
          makingOffer.current = true;
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          ws.current.send(JSON.stringify({ type: 'offer', room: roomId, payload: peerConnection.current.localDescription, clientId: myClientId }));
          makingOffer.current = false;
        } 
        else if (data.type === 'offer') {
          const polite = myClientId > data.clientId;
          const offerCollision = makingOffer.current || peerConnection.current.signalingState !== "stable";
          
          ignoreOffer.current = !polite && offerCollision;
          if (ignoreOffer.current) return;

          if (offerCollision) {
            await Promise.all([
              peerConnection.current.setLocalDescription({ type: "rollback" }),
              peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.payload))
            ]);
          } else {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.payload));
          }
          
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          ws.current.send(JSON.stringify({ type: 'answer', room: roomId, payload: peerConnection.current.localDescription, clientId: myClientId }));
          
        } else if (data.type === 'answer') {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.payload));
        } else if (data.type === 'ice-candidate') {
          try {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.payload));
          } catch(err) {}
        }
      } catch (err) {
        console.error("Handshake error", err);
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      if (peerConnection.current) peerConnection.current.close();
    };
  }, [roomId]);

  const initWebRTC = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.current.onconnectionstatechange = () => {
      if (peerConnection.current.connectionState === 'connected') setIsConnected(true);
    };

    dataChannel.current = peerConnection.current.createDataChannel('ephimera-cdn', { 
      negotiated: true, id: 0, ordered: true 
    });
    
    // CRITICAL FIX: Force binary data so we can send raw video slices!
    dataChannel.current.binaryType = 'arraybuffer'; 
    
    if (dataChannel.current.readyState === 'open') setIsConnected(true);
    dataChannel.current.onopen = () => setIsConnected(true);
    dataChannel.current.onclose = () => setIsConnected(false);
    
    dataChannel.current.onmessage = (e) => {
      // 1. If it's a string, it is either a Header or an EOF message
      if (typeof e.data === 'string') {
        const msg = JSON.parse(e.data);
        
        if (msg.header) {
          incomingUrl.current = msg.url;
          incomingBuf.current = []; // Clear the buffer for new video
        } 
        else if (msg.eof) {
          // 2. Assemble all the raw slices together!
          const totalLength = incomingBuf.current.reduce((acc, val) => acc + val.byteLength, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          
          incomingBuf.current.forEach(buffer => {
            combined.set(new Uint8Array(buffer), offset);
            offset += buffer.byteLength;
          });
          
          // 3. Save it to our P2P Cache so HLS.js can find it!
          window.P2PBuffer[msg.url] = combined.buffer;

          // 4. Update the UI Counters!
          statsRef.current.bytes += totalLength;
          statsRef.current.chunks += 1;
          setTotalBytesReceived(statsRef.current.bytes);
          setReceivedChunks(statsRef.current.chunks);
        }
      } 
      else if (e.data instanceof ArrayBuffer) {
        // 5. If it's raw binary data, push it to our LEGO builder
        incomingBuf.current.push(e.data);
      }
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current.send(JSON.stringify({ type: 'ice-candidate', room: roomId, payload: event.candidate, clientId: myClientId }));
      }
    };
  };

  // Notice the 'async' keyword here!
window.broadcastToPeers = useCallback(async (segmentUrl, arrayBuffer) => {
  const channel = dataChannel.current;
  if (!channel || channel.readyState !== 'open') return;

  const MAX_CHUNK = 16 * 1024;
  const HIGH_WATER = 256 * 1024; // pause sending once buffered exceeds this
  const LOW_WATER = 64 * 1024;   // resume once buffered drops below this
  channel.bufferedAmountLowThreshold = LOW_WATER;

  // Wait until the channel has actually drained, instead of guessing with setTimeout
  const waitForDrain = () =>
    new Promise((resolve) => {
      if (channel.bufferedAmount <= LOW_WATER) return resolve();
      const onLow = () => {
        channel.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };
      channel.addEventListener('bufferedamountlow', onLow);
    });

  // Retry a single send if the queue is momentarily full, instead of
  // letting the whole segment die and leave the receiver with a partial buffer
  const sendWithRetry = async (data, retries = 5) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        channel.send(data);
        return;
      } catch (err) {
        if (err.name === 'OperationError' && attempt < retries) {
          await waitForDrain();
          await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
        } else {
          throw err;
        }
      }
    }
  };

  try {
    await sendWithRetry(JSON.stringify({ header: true, url: segmentUrl }));

    let offset = 0;
    while (offset < arrayBuffer.byteLength) {
      if (channel.bufferedAmount > HIGH_WATER) {
        await waitForDrain();
      }
      const end = Math.min(offset + MAX_CHUNK, arrayBuffer.byteLength);
      await sendWithRetry(arrayBuffer.slice(offset, end));
      offset = end;
    }

    await sendWithRetry(JSON.stringify({ eof: true, url: segmentUrl }));
    setChunksSeeded((prev) => prev + 1);
  } catch (err) {
    console.error("P2P Broadcast failed permanently for", segmentUrl, err);
  }
}, []);
  // MAKE SURE YOUR DASHBOARD IS GRABBING `chunksSeeded` FROM THIS RETURN!
  return { isConnected, receivedChunks, totalBytesReceived, chunksSeeded };
}