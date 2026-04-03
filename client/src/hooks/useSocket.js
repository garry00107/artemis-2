import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// In production (Vercel), use relative URLs and polling instead of WebSocket
const IS_PROD = !window.location.hostname.includes('localhost');
const SERVER_URL = IS_PROD ? '' : 'http://localhost:3001';

/**
 * Socket.io connection hook
 * Manages connection lifecycle and provides socket instance
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected };
}

/**
 * Orion state hook — receives real-time position updates via Socket.io
 */
export function useOrionState(socket) {
  const [state, setState] = useState(null);
  const [trajectory, setTrajectory] = useState([]);
  const historyRef = useRef([]);

  // Fetch trajectory points on mount
  useEffect(() => {
    fetch(`${SERVER_URL}/api/orion/trajectory`)
      .then(res => res.json())
      .then(data => setTrajectory(data.points || []))
      .catch(err => console.warn('Failed to fetch trajectory:', err));
  }, []);

  // Listen for real-time state updates
  useEffect(() => {
    if (IS_PROD) {
      // Production: poll REST API every 2 seconds
      const poll = async () => {
        try {
          const res = await fetch(`${SERVER_URL}/api/orion/state`);
          const data = await res.json();
          setState(data);
          historyRef.current.push({
            time: Date.now(),
            distance: data.distanceFromEarth,
            velocity: data.velocity,
          });
          if (historyRef.current.length > 900) historyRef.current.shift();
        } catch (e) { /* retry next tick */ }
      };
      poll();
      const id = setInterval(poll, 2000);
      return () => clearInterval(id);
    }

    // Dev: use Socket.io
    if (!socket) return;

    const handler = (data) => {
      setState(data);
      
      // Keep history for sparklines (last 30 minutes = ~900 samples at 2s intervals)
      historyRef.current.push({
        time: Date.now(),
        distance: data.distanceFromEarth,
        velocity: data.velocity,
      });
      if (historyRef.current.length > 900) {
        historyRef.current.shift();
      }
    };

    socket.on('orion-state', handler);
    return () => socket.off('orion-state', handler);
  }, [socket]);

  return { state, trajectory, history: historyRef.current };
}

/**
 * Chat hook — manages messages, online count, sending
 */
export function useChat(socket) {
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat-history', (history) => {
      setMessages(history);
    });

    socket.on('chat-message', (msg) => {
      setMessages(prev => [...prev.slice(-99), msg]);
    });

    socket.on('online-count', (count) => {
      setOnlineCount(count);
    });

    return () => {
      socket.off('chat-history');
      socket.off('chat-message');
      socket.off('online-count');
    };
  }, [socket]);

  const sendMessage = useCallback((username, text) => {
    if (socket && text.trim()) {
      socket.emit('chat-message', { username, text: text.trim() });
    }
  }, [socket]);

  return { messages, onlineCount, sendMessage };
}
