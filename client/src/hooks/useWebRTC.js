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
  if (dataChannel.current && dataChannel.current.readyState === 'open') {
    try {
      dataChannel.current.send(JSON.stringify({ header: true, url: segmentUrl }));
      
      // THE FIX: 16KB is the maximum universally safe chunk size for WebRTC!
      const MAX_CHUNK = 16 * 1024; 
      let offset = 0;
      
      while (offset < arrayBuffer.byteLength) {
        // THE FIX: If the queue has even 4 slices in it (64KB), force a pause!
        if (dataChannel.current.bufferedAmount > 64 * 1024) {
          // Yield the JavaScript event loop for 10ms so the Wi-Fi card can transmit
          await new Promise(resolve => setTimeout(resolve, 10)); 
        }

        const end = Math.min(offset + MAX_CHUNK, arrayBuffer.byteLength);
        dataChannel.current.send(arrayBuffer.slice(offset, end));
        offset += MAX_CHUNK;
      }
      
      dataChannel.current.send(JSON.stringify({ eof: true, url: segmentUrl }));
      setChunksSeeded(prev => prev + 1);
      
    } catch (err) {
      console.error("P2P Broadcast failed", err);
    }
  }
}, []);
  // MAKE SURE YOUR DASHBOARD IS GRABBING `chunksSeeded` FROM THIS RETURN!
  return { isConnected, receivedChunks, totalBytesReceived, chunksSeeded };
}