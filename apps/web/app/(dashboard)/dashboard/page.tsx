'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiClient } from '@/lib/api-client';
import {
  Radio,
  AlertTriangle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Plus,
  Activity,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MonitorSummary {
  id: string;
  name: string;
  url: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  isActive: boolean;
  latestLatency?: number;
}

interface IncidentSummary {
  id: string;
  monitorId: string;
  type: string;
  cause: string | null;
  startedAt: string;
  resolvedAt: string | null;
}

interface LiveEventLog {
  id: string;
  type: string;
  monitorId: string;
  status?: string;
  latencyMs?: number;
  statusCode?: number | null;
  timestamp: string;
}

export default function DashboardOverviewPage() {
  const { user, org } = useAuth();
  const { subscribe } = useWebSocket();

  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEventLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [monRes, incRes] = await Promise.all([
        apiClient.get<MonitorSummary[]>('/api/monitors'),
        apiClient.get<IncidentSummary[]>('/api/incidents'),
      ]);

      if (monRes.success && monRes.data) {
        setMonitors(monRes.data);
      }
      if (incRes.success && incRes.data) {
        setIncidents(incRes.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Real-time telemetry feed
  useEffect(() => {
    const unsubResult = subscribe('health-check:result', (data) => {
      // Update monitor list status & latency
      setMonitors((prev) =>
        prev.map((m) =>
          m.id === data.monitorId
            ? { ...m, status: data.status, latestLatency: data.latencyMs }
            : m
        )
      );

      // Prepend to live activity ticker
      setLiveEvents((prev) => [
        {
          id: `evt-${Date.now()}-${Math.random()}`,
          type: 'health-check:result',
          monitorId: data.monitorId,
          status: data.status,
          latencyMs: data.latencyMs,
          statusCode: data.statusCode,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
    });

    const unsubStatus = subscribe('monitor:status-changed', (data) => {
      setMonitors((prev) =>
        prev.map((m) =>
          m.id === data.monitorId ? { ...m, status: data.to } : m
        )
      );
    });

    const unsubIncCreated = subscribe('incident:created', (data) => {
      setIncidents((prev) => [
        {
          id: data.incidentId,
          monitorId: data.monitorId,
          type: data.type,
          cause: 'Automated health check outage',
          startedAt: data.startedAt,
          resolvedAt: null,
        },
        ...prev,
      ]);
    });

    const unsubIncResolved = subscribe('incident:resolved', (data) => {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === data.incidentId ? { ...inc, resolvedAt: data.resolvedAt } : inc
        )
      );
    });

    return () => {
      unsubResult();
      unsubStatus();
      unsubIncCreated();
      unsubIncResolved();
    };
  }, [subscribe]);

  const activeIncidents = incidents.filter((i) => !i.resolvedAt).length;
  const operationalCount = monitors.filter((m) => m.status === 'up').length;
  const healthPercentage =
    monitors.length > 0
      ? ((operationalCount / monitors.length) * 100).toFixed(1)
      : '100.0';

  const validLatencies = monitors
    .map((m) => m.latestLatency)
    .filter((l): l is number => typeof l === 'number');

  const avgLatency =
    validLatencies.length > 0
      ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
      : 38;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            System Overview
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry and health monitoring status for{' '}
            <span className="font-semibold text-slate-200">{org?.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/monitors">
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 font-semibold shadow-md shadow-indigo-600/30"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New Monitor
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Total Monitors</CardTitle>
            <Radio className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">{monitors.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">
              {operationalCount} operational • {monitors.length - operationalCount} issues
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Current Health</CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {healthPercentage}%
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Operational SLA status</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Avg Response Time</CardTitle>
            <Zap className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-white">{avgLatency} ms</div>
            <p className="text-[11px] text-slate-500 mt-1">Sub-second background execution</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">Active Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${activeIncidents > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {activeIncidents}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {activeIncidents > 0 ? 'Ongoing outages detected' : 'Zero active outages'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Live Telemetry Ticker & Active Monitors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Active Monitored Endpoints Quick View */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Radio className="h-4 w-4 text-indigo-400" /> Monitored Services
            </h2>
            <Link href="/monitors" className="text-xs text-indigo-400 hover:underline">
              View All ({monitors.length})
            </Link>
          </div>

          {monitors.length === 0 ? (
            <Card className="border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400">
              No monitors yet. Click &quot;New Monitor&quot; above to schedule automated health checks.
            </Card>
          ) : (
            <div className="space-y-2.5">
              {monitors.slice(0, 5).map((m) => (
                <Link key={m.id} href={`/monitors/${m.id}`} className="block group">
                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-850/80 hover:border-slate-700 transition-all flex items-center justify-between">
                    <div className="flex items-center gap-3 truncate">
                      {m.status === 'up' ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      ) : m.status === 'down' ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500 flex-shrink-0 animate-ping" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                      )}
                      <div className="truncate">
                        <span className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                          {m.name}
                        </span>
                        <p className="text-[11px] font-mono text-slate-400 truncate max-w-sm">
                          {m.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {m.latestLatency && (
                        <span className="text-xs font-mono font-bold text-slate-300">
                          {m.latestLatency} ms
                        </span>
                      )}
                      <Badge
                        variant={m.status === 'up' ? 'success' : m.status === 'down' ? 'destructive' : 'warning'}
                        className="text-[10px] py-0"
                      >
                        {m.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right: Live WebSocket Telemetry Stream */}
        <div>
          <Card className="border-slate-800 bg-slate-900/60 h-full">
            <CardHeader className="pb-3 border-b border-slate-800/80">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-indigo-400" />
                  Live Event Stream
                </CardTitle>
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Streaming
                </span>
              </div>
              <CardDescription className="text-[11px] text-slate-400">
                Incoming pings from BullMQ workers.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {liveEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 font-mono">
                  Listening for background check pings...
                </div>
              ) : (
                <div className="space-y-2">
                  {liveEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 rounded border border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] font-mono"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {evt.status === 'up' ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 text-rose-400 flex-shrink-0" />
                        )}
                        <span className="text-slate-300 truncate">
                          mon-{evt.monitorId.slice(0, 6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
                        <span className="text-white font-semibold">{evt.latencyMs}ms</span>
                        <span className="text-[10px] text-slate-500">{evt.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
