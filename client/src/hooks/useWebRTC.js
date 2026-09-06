import { useEffect, useRef, useState } from 'react';

const SIGNALING_SERVER = 'ws://localhost:8080';

export function useWebRTC(roomId) {
  const [isConnected, setIsConnected] = useState(false);
  const [receivedChunks, setReceivedChunks] = useState(0);
  
  const peerConnection = useRef(null);
  const dataChannel = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket(SIGNALING_SERVER);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'join', room: roomId }));
      initWebRTC();
    };

    ws.current.onmessage = async (message) => {
      const { type, payload } = JSON.parse(message.data);
      if (!peerConnection.current) return;

      if (type === 'offer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        ws.current.send(JSON.stringify({ type: 'answer', room: roomId, payload: answer }));
      } else if (type === 'answer') {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ice-candidate') {
        await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload));
      }
    };

    return () => {
      if (ws.current) ws.current.close();
      if (peerConnection.current) peerConnection.current.close();
    };
  }, [roomId]);

  const initWebRTC = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Public STUN server
    });

    // THE FIX: Listen for INCOMING data channels from the other peer
    peerConnection.current.ondatachannel = (event) => {
      event.channel.onmessage = (e) => {
        setReceivedChunks(prev => prev + 1);
      };
    };

    // Create OUR OUTGOING data channel
    dataChannel.current = peerConnection.current.createDataChannel('ephimera-cdn', { ordered: true });
    
    dataChannel.current.onopen = () => setIsConnected(true);
    dataChannel.current.onclose = () => setIsConnected(false);
    
    dataChannel.current.onmessage = (event) => {
      setReceivedChunks(prev => prev + 1); 
    };

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        ws.current.send(JSON.stringify({ type: 'ice-candidate', room: roomId, payload: event.candidate }));
      }
    };

    peerConnection.current.onnegotiationneeded = async () => {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      ws.current.send(JSON.stringify({ type: 'offer', room: roomId, payload: offer }));
    };
  };

  const broadcastChunk = (chunkData) => {
    if (dataChannel.current?.readyState === 'open') {
      dataChannel.current.send(chunkData);
    }
  };

  return { isConnected, broadcastChunk, receivedChunks };
}