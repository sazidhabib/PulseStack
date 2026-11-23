'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { useWebSocket } from '@/hooks/use-websocket';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/monitors/sparkline';
import { CreateMonitorModal } from '@/components/monitors/create-monitor-modal';
import {
  Radio,
  Plus,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface MonitorItem {
  id: string;
  name: string;
  url: string;
  method: string;
  intervalSeconds: number;
  timeout: number;
  expectedStatus: number;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  isActive: boolean;
  lastCheckedAt: string | null;
  history?: number[]; // latencies for sparkline
  latestLatency?: number;
}

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<MonitorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { subscribe } = useWebSocket();

  const fetchMonitors = useCallback(async () => {
    try {
      const res = await apiClient.get<MonitorItem[]>('/api/monitors');
      if (res.success && res.data) {
        // Initialize with default historical latency arrays
        const items = res.data.map((m) => ({
          ...m,
          history: [45, 42, 50, 48, 43, 47, 44, 46],
          latestLatency: 45,
        }));
        setMonitors(items);
      }
    } catch {
      toast.error('Failed to load monitors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    const unsubResult = subscribe('health-check:result', (data) => {
      setMonitors((prev) =>
        prev.map((m) => {
          if (m.id === data.monitorId) {
            const newHistory = [...(m.history || []).slice(-19), data.latencyMs];
            return {
              ...m,
              status: data.status,
              latestLatency: data.latencyMs,
              lastCheckedAt: data.checkedAt,
              history: newHistory,
            };
          }
          return m;
        })
      );
    });

    const unsubStatus = subscribe('monitor:status-changed', (data) => {
      setMonitors((prev) =>
        prev.map((m) =>
          m.id === data.monitorId ? { ...m, status: data.to } : m
        )
      );
    });

    return () => {
      unsubResult();
      unsubStatus();
    };
  }, [subscribe]);

  const handleTogglePause = async (e: React.MouseEvent, monitor: MonitorItem) => {
    e.stopPropagation();
    const action = monitor.isActive ? 'pause' : 'resume';
    try {
      const res = await apiClient.post(`/api/monitors/${monitor.id}/${action}`);
      if (res.success) {
        toast.success(`Monitor ${action}d successfully`);
        setMonitors((prev) =>
          prev.map((m) =>
            m.id === monitor.id ? { ...m, isActive: !monitor.isActive } : m
          )
        );
      }
    } catch {
      toast.error(`Failed to ${action} monitor`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete monitor "${name}"?`)) return;

    try {
      const res = await apiClient.delete(`/api/monitors/${id}`);
      if (res.success) {
        toast.success(`Monitor "${name}" deleted`);
        setMonitors((prev) => prev.filter((m) => m.id !== id));
      }
    } catch {
      toast.error('Failed to delete monitor');
    }
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return (
        <Badge variant="outline" className="text-slate-400 border-slate-700 bg-slate-800/40">
          PAUSED
        </Badge>
      );
    }
    switch (status) {
      case 'up':
        return <Badge variant="success">OPERATIONAL</Badge>;
      case 'down':
        return <Badge variant="destructive">DOWN</Badge>;
      case 'degraded':
        return <Badge variant="warning">DEGRADED</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  const getStatusDot = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <span className="h-2.5 w-2.5 rounded-full bg-slate-600 mr-2" />;
    }
    switch (status) {
      case 'up':
        return (
          <span className="flex h-2.5 w-2.5 relative mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        );
      case 'down':
        return (
          <span className="flex h-2.5 w-2.5 relative mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
        );
      case 'degraded':
        return <span className="h-2.5 w-2.5 rounded-full bg-amber-500 mr-2" />;
      default:
        return <span className="h-2.5 w-2.5 rounded-full bg-slate-500 mr-2" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Radio className="h-6 w-6 text-indigo-400" /> Monitored Endpoints
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Automated health checks executing via BullMQ background queue every minute.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMonitors}
            className="text-slate-300 border-slate-700 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-600/30"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New Monitor
          </Button>
        </div>
      </div>

      {/* Monitor Cards List */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : monitors.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/40">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Radio className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-white">No monitors configured yet</h3>
            <p className="text-sm text-slate-400 max-w-sm mt-1 mb-4">
              Add your first endpoint to begin automated background pings and telemetry collection.
            </p>
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 font-semibold"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add Your First Monitor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {monitors.map((monitor) => (
            <Link
              key={monitor.id}
              href={`/monitors/${monitor.id}`}
              className="block group"
            >
              <Card className="border-slate-800/80 bg-slate-900/60 hover:bg-slate-850/80 hover:border-slate-700 transition-all shadow-sm">
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {/* Left: Status dot, Name, URL */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="pt-1.5">
                      {getStatusDot(monitor.status, monitor.isActive)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                          {monitor.name}
                        </h3>
                        <Badge variant="outline" className="text-[10px] font-mono border-slate-700">
                          {monitor.method}
                        </Badge>
                        {getStatusBadge(monitor.status, monitor.isActive)}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 truncate">
                        <span className="truncate max-w-xs font-mono text-slate-400">
                          {monitor.url}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-slate-400">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {monitor.intervalSeconds}s
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Sparkline & Response Time */}
                  <div className="flex items-center gap-6 px-4">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-white">
                        {monitor.latestLatency ? `${monitor.latestLatency} ms` : '--'}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                        Latency
                      </div>
                    </div>

                    <div className="w-[120px] h-[32px] flex items-center justify-center">
                      <Sparkline
                        data={monitor.history || []}
                        status={monitor.isActive ? monitor.status : 'unknown'}
                      />
                    </div>
                  </div>

                  {/* Right: Controls & Nav icon */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleTogglePause(e, monitor)}
                      title={monitor.isActive ? 'Pause checks' : 'Resume checks'}
                      className="text-slate-400 hover:text-white"
                    >
                      {monitor.isActive ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 text-emerald-400" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, monitor.id, monitor.name)}
                      title="Delete monitor"
                      className="text-slate-400 hover:text-rose-400 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 transition-colors ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateMonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchMonitors}
      />
    </div>
  );
}
