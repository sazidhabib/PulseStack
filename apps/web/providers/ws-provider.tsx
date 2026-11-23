'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { WsEvent } from '@pulsestack/shared';
import { toast } from 'sonner';

type ListenerCallback = (data: any) => void;

export interface WsContextType {
  isConnected: boolean;
  subscribe: (eventType: string, callback: ListenerCallback) => () => void;
  lastEvent: WsEvent | null;
}

const WsContext = createContext<WsContextType | undefined>(undefined);

const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<ListenerCallback>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const subscribe = useCallback((eventType: string, callback: ListenerCallback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(callback);

    // Return cleanup function to unsubscribe
    return () => {
      listenersRef.current.get(eventType)?.delete(callback);
    };
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = `${WS_BASE_URL}?token=${encodeURIComponent(accessToken)}`;
      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastEvent(parsed);

          // Dispatch to specific event listeners
          if (parsed.type && listenersRef.current.has(parsed.type)) {
            listenersRef.current.get(parsed.type)!.forEach((cb) => {
              try {
                cb(parsed.data);
              } catch (e) {
                console.error('[WsClient] Listener error:', e);
              }
            });
          }

          // Global notifications for status changes and incidents
          if (parsed.type === 'monitor:status-changed') {
            const { monitorId, from, to } = parsed.data;
            if (to === 'down') {
              toast.error(`🚨 Monitor Status Alert`, {
                description: `Monitor ${monitorId.slice(0, 8)} transitioned from ${from} to DOWN!`,
                duration: 6000,
              });
            } else if (to === 'up') {
              toast.success(`✅ Monitor Recovered`, {
                description: `Monitor ${monitorId.slice(0, 8)} is back online (UP).`,
                duration: 5000,
              });
            } else if (to === 'degraded') {
              toast.warning(`⚠️ Monitor Degraded`, {
                description: `Monitor ${monitorId.slice(0, 8)} reported degraded latency.`,
                duration: 5000,
              });
            }
          } else if (parsed.type === 'incident:created') {
            toast.error(`🔥 New Incident Detected`, {
              description: `Automated incident recorded: ${parsed.data.type} outage on monitor.`,
              duration: 7000,
            });
          }
        } catch (e) {
          console.warn('[WsClient] Failed to parse event payload:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;

        // Exponential backoff reconnect: 2s, 4s, 8s, max 16s
        if (isAuthenticated) {
          const delay = Math.min(16000, 2000 * Math.pow(2, reconnectAttemptsRef.current));
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // ws.onclose handles retry logic
      };
    } catch (e) {
      console.error('[WsClient] Connection creation failed:', e);
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return (
    <WsContext.Provider value={{ isConnected, subscribe, lastEvent }}>
      {children}
    </WsContext.Provider>
  );
}

export function useWebSocket(): WsContextType {
  const context = useContext(WsContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WsProvider');
  }
  return context;
}
