import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const listenersRef = useRef(new Set());
  const reconnectTimeoutRef = useRef(null);

  const addToast = useCallback((title, message, type = 'info') => {
    const id = Date.now() + Math.random();
    let safeMessage = '';
    if (typeof message === 'object' && message !== null) {
      if (Array.isArray(message)) {
        safeMessage = message
          .map((m) => (typeof m === 'object' && m !== null ? m.msg || m.message || JSON.stringify(m) : String(m)))
          .join('; ');
      } else {
        safeMessage = message.message || message.detail || message.msg || JSON.stringify(message);
      }
    } else {
      safeMessage = String(message ?? '');
    }
    setToasts((prev) => [...prev.slice(-4), { id, title, message: safeMessage, type, timestamp: new Date() }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const subscribe = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => {
      listenersRef.current.delete(callback);
    };
  }, []);

  const sendMessage = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not open, cannot send message:', data);
    }
  }, []);

  useEffect(() => {
    let wsUrl = '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    if (!user) {
      // Connect to global dispatcher telemetry feed even before login
      wsUrl = `${protocol}//${host}/ws/dispatcher`;
    } else if (user.role === 'CITIZEN' || user.role === 'USER') {
      wsUrl = `${protocol}//${host}/ws/user/${user.id}`;
    } else if (user.role === 'AMBULANCE_DRIVER') {
      wsUrl = `${protocol}//${host}/ws/driver/${user.id}`;
    } else if (user.role === 'HOSPITAL_STAFF') {
      const hospitalId = user.hospital_id || 1;
      wsUrl = `${protocol}//${host}/ws/hospital/${hospitalId}`;
    } else {
      // DISPATCHER or ADMIN
      wsUrl = `${protocol}//${host}/ws/dispatcher`;
    }

    let isUnmounted = false;

    const connect = () => {
      if (isUnmounted) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isUnmounted) {
            setIsConnected(true);
            console.log(`[ResQ WS] Connected to ${wsUrl}`);
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);

            // Trigger global toasts for notable events
            if (data.event === 'DISPATCH_REQUEST') {
              addToast('🚨 Incoming Emergency Dispatch', `Urgent call from ${data.data?.pickup_address || 'nearby location'}`, 'crimson');
            } else if (data.event === 'STATUS_CHANGE') {
              addToast('📡 Status Updated', `Mission is now: ${data.data?.status?.replace(/_/g, ' ')}`, 'cyan');
            } else if (data.event === 'HOSPITAL_ASSIGNED') {
              addToast('🏥 Hospital Assigned', `${data.data?.hospital_name || 'Hospital'} allocated for destination`, 'emerald');
            } else if (data.event === 'SIMULATION_ENDED') {
              addToast('✅ Simulation Completed', 'All mission waypoints and hospital handover concluded.', 'emerald');
            }

            // Notify all registered listener callbacks
            listenersRef.current.forEach((listener) => {
              try {
                listener(data);
              } catch (e) {
                console.error('Listener error:', e);
              }
            });
          } catch (err) {
            console.warn('[ResQ WS] Failed to parse payload:', event.data);
          }
        };

        ws.onerror = (error) => {
          console.warn('[ResQ WS] Socket error:', error);
        };

        ws.onclose = () => {
          if (!isUnmounted) {
            setIsConnected(false);
            console.log('[ResQ WS] Disconnected. Attempting reconnect in 3s...');
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('[ResQ WS] Connection failed:', err);
        reconnectTimeoutRef.current = setTimeout(connect, 4000);
      }
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, addToast]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        lastMessage,
        sendMessage,
        subscribe,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
